// src/features/home/engine/SkinEngine.ts
// Modrinth-style 3D skin renderer: GLTF player model + AnimationMixer clips.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import classicPlayerModelUrl from '../../../assets/models/classic-player.gltf?url';
import slimPlayerModelUrl from '../../../assets/models/slim-player.gltf?url';
import {
  applyCapeTexture,
  applyPlayerTexture,
  cloneModelScene,
  createTransparentTexture,
  disposeObjectTree,
  enableSampleAlphaToCoverage,
  loadModrinthAnimationSource,
  loadModrinthModel,
  loadModrinthTexture,
} from './modrinthSkinRendering';

export type AnimationPreset = 'idle' | 'idle_sub_1' | 'idle_sub_2' | 'idle_sub_3' | 'interact';
export type AnimationLoopMode = 'repeat' | 'once';
export type SkinModelVariant = 'classic' | 'slim';
export type BackEquipmentVariant = 'cape' | 'elytra';

export interface CustomAnimationOptions {
  loop?: AnimationLoopMode;
  randomIdle?: boolean;
  weight?: number;
}

export interface ImportAnimationOptions extends CustomAnimationOptions {
  id?: string;
  clipName?: string;
}

export interface SkinEngineOptions {
  defaultSkinUrl?: string;
  targetFps?: number;
  idleFps?: number;
  width?: number;
  height?: number;
  enableRandomIdle?: boolean;
  randomIdleInterval?: [number, number];
}

interface RandomIdleEntry {
  id: string;
  weight: number;
}

interface SkinEngineRaw {
  controls: OrbitControls;
  playerWrapper: THREE.Group;
  render: () => void;
  canvas: HTMLCanvasElement;
}

const DEFAULT_SKIN_URL = 'https://minotar.net/skin/Steve.png';
const DEFAULT_FPS = 60;
const DEFAULT_IDLE_FPS = 30;
const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 450;
const DEFAULT_RANDOM_IDLE_INTERVAL: [number, number] = [8000, 8000];
const TRANSITION_SECONDS = 0.2;
const FRONT_ROTATION_Y = Math.PI;
const CAMERA_POSITION = new THREE.Vector3(0, 1.26, -4.15);
const CAMERA_TARGET = new THREE.Vector3(0, 0.98, 0);
const MODEL_SCALE = 0.76;
const BASE_ANIMATION: AnimationPreset = 'idle';
const INTERACT_ANIMATION: AnimationPreset = 'interact';

const defaultRandomIdlePool: RandomIdleEntry[] = [
  { id: 'idle_sub_1', weight: 1 },
  { id: 'idle_sub_2', weight: 1 },
  { id: 'idle_sub_3', weight: 1 },
];

function weightedRandom<T extends { weight: number }>(pool: T[]): T {
  const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.random() * totalWeight;
  for (const entry of pool) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry;
  }
  return pool[pool.length - 1];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toModelVariant(model?: SkinModelVariant | 'auto-detect'): SkinModelVariant {
  return model === 'slim' ? 'slim' : 'classic';
}

function modelUrlForVariant(model: SkinModelVariant): string {
  return model === 'slim' ? slimPlayerModelUrl : classicPlayerModelUrl;
}

function createSpotlightMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      innerColor: { value: new THREE.Color(0x000000) },
      outerColor: { value: new THREE.Color(0xffffff) },
      innerOpacity: { value: 0.3 },
      outerOpacity: { value: 0.0 },
      falloffPower: { value: 1.2 },
      shadowRadius: { value: 7 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 innerColor;
      uniform vec3 outerColor;
      uniform float innerOpacity;
      uniform float outerOpacity;
      uniform float falloffPower;
      uniform float shadowRadius;
      varying vec2 vUv;

      void main() {
        vec2 center = vec2(0.5, 0.5);
        float dist = distance(vUv, center) * 2.0;
        float shadowFalloff = 1.0 - smoothstep(0.0, shadowRadius, dist);
        float spotlightFalloff = 1.0 - smoothstep(0.0, 1.0, pow(dist, falloffPower));
        vec3 color = mix(outerColor, innerColor, shadowFalloff);
        float opacity = mix(outerOpacity, innerOpacity * shadowFalloff, spotlightFalloff);
        gl_FragColor = vec4(color, opacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
}

export class SkinEngine {
  private static instance: SkinEngine | null = null;

  static getOrCreate(options?: SkinEngineOptions): SkinEngine {
    if (SkinEngine.instance && !SkinEngine.instance.isDisposed) {
      return SkinEngine.instance;
    }
    SkinEngine.instance = new SkinEngine(options);
    return SkinEngine.instance;
  }

  static get current(): SkinEngine | null {
    return SkinEngine.instance;
  }

  private readonly _canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly playerWrapper: THREE.Group;
  private readonly modelWrapper: THREE.Group;
  private readonly transparentTexture: THREE.Texture;
  private readonly rawView: SkinEngineRaw;

  private playerModel: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private customClips = new Map<string, THREE.AnimationClip>();
  private animationLoopModes = new Map<string, AnimationLoopMode>();
  private currentTexture: THREE.Texture | null = null;
  private currentCapeTexture: THREE.Texture | null = null;
  private currentAnimationId: string = BASE_ANIMATION;
  private transientAnimationTimerId: ReturnType<typeof setTimeout> | null = null;
  private randomIdleTimerId: ReturnType<typeof setTimeout> | null = null;
  private renderFrameId: number | null = null;
  private lastRenderTime = 0;
  private interactionBoostUntil = 0;
  private lastLoadedSkinKey: string | null = null;
  private lastLoadedCapeKey: string | null = null;
  private lastSkinSource: string = DEFAULT_SKIN_URL;
  private currentModel: SkinModelVariant = 'classic';
  private skinLoadVersion = 0;
  private capeLoadVersion = 0;
  private isPointerDown = false;
  private pointerMoved = false;
  private previousPointerX = 0;
  private _disposed = false;
  private previewScale = 1;

  private randomIdlePool: RandomIdleEntry[] = [...defaultRandomIdlePool];
  private randomIdleInterval: [number, number];
  private _randomIdleEnabled: boolean;

  readonly defaultSkinUrl: string;
  readonly targetFps: number;
  readonly idleFps: number;

  private constructor(options?: SkinEngineOptions) {
    this.defaultSkinUrl = options?.defaultSkinUrl ?? DEFAULT_SKIN_URL;
    this.targetFps = options?.targetFps ?? DEFAULT_FPS;
    this.idleFps = Math.min(options?.idleFps ?? DEFAULT_IDLE_FPS, this.targetFps);
    this._randomIdleEnabled = options?.enableRandomIdle ?? true;
    this.randomIdleInterval = options?.randomIdleInterval ?? DEFAULT_RANDOM_IDLE_INTERVAL;
    this.lastSkinSource = this.defaultSkinUrl;

    this._canvas = document.createElement('canvas');
    this._canvas.className = 'w-full h-full outline-none pointer-events-auto';
    this._canvas.style.display = 'block';
    this._canvas.style.opacity = '0';
    this._canvas.style.transition = 'opacity 500ms ease';
    this._canvas.addEventListener('pointerdown', this.handlePointerDown);
    this._canvas.addEventListener('pointermove', this.handlePointerMove);
    this._canvas.addEventListener('pointerup', this.handlePointerUp);
    this._canvas.addEventListener('pointerleave', this.handlePointerUp);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this._canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    enableSampleAlphaToCoverage(this.renderer);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.copy(CAMERA_POSITION);

    this.controls = new OrbitControls(this.camera, this._canvas);
    this.controls.enableRotate = false;
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.target.copy(CAMERA_TARGET);
    this.controls.update();

    this.playerWrapper = new THREE.Group();
    this.playerWrapper.rotation.y = FRONT_ROTATION_Y;
    this.modelWrapper = new THREE.Group();
    this.modelWrapper.position.set(0, 0.04, 0);
    this.modelWrapper.scale.setScalar(MODEL_SCALE * this.previewScale);
    this.playerWrapper.add(this.modelWrapper);
    this.scene.add(this.playerWrapper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(-3, 4, -2);
    this.scene.add(ambientLight, directionalLight);

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.75, 128), createSpotlightMaterial());
    shadow.position.set(0, -0.1, 0);
    shadow.rotation.x = -Math.PI / 2;
    this.scene.add(shadow);

    this.transparentTexture = createTransparentTexture();
    this.rawView = {
      controls: this.controls,
      playerWrapper: this.playerWrapper,
      render: () => this.render(),
      canvas: this._canvas,
    };

    this.setSize(options?.width ?? DEFAULT_WIDTH, options?.height ?? DEFAULT_HEIGHT);
    void this.forceLoadSkin('default:steve', this.defaultSkinUrl, 'classic');

    if (this._randomIdleEnabled) {
      this.scheduleNextRandomIdle();
    }

    this.registerBeforeUnload();
  }

  get raw(): SkinEngineRaw {
    return this.rawView;
  }

  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  get isDisposed(): boolean {
    return this._disposed;
  }

  get isRendering(): boolean {
    return this.renderFrameId !== null;
  }

  get loadedSkinKey(): string | null {
    return this.lastLoadedSkinKey;
  }

  get loadedCapeKey(): string | null {
    return this.lastLoadedCapeKey;
  }

  get currentAnimation(): string {
    return this.currentAnimationId;
  }

  get isUserRotating(): boolean {
    return this.isPointerDown;
  }

  setSize(width: number, height: number): void {
    if (this._disposed) return;
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    this.renderer.setSize(safeWidth, safeHeight, false);
    this.camera.aspect = safeWidth / safeHeight;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  startRenderLoop(): void {
    if (this.renderFrameId !== null || this._disposed) return;
    this.lastRenderTime = performance.now();
    this.renderFrameId = window.requestAnimationFrame(this.renderFrame);
  }

  stopRenderLoop(): void {
    if (this.renderFrameId !== null) {
      window.cancelAnimationFrame(this.renderFrameId);
      this.renderFrameId = null;
    }
  }

  markInteractive(durationMs = 1400): void {
    if (this._disposed) return;
    this.interactionBoostUntil = Math.max(this.interactionBoostUntil, performance.now() + durationMs);
  }

  setPreviewScale(scale: number): void {
    if (this._disposed) return;
    const safeScale = Number.isFinite(scale) ? Math.min(Math.max(scale, 0.5), 1.8) : 1;
    if (Math.abs(safeScale - this.previewScale) < 0.001) return;

    this.previewScale = safeScale;
    this.modelWrapper.scale.setScalar(MODEL_SCALE * this.previewScale);
    this.render();
  }

  async loadSkin(
    skinKey: string,
    urlOrSource: string,
    model?: SkinModelVariant | 'auto-detect',
  ): Promise<void> {
    if (this._disposed) return;
    const nextModel = toModelVariant(model);
    if (skinKey === this.lastLoadedSkinKey && nextModel === this.currentModel) return;
    await this.forceLoadSkin(skinKey, urlOrSource, nextModel);
  }

  async forceLoadSkin(
    skinKey: string,
    urlOrSource: string,
    model?: SkinModelVariant | 'auto-detect',
  ): Promise<void> {
    if (this._disposed) return;
    const loadVersion = ++this.skinLoadVersion;
    this.lastSkinSource = urlOrSource;
    this.currentModel = toModelVariant(model);
    const texture = await loadModrinthTexture(urlOrSource);
    if (this._disposed || loadVersion !== this.skinLoadVersion) return;
    this.currentTexture = texture;
    await this.loadModelForCurrentVariant(loadVersion);
    if (this._disposed || loadVersion !== this.skinLoadVersion) return;
    this.lastLoadedSkinKey = skinKey;
    this.markInteractive();
    this._canvas.style.opacity = '1';
  }

  setSkinModel(model: SkinModelVariant): void {
    if (this._disposed || this.currentModel === model) return;
    this.currentModel = model;
    void this.forceLoadSkin(`model:${model}:${this.lastSkinSource}`, this.lastSkinSource, model);
  }

  async loadCape(
    capeKey: string,
    urlOrSource: string,
    _backEquipment: BackEquipmentVariant = 'cape',
  ): Promise<void> {
    if (this._disposed) return;
    if (capeKey === this.lastLoadedCapeKey) return;
    await this.forceLoadCape(capeKey, urlOrSource);
  }

  async forceLoadCape(
    capeKey: string,
    urlOrSource: string,
    _backEquipment: BackEquipmentVariant = 'cape',
  ): Promise<void> {
    if (this._disposed) return;
    const loadVersion = ++this.capeLoadVersion;
    const capeTexture = await loadModrinthTexture(urlOrSource);
    if (this._disposed || loadVersion !== this.capeLoadVersion) return;
    this.currentCapeTexture = capeTexture;
    if (this.playerModel) {
      applyCapeTexture(this.playerModel, this.currentCapeTexture, this.transparentTexture);
    }
    this.lastLoadedCapeKey = capeKey;
    this.markInteractive();
  }

  clearCape(): void {
    if (this._disposed) return;
    this.capeLoadVersion++;
    this.currentCapeTexture = null;
    this.lastLoadedCapeKey = null;
    if (this.playerModel) {
      applyCapeTexture(this.playerModel, null, this.transparentTexture);
    }
    this.markInteractive();
  }

  async resetToDefaultSkin(): Promise<void> {
    await this.forceLoadSkin('default:steve', this.defaultSkinUrl, 'classic');
  }

  playAnimation(id: string): boolean {
    if (this._disposed) return false;
    return this.playMixerAnimation(this.normalizeAnimationId(id), false);
  }

  playTransientAnimation(id: string, durationMs = 1400, fallbackId = BASE_ANIMATION): boolean {
    const resolvedId = this.normalizeAnimationId(id);
    const played = this.playMixerAnimation(resolvedId, true);
    if (!played) return false;

    if (this.transientAnimationTimerId !== null) {
      clearTimeout(this.transientAnimationTimerId);
    }

    if (!this.actions.has(resolvedId)) {
      this.transientAnimationTimerId = setTimeout(() => {
        this.playAnimation(fallbackId);
        this.transientAnimationTimerId = null;
      }, durationMs);
    }

    return true;
  }

  setAnimation(_animation: unknown, id = BASE_ANIMATION): void {
    this.playAnimation(id);
  }

  addToRandomIdlePool(id: string, weight: number): void {
    const resolvedId = this.normalizeAnimationId(id);
    this.randomIdlePool = this.randomIdlePool.filter((entry) => entry.id !== resolvedId);
    this.randomIdlePool.push({ id: resolvedId, weight });
  }

  removeFromRandomIdlePool(id: string): void {
    const resolvedId = this.normalizeAnimationId(id);
    this.randomIdlePool = this.randomIdlePool.filter((entry) => entry.id !== resolvedId);
  }

  registerAnimationClip(id: string, clip: THREE.AnimationClip, options: CustomAnimationOptions = {}): boolean {
    if (this._disposed || !id.trim()) return false;

    const animationId = id.trim();
    const clipCopy = clip.clone();
    clipCopy.name = animationId;

    this.customClips.set(animationId, clipCopy);
    this.animationLoopModes.set(animationId, options.loop ?? 'once');
    this.registerAction(animationId, clipCopy, options.loop ?? 'once');

    if (options.randomIdle) {
      this.addToRandomIdlePool(animationId, options.weight ?? 1);
    }

    return true;
  }

  async importAnimationGltf(
    source: string | Blob,
    options: ImportAnimationOptions = {},
  ): Promise<string[]> {
    if (this._disposed) return [];

    const gltf = await loadModrinthAnimationSource(source);
    const selectedClips = options.clipName
      ? gltf.animations.filter((clip) => clip.name === options.clipName)
      : gltf.animations;

    const registeredIds: string[] = [];
    for (const clip of selectedClips) {
      const id = options.id && selectedClips.length === 1 ? options.id : clip.name;
      if (this.registerAnimationClip(id, clip, options)) {
        registeredIds.push(id);
      }
    }

    return registeredIds;
  }

  getAvailableAnimations(): string[] {
    return Array.from(this.actions.keys());
  }

  set randomIdleEnabled(enabled: boolean) {
    this._randomIdleEnabled = enabled;
    if (enabled) {
      this.scheduleNextRandomIdle();
    } else {
      this.cancelRandomIdleTimer();
    }
  }

  get randomIdleEnabled(): boolean {
    return this._randomIdleEnabled;
  }

  destroy(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.stopRenderLoop();
    this.cancelRandomIdleTimer();

    if (this.transientAnimationTimerId !== null) {
      clearTimeout(this.transientAnimationTimerId);
      this.transientAnimationTimerId = null;
    }

    this._canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this._canvas.removeEventListener('pointermove', this.handlePointerMove);
    this._canvas.removeEventListener('pointerup', this.handlePointerUp);
    this._canvas.removeEventListener('pointerleave', this.handlePointerUp);

    this.mixer?.stopAllAction();
    this.controls.dispose();
    if (this.playerModel) disposeObjectTree(this.playerModel);
    this.transparentTexture.dispose();
    this.renderer.dispose();

    this.actions.clear();
    this.randomIdlePool = [];
    this.customClips.clear();
    this.animationLoopModes.clear();
    this.lastLoadedSkinKey = null;
    this.lastLoadedCapeKey = null;

    if (SkinEngine.instance === this) {
      SkinEngine.instance = null;
    }
  }

  private async loadModelForCurrentVariant(loadVersion: number): Promise<void> {
    const loadToken = `${this.currentModel}:${this.lastSkinSource}`;
    const gltf = await loadModrinthModel(modelUrlForVariant(this.currentModel));
    if (
      this._disposed ||
      loadVersion !== this.skinLoadVersion ||
      loadToken !== `${this.currentModel}:${this.lastSkinSource}`
    ) {
      return;
    }

    const nextModel = cloneModelScene(gltf.scene);
    if (this.currentTexture) {
      applyPlayerTexture(nextModel, this.currentTexture);
    }
    applyCapeTexture(nextModel, this.currentCapeTexture, this.transparentTexture);

    if (this.playerModel) {
      this.modelWrapper.remove(this.playerModel);
      disposeObjectTree(this.playerModel);
    }

    this.playerModel = nextModel;
    this.modelWrapper.add(nextModel);
    this.initializeAnimations(gltf.animations);
    this.updateCameraTarget();
    this.render();
  }

  private initializeAnimations(clips: THREE.AnimationClip[]): void {
    this.mixer?.stopAllAction();
    this.actions.clear();

    if (!this.playerModel || clips.length === 0) return;

    this.mixer = new THREE.AnimationMixer(this.playerModel);
    for (const clip of clips) {
      const loop = clip.name === BASE_ANIMATION ? 'repeat' : 'once';
      this.animationLoopModes.set(clip.name, loop);
      this.registerAction(clip.name, clip, loop);
    }

    for (const [id, clip] of this.customClips) {
      this.registerAction(id, clip, this.animationLoopModes.get(id) ?? 'once');
    }

    this.playMixerAnimation(BASE_ANIMATION, false);
  }

  private registerAction(id: string, clip: THREE.AnimationClip, loop: AnimationLoopMode): void {
    if (!this.mixer) return;

    const oldAction = this.actions.get(id);
    if (oldAction) {
      oldAction.stop();
      this.actions.delete(id);
    }

    const action = this.mixer.clipAction(clip);
    action.setLoop(loop === 'repeat' ? THREE.LoopRepeat : THREE.LoopOnce, loop === 'repeat' ? Infinity : 1);
    action.clampWhenFinished = loop === 'once';
    this.actions.set(id, action);
  }

  private playMixerAnimation(id: string, transient: boolean): boolean {
    const action = this.actions.get(id);
    if (!this.mixer || !action) {
      console.warn(`[SkinEngine] GLTF animation is not registered: ${id}`);
      return false;
    }

    if (this.currentAnimationId === id && action.isRunning() && id !== BASE_ANIMATION) {
      return false;
    }

    for (const [name, candidate] of this.actions) {
      if (name !== id && candidate.isRunning()) {
        candidate.fadeOut(TRANSITION_SECONDS);
      }
    }

    action.reset();
    const shouldRepeat = !transient && (this.animationLoopModes.get(id) ?? 'once') === 'repeat';
    if (shouldRepeat) {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
    } else {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      const onFinished = (event: { action: THREE.AnimationAction }) => {
        if (event.action !== action) return;
        this.mixer?.removeEventListener('finished', onFinished);
        if (this.currentAnimationId === id) {
          this.returnToBaseAnimation();
        }
      };
      this.mixer.addEventListener('finished', onFinished);
    }

    action.fadeIn(TRANSITION_SECONDS);
    action.play();
    this.currentAnimationId = id;
    this.markInteractive();
    return true;
  }

  private returnToBaseAnimation(): void {
    const baseAction = this.actions.get(BASE_ANIMATION);
    if (!baseAction) return;
    baseAction.reset();
    baseAction.setLoop(THREE.LoopRepeat, Infinity);
    baseAction.fadeIn(TRANSITION_SECONDS);
    baseAction.play();
    this.currentAnimationId = BASE_ANIMATION;
    this.scheduleNextRandomIdle();
  }

  private normalizeAnimationId(id: string): string {
    if (id === 'walking') return 'idle_sub_1';
    if (id === 'running') return 'idle_sub_2';
    if (id === 'wave') return INTERACT_ANIMATION;
    return id;
  }

  private scheduleNextRandomIdle(): void {
    this.cancelRandomIdleTimer();
    if (!this._randomIdleEnabled || this.randomIdlePool.length === 0 || this._disposed) return;

    const [min, max] = this.randomIdleInterval;
    this.randomIdleTimerId = setTimeout(() => {
      if (this._disposed || !this._randomIdleEnabled || this.currentAnimationId !== BASE_ANIMATION) {
        this.scheduleNextRandomIdle();
        return;
      }

      const chosen = weightedRandom(this.randomIdlePool);
      this.playMixerAnimation(chosen.id, true);
    }, randomBetween(min, max));
  }

  private cancelRandomIdleTimer(): void {
    if (this.randomIdleTimerId !== null) {
      clearTimeout(this.randomIdleTimerId);
      this.randomIdleTimerId = null;
    }
  }

  private updateCameraTarget(): void {
    if (!this.playerModel) return;
    this.camera.position.copy(CAMERA_POSITION);
    this.controls.target.copy(CAMERA_TARGET);
    this.controls.update();
  }

  private renderFrame = (now: number): void => {
    if (this._disposed) {
      this.stopRenderLoop();
      return;
    }

    this.renderFrameId = window.requestAnimationFrame(this.renderFrame);

    const targetFps = now < this.interactionBoostUntil ? this.targetFps : this.idleFps;
    const frameIntervalMs = 1000 / targetFps;
    const elapsed = now - this.lastRenderTime;
    if (elapsed < frameIntervalMs) return;

    const dt = Math.min(elapsed / 1000, 0.1);
    this.lastRenderTime = now - (elapsed % frameIntervalMs);
    this.mixer?.update(dt);
    this.controls.update();
    this.render();
  };

  private render(): void {
    if (this._disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  private handlePointerDown = (event: PointerEvent): void => {
    this.isPointerDown = true;
    this.pointerMoved = false;
    this.previousPointerX = event.clientX;
    this._canvas.setPointerCapture(event.pointerId);
    this.markInteractive();
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.isPointerDown) return;
    const deltaX = event.clientX - this.previousPointerX;
    if (Math.abs(deltaX) > 0) {
      this.playerWrapper.rotation.y += deltaX * 0.01;
      this.pointerMoved = this.pointerMoved || Math.abs(deltaX) > 2;
      this.previousPointerX = event.clientX;
      this.markInteractive();
    }
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    if (this._canvas.hasPointerCapture(event.pointerId)) {
      this._canvas.releasePointerCapture(event.pointerId);
    }
    if (!this.pointerMoved && this.actions.has(INTERACT_ANIMATION)) {
      this.playTransientAnimation(INTERACT_ANIMATION);
    }
    this.pointerMoved = false;
  };

  private registerBeforeUnload(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('beforeunload', () => {
      this.destroy();
    });
  }
}
