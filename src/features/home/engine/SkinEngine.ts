// src/features/home/engine/SkinEngine.ts
// ════════════════════════════════════════════════════════════════
// 独立的 3D 皮肤渲染引擎（与 React 完全解耦）
// 负责 SkinViewer 单例生命周期、渲染循环、皮肤加载、动画管理、
// Three.js 资源清理。后续商城扩展动作/道具/特效均挂载到此引擎。
// ════════════════════════════════════════════════════════════════

import {
  SkinViewer,
  IdleAnimation,
  WalkingAnimation,
  RunningAnimation,
  WaveAnimation,
  type PlayerAnimation,
} from 'skinview3d';

// ─── 类型定义 ───────────────────────────────────────────────────

/** 内置动画枚举（后续可扩展为商城道具动作） */
export type AnimationPreset = 'idle' | 'walking' | 'running' | 'wave';

/** 引擎初始化配置 */
export interface SkinEngineOptions {
  /** 默认皮肤 URL */
  defaultSkinUrl?: string;
  /** 渲染帧率上限 */
  targetFps?: number;
  /** 初始 canvas 宽度 */
  width?: number;
  /** 初始 canvas 高度 */
  height?: number;
  /** 是否启用待机随机动画 */
  enableRandomIdle?: boolean;
  /** 待机动画切换间隔范围（毫秒） [min, max] */
  randomIdleInterval?: [number, number];
}

/** 随机待机配置项 */
interface RandomIdleEntry {
  id: string;
  /** 权重（越大越容易被选中） */
  weight: number;
}

// ─── 默认值 ──────────────────────────────────────────────────────

const DEFAULT_SKIN_URL = 'https://minotar.net/skin/Steve.png';
const DEFAULT_FPS = 60;
const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 450;
const DEFAULT_RANDOM_IDLE_INTERVAL: [number, number] = [4000, 10000];

// ─── 动画注册表 ─────────────────────────────────────────────────

type AnimationFactory = () => PlayerAnimation;

const builtinAnimations: Record<AnimationPreset, AnimationFactory> = {
  idle: () => new IdleAnimation(),
  walking: () => {
    const anim = new WalkingAnimation();
    anim.speed = 0.6;
    return anim;
  },
  running: () => {
    const anim = new RunningAnimation();
    anim.speed = 0.7;
    return anim;
  },
  wave: () => new WaveAnimation(),
};

/** 待机随机池：权重基随机，idle 占大头 */
const defaultRandomIdlePool: RandomIdleEntry[] = [
  { id: 'idle', weight: 5 },
  { id: 'wave', weight: 2 },
  { id: 'walking', weight: 2 },
  { id: 'running', weight: 1 },
];

// ─── 工具函数 ───────────────────────────────────────────────────

function deepDisposeScene(viewer: SkinViewer): void {
  viewer.scene.traverse((object: any) => {
    if (object.geometry) {
      object.geometry.dispose();
    }
    if (object.material) {
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const mat of materials) {
        if (mat.map) mat.map.dispose();
        if (mat.lightMap) mat.lightMap.dispose();
        if (mat.bumpMap) mat.bumpMap.dispose();
        if (mat.normalMap) mat.normalMap.dispose();
        if (mat.specularMap) mat.specularMap.dispose();
        if (mat.envMap) mat.envMap.dispose();
        if (mat.emissiveMap) mat.emissiveMap.dispose();
        mat.dispose();
      }
    }
  });
  viewer.dispose();
}

/** 基于权重的加权随机选择 */
function weightedRandom<T extends { weight: number }>(pool: T[]): T {
  const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * totalWeight;
  for (const entry of pool) {
    r -= entry.weight;
    if (r <= 0) return entry;
  }
  return pool[pool.length - 1];
}

/** 在 [min, max] 范围内随机取整 */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ═══════════════════════════════════════════════════════════════
// SkinEngine（单例）
// ═══════════════════════════════════════════════════════════════

export class SkinEngine {
  // ─── 单例 ────────────────────────────────────────────────────
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

  // ─── 内部状态 ────────────────────────────────────────────────
  private viewer: SkinViewer;
  private _canvas: HTMLCanvasElement;
  private _disposed = false;
  private renderIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastLoadedSkinKey: string | null = null;
  private _currentAnimationId: string = 'idle';

  /** 自定义动画注册表（合并内置 + 外部注入） */
  private animationRegistry: Map<string, AnimationFactory> = new Map();

  /** 随机待机系统 */
  private randomIdlePool: RandomIdleEntry[] = [...defaultRandomIdlePool];
  private randomIdleTimerId: ReturnType<typeof setTimeout> | null = null;
  private randomIdleInterval: [number, number];
  private _randomIdleEnabled: boolean;

