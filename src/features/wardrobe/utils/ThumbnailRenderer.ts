import * as THREE from 'three';
import classicPlayerModelUrl from '../../../assets/models/classic-player.gltf?url';
import slimPlayerModelUrl from '../../../assets/models/slim-player.gltf?url';
import {
  applyCapeTexture,
  applyPlayerTexture,
  cloneModelScene,
  createTransparentTexture,
  disposeObjectTree,
  enableSampleAlphaToCoverage,
  loadModrinthModel,
  loadModrinthTexture,
} from '../../home/engine/modrinthSkinRendering';

type RenderTask = () => Promise<void>;

const FRONT_ROTATION_Y = Math.PI;
const BACK_ROTATION_Y = 0;
const LIVE_MODEL_SCALE = 0.76;
const FULL_BODY_MODEL_SCALE = 0.98;
const FULL_BODY_MODEL_OFFSET_Y = 0.0;
const FULL_BODY_CAMERA_POSITION = new THREE.Vector3(0, 1.22, -3.45);
const FULL_BODY_CAMERA_TARGET = new THREE.Vector3(0, 0.98, 0);
const CARD_MODEL_SCALE = 0.8;
const CARD_MODEL_POSITION = new THREE.Vector3(0, 0.3, 1.95);
const CARD_FRONT_CAMERA_POSITION = new THREE.Vector3(-1.3, 1, 6.3);
const CARD_BACK_CAMERA_POSITION = new THREE.Vector3(-1.3, 1, -2.5);
const CARD_CAMERA_FOV = 20;
const CAPE_MODEL_SCALE = 1.02;

export interface SkinThumbnailResult {
  front: string;
  back: string;
}

class PersistentCache {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'pi-wardrobe-thumbnails';
  private readonly STORE_NAME = 'thumbnails';

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  public async get(key: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(this.STORE_NAME, 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  public async set(key: string, value: string): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(this.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      store.put(value, key);
    } catch (e) {
      console.warn('[PersistentCache] Failed to save:', e);
    }
  }
}

class ThumbnailRendererClass {
  private renderer: THREE.WebGLRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private modelRoot: THREE.Group | null = null;
  private currentModel: THREE.Object3D | null = null;
  private transparentTexture: THREE.Texture | null = null;
  private queue: RenderTask[] = [];
  private isProcessing = false;
  private inFlight = new Map<string, Promise<string>>();
  private memoryCache = new Map<string, string>();
  private diskCache = new PersistentCache();
  private readonly maxMemoryEntries = 160;

  private ensureRenderer(): {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    modelRoot: THREE.Group;
    transparentTexture: THREE.Texture;
  } {
    if (this.renderer && this.scene && this.camera && this.modelRoot && this.transparentTexture) {
      return {
        renderer: this.renderer,
        scene: this.scene,
        camera: this.camera,
        modelRoot: this.modelRoot,
        transparentTexture: this.transparentTexture,
      };
    }

    this.canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 10;
    this.renderer.setPixelRatio(1);
    enableSampleAlphaToCoverage(this.renderer);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 120 / 160, 0.1, 100);
    this.camera.position.set(0, 1.26, -4.15);
    this.camera.lookAt(0, 0.98, 0);

    this.modelRoot = new THREE.Group();
    this.modelRoot.position.set(0, 0.04, 0);
    this.modelRoot.scale.setScalar(LIVE_MODEL_SCALE);
    this.scene.add(this.modelRoot);
    this.scene.add(new THREE.AmbientLight(0xffffff, 2));

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(2, 4, 3);
    this.scene.add(directionalLight);