  /** 配置 */
  readonly defaultSkinUrl: string;
  readonly targetFps: number;
  private readonly frameIntervalMs: number;

  // ─── 构建 ────────────────────────────────────────────────────

  private constructor(options?: SkinEngineOptions) {
    this.defaultSkinUrl = options?.defaultSkinUrl ?? DEFAULT_SKIN_URL;
    this.targetFps = options?.targetFps ?? DEFAULT_FPS;
    this.frameIntervalMs = 1000 / this.targetFps;
    this._randomIdleEnabled = options?.enableRandomIdle ?? true;
    this.randomIdleInterval = options?.randomIdleInterval ?? DEFAULT_RANDOM_IDLE_INTERVAL;

    // 注册内置动画
    for (const [key, factory] of Object.entries(builtinAnimations)) {
      this.animationRegistry.set(key, factory);
    }

    // 创建离屏 canvas
    this._canvas = document.createElement('canvas');
    this._canvas.className = 'outline-none pointer-events-auto drop-shadow-2xl';
    this._canvas.style.display = 'block';

    // 创建 SkinViewer（renderPaused=true，由引擎接管渲染循环）
    this.viewer = new SkinViewer({
      canvas: this._canvas,
      width: options?.width ?? DEFAULT_WIDTH,
      height: options?.height ?? DEFAULT_HEIGHT,
      skin: this.defaultSkinUrl,
      renderPaused: true,
    });

    this.viewer.animation = new IdleAnimation();
    this.viewer.autoRotate = false;

    // ── 配置 OrbitControls：全身拖拽 ────────────────────────────
    this.viewer.controls.enableRotate = true;
    this.viewer.controls.enableZoom = false;   // 禁止缩放
    this.viewer.controls.enablePan = false;
    // 限制垂直旋转在合理范围内（防止翻转到脚底）
    this.viewer.controls.minPolarAngle = Math.PI * 0.05;  // ≈ 9°
    this.viewer.controls.maxPolarAngle = Math.PI * 0.95;  // ≈ 171°
    this.viewer.controls.update();

    // 注册应用退出时的清理
    this.registerBeforeUnload();

    // 启动随机待机动画
    if (this._randomIdleEnabled) {
      this.scheduleNextRandomIdle();
    }
  }

  // ─── 公开属性 ────────────────────────────────────────────────

  /** 底层 SkinViewer 实例（高级用途） */
  get raw(): SkinViewer {
    return this.viewer;
  }

  /** 引擎管理的 canvas 元素 */
  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  /** 当前是否已销毁 */
  get isDisposed(): boolean {
    return this._disposed;
  }

  /** 渲染循环是否正在运行 */
  get isRendering(): boolean {
    return this.renderIntervalId !== null;
  }

  /** 当前正在播放的动画 ID */
  get currentAnimationId(): string {
    return this._currentAnimationId;
  }

  // ─── 尺寸管理 ────────────────────────────────────────────────

  setSize(width: number, height: number): void {
    if (this._disposed) return;
    this.viewer.width = width;
    this.viewer.height = height;
  }

  // ─── 渲染循环 ────────────────────────────────────────────────

  /** 启动 30 FPS 渲染循环（幂等操作） */
  startRenderLoop(): void {
    if (this.renderIntervalId !== null || this._disposed) return;

    // 确保内置 rAF 循环已停
    this.viewer.renderPaused = true;

    let lastTime = performance.now();

    this.renderIntervalId = setInterval(() => {
      if (this.viewer.disposed) {
        this.stopRenderLoop();
        return;
      }

      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // 推进动画
      const anim = this.viewer.animation;
      if (anim) {
        anim.update(this.viewer.playerObject, dt);
      }

      // 推进 OrbitControls
      this.viewer.controls.update();

      // 渲染帧
      this.viewer.render();
    }, this.frameIntervalMs);
  }

  /** 停止渲染循环（幂等操作） */
  stopRenderLoop(): void {
    if (this.renderIntervalId !== null) {
      clearInterval(this.renderIntervalId);
      this.renderIntervalId = null;
    }
  }

  // ─── 动画系统 ────────────────────────────────────────────────

  /**
   * 注册自定义动画。
   * 可用于商城购买的动作扩展，例如：
   *   engine.registerAnimation('dance', () => new DanceAnimation());
   */
  registerAnimation(id: string, factory: AnimationFactory): void {
    this.animationRegistry.set(id, factory);
  }

  /** 切换到已注册的动画 */
  playAnimation(id: string): boolean {
    if (this._disposed) return false;

    const factory = this.animationRegistry.get(id);
    if (!factory) {
      console.warn(`[SkinEngine] 未注册的动画：${id}`);
      return false;
    }
    this.viewer.animation = factory();
    this._currentAnimationId = id;
    return true;
  }

  /** 直接设置 PlayerAnimation 实例（高级用途） */
  setAnimation(animation: PlayerAnimation | null, id = 'custom'): void {
    if (this._disposed) return;
    this.viewer.animation = animation;
    this._currentAnimationId = id;
  }

  // ─── 随机待机动画系统 ────────────────────────────────────────

  /** 向随机待机池中添加动画（商城扩展用） */
  addToRandomIdlePool(id: string, weight: number): void {
    // 避免重复
    this.randomIdlePool = this.randomIdlePool.filter(e => e.id !== id);
    this.randomIdlePool.push({ id, weight });
  }

  /** 从随机待机池中移除动画 */
  removeFromRandomIdlePool(id: string): void {
    this.randomIdlePool = this.randomIdlePool.filter(e => e.id !== id);
  }

  /** 启用/禁用随机待机 */
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

  /** 内部：调度下一次随机切换 */
  private scheduleNextRandomIdle(): void {
    this.cancelRandomIdleTimer();

    const [min, max] = this.randomIdleInterval;
    const delay = randomBetween(min, max);

    this.randomIdleTimerId = setTimeout(() => {
      if (this._disposed || !this._randomIdleEnabled) return;

      // 加权随机选一个动画（避免连续重复）
      let chosen: RandomIdleEntry;
      let attempts = 0;
      do {
        chosen = weightedRandom(this.randomIdlePool);
        attempts++;
      } while (chosen.id === this._currentAnimationId && attempts < 3);

      this.playAnimation(chosen.id);

      // 继续调度下一次
      this.scheduleNextRandomIdle();
    }, delay);
  }

  /** 内部：取消随机待机定时器 */
  private cancelRandomIdleTimer(): void {
    if (this.randomIdleTimerId !== null) {
      clearTimeout(this.randomIdleTimerId);
      this.randomIdleTimerId = null;
    }
  }

  // ─── 皮肤加载 ────────────────────────────────────────────────

  /**
   * 加载皮肤（带去重判断）。
   * @param skinKey 皮肤的唯一标识，相同 key 不会重复加载
   * @param urlOrSource 皮肤 URL 或 TextureSource
   */
  async loadSkin(skinKey: string, urlOrSource: string): Promise<void> {
    if (this._disposed || this.viewer.disposed) return;

    // 去重检查
    if (skinKey === this.lastLoadedSkinKey) return;

    await this.viewer.loadSkin(urlOrSource);
    this.lastLoadedSkinKey = skinKey;
  }

  /** 强制加载皮肤（跳过去重检查） */
  async forceLoadSkin(skinKey: string, urlOrSource: string): Promise<void> {
    if (this._disposed || this.viewer.disposed) return;
    await this.viewer.loadSkin(urlOrSource);
    this.lastLoadedSkinKey = skinKey;
  }

  /** 重置为默认皮肤 */
  async resetToDefaultSkin(): Promise<void> {
    if (this._disposed || this.viewer.disposed) return;
    await this.viewer.loadSkin(this.defaultSkinUrl);
    this.lastLoadedSkinKey = 'default:steve';
  }

  /** 获取上次加载的皮肤 key */
  get loadedSkinKey(): string | null {
    return this.lastLoadedSkinKey;
  }

  // ─── 道具系统（预留扩展） ────────────────────────────────────

  /**
   * 向玩家模型附加道具 Object3D。
   * 后续商城道具（帽子、翅膀、粒子特效等）通过此接口挂载。
   *
   * @example
   *   const hat = new THREE.Mesh(hatGeometry, hatMaterial);
   *   engine.attachToPlayer(hat, 'head');
   */
  // attachProp(prop: THREE.Object3D, bone?: string): void {
  //   // 预留接口：挂载到 playerObject 的指定骨骼
  // }

  // ─── 清理 ────────────────────────────────────────────────────

  /**
   * 深度销毁引擎。
   * 遍历整个 Three.js 场景树释放 geometry、material、texture，
   * 并删除 WebGLRenderer 和 canvas。
   */
  destroy(): void {
    if (this._disposed) return;
    this._disposed = true;

    this.stopRenderLoop();
    this.cancelRandomIdleTimer();

    if (!this.viewer.disposed) {
      deepDisposeScene(this.viewer);
    }

    this.lastLoadedSkinKey = null;
    this.animationRegistry.clear();
    this.randomIdlePool = [];

    if (SkinEngine.instance === this) {
      SkinEngine.instance = null;
    }
  }

  // ─── 内部方法 ────────────────────────────────────────────────

  private registerBeforeUnload(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('beforeunload', () => {
      this.destroy();
    });
  }
}