    this.transparentTexture = createTransparentTexture();
    return {
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      modelRoot: this.modelRoot,
      transparentTexture: this.transparentTexture,
    };
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          console.error('[ThumbnailRenderer] Task failed:', error);
        }
      }
    }

    this.isProcessing = false;
  }

  private getCacheKey(type: 'skin' | 'cape', url: string, extra: string): string {
    return `${type}_gltf_v10_${url}_${extra}`;
  }

  private getPlayerModelUrl(model: 'default' | 'slim'): string {
    return model === 'slim' ? slimPlayerModelUrl : classicPlayerModelUrl;
  }

  private setMemoryCache(key: string, value: string): void {
    if (this.memoryCache.has(key)) {
      this.memoryCache.delete(key);
    }

    this.memoryCache.set(key, value);

    while (this.memoryCache.size > this.maxMemoryEntries) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (!oldestKey) break;
      this.memoryCache.delete(oldestKey);
    }
  }

  private async getOrRender(cacheKey: string, render: () => Promise<string>): Promise<string> {
    const memMatch = this.memoryCache.get(cacheKey);
    if (memMatch) return memMatch;

    const diskMatch = await this.diskCache.get(cacheKey);
    if (diskMatch) {
      this.setMemoryCache(cacheKey, diskMatch);
      return diskMatch;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) return pending;

    const promise = new Promise<string>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const dataUrl = await render();
          this.setMemoryCache(cacheKey, dataUrl);
          void this.diskCache.set(cacheKey, dataUrl);
          resolve(dataUrl);
        } catch (e) {
          reject(e);
        } finally {
          this.inFlight.delete(cacheKey);
        }
      });
      void this.processQueue();
    });

    this.inFlight.set(cacheKey, promise);
    return promise;
  }

  public getMemoryCached(type: 'skin' | 'cape', url: string, extra: string): string | null {
    return this.memoryCache.get(this.getCacheKey(type, url, extra)) || null;
  }

  public getMemoryCachedSkinViews(
    skinUrl: string,
    model: 'default' | 'slim',
    options?: { fullBody?: boolean; width?: number; height?: number }
  ): SkinThumbnailResult | null {
    const sizeKey = `${model}_${!!options?.fullBody}_${options?.width || 120}x${options?.height || 160}`;
    const front = this.getMemoryCached('skin', skinUrl, `${sizeKey}_front`);
    const back = this.getMemoryCached('skin', skinUrl, `${sizeKey}_back`);
    return front && back ? { front, back } : null;
  }

  public async renderSkin(
    skinUrl: string,
    model: 'default' | 'slim',
    options?: { fullBody?: boolean; width?: number; height?: number }
  ): Promise<string> {
    const views = await this.renderSkinViews(skinUrl, model, options);
    return views.front;
  }

  public async renderSkinViews(
    skinUrl: string,
    model: 'default' | 'slim',
    options?: { fullBody?: boolean; width?: number; height?: number }
  ): Promise<SkinThumbnailResult> {
    const sizeKey = `${model}_${!!options?.fullBody}_${options?.width || 120}x${options?.height || 160}`;
    const frontKey = this.getCacheKey('skin', skinUrl, `${sizeKey}_front`);
    const backKey = this.getCacheKey('skin', skinUrl, `${sizeKey}_back`);

    const [front, back] = await Promise.all([
      this.getOrRender(frontKey, () => this.renderSkinView(skinUrl, model, 'front', options)),
      this.getOrRender(backKey, () => this.renderSkinView(skinUrl, model, 'back', options)),
    ]);

    return { front, back };
  }

  private async renderSkinView(
    skinUrl: string,
    model: 'default' | 'slim',
    view: 'front' | 'back',
    options?: { fullBody?: boolean; width?: number; height?: number }
  ): Promise<string> {
    const { renderer, camera, modelRoot, transparentTexture } = this.ensureRenderer();
    const width = options?.width || 120;
    const height = options?.height || 160;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;

    const gltf = await loadModrinthModel(this.getPlayerModelUrl(model));
    const texture = await loadModrinthTexture(skinUrl);
    this.replaceModel(cloneModelScene(gltf.scene));
    if (this.currentModel) {
      applyPlayerTexture(this.currentModel, texture);
      applyCapeTexture(this.currentModel, null, transparentTexture);
      this.currentModel.rotation.y = options?.fullBody
        ? (view === 'front' ? FRONT_ROTATION_Y - Math.PI / 8 : BACK_ROTATION_Y - Math.PI / 8)
        : 0;
    }

    if (options?.fullBody) {
      camera.fov = 40;
      camera.position.copy(FULL_BODY_CAMERA_POSITION);
      camera.lookAt(FULL_BODY_CAMERA_TARGET);
      modelRoot.position.set(0, FULL_BODY_MODEL_OFFSET_Y, 0);
      modelRoot.scale.setScalar(FULL_BODY_MODEL_SCALE);
    } else {
      camera.fov = CARD_CAMERA_FOV;
      modelRoot.position.copy(CARD_MODEL_POSITION);
      modelRoot.scale.setScalar(CARD_MODEL_SCALE);
      modelRoot.updateMatrixWorld(true);

      const lookAtTarget = new THREE.Vector3(0, 1, CARD_MODEL_POSITION.z);
      const head = this.currentModel?.getObjectByName('Head');
      if (head) {
        head.getWorldPosition(lookAtTarget);
        lookAtTarget.y -= 0.3;
      }

      camera.position.copy(view === 'front' ? CARD_FRONT_CAMERA_POSITION : CARD_BACK_CAMERA_POSITION);
      camera.lookAt(lookAtTarget);
    }

    camera.updateProjectionMatrix();
    renderer.render(this.scene!, camera);
    return renderer.domElement.toDataURL('image/webp', 0.92);
  }

  public async renderCape(
    capeUrl: string,
    skinUrl = 'https://minotar.net/skin/Steve.png',
    model: 'default' | 'slim' = 'default',
  ): Promise<string> {
    const cacheKey = this.getCacheKey('cape', capeUrl, `${model}_${skinUrl}`);

    return this.getOrRender(cacheKey, async () => {
      const { renderer, camera, modelRoot, transparentTexture } = this.ensureRenderer();
      renderer.setSize(360, 504, false);
      camera.aspect = 360 / 504;
      camera.fov = 34;
      camera.position.set(0, 1.18, -3.4);
      camera.lookAt(0, 0.96, 0);
      camera.updateProjectionMatrix();
      modelRoot.position.set(0, -0.22, 0);
      modelRoot.scale.setScalar(CAPE_MODEL_SCALE);

      const [gltf, skinTexture, capeTexture] = await Promise.all([
        loadModrinthModel(this.getPlayerModelUrl(model)),
        loadModrinthTexture(skinUrl),
        loadModrinthTexture(capeUrl),
      ]);

      this.replaceModel(cloneModelScene(gltf.scene));
      if (this.currentModel) {
        applyPlayerTexture(this.currentModel, skinTexture);
        applyCapeTexture(this.currentModel, capeTexture, transparentTexture);
        this.currentModel.rotation.y = BACK_ROTATION_Y;
      }

      renderer.render(this.scene!, camera);
      return renderer.domElement.toDataURL('image/webp', 0.92);
    });
  }

  private replaceModel(model: THREE.Object3D): void {
    const { modelRoot } = this.ensureRenderer();
    if (this.currentModel) {
      modelRoot.remove(this.currentModel);
      disposeObjectTree(this.currentModel);
    }

    this.currentModel = model;
    modelRoot.add(model);
  }
}

export const ThumbnailRenderer = new ThumbnailRendererClass();
