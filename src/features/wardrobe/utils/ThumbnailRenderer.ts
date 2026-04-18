import { SkinViewer } from 'skinview3d';

type RenderTask = () => Promise<void>;

/**
 * 硬盘持久化缓存工具 (IndexedDB)
 */
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
    } catch (e) {
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
  private viewer: SkinViewer | null = null;
  private queue: RenderTask[] = [];
  private isProcessing = false;
  
  // 内存缓存：提供当前会话的极速响应
  private memoryCache = new Map<string, string>();
  // 硬盘缓存：跨重启持久化
  private diskCache = new PersistentCache();

  private getViewer(): SkinViewer {
    if (!this.viewer) {
      const canvas = document.createElement('canvas');
      this.viewer = new SkinViewer({
        canvas,
        width: 120,
        height: 160,
        renderPaused: true,
      });
      this.viewer.controls.enabled = false;
    }
    return this.viewer;
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

  /**
   * 生成唯一的缓存键
   */
  private getCacheKey(type: 'skin' | 'cape', url: string, extra: string): string {
    // 简单的 key 生成逻辑
    return `${type}_v2_${url}_${extra}`;
  }

  /**
   * 同步尝试从内存获取缓存 (解决 UI 闪烁)
   */
  public getMemoryCached(type: 'skin' | 'cape', url: string, extra: string): string | null {
    return this.memoryCache.get(this.getCacheKey(type, url, extra)) || null;
  }

  public async renderSkin(
    skinUrl: string, 
    model: 'default' | 'slim', 
    options?: { fullBody?: boolean, width?: number, height?: number }
  ): Promise<string> {
    const extra = `${model}_${!!options?.fullBody}_${options?.width || 120}x${options?.height || 160}`;
    const cacheKey = this.getCacheKey('skin', skinUrl, extra);

    // 1. 尝试内存缓存
    const memMatch = this.memoryCache.get(cacheKey);
    if (memMatch) return memMatch;

    // 2. 尝试硬盘缓存
    const diskMatch = await this.diskCache.get(cacheKey);
    if (diskMatch) {
      this.memoryCache.set(cacheKey, diskMatch);
      return diskMatch;
    }

    // 3. 实在没有，进入 3D 渲染队列
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const v = this.getViewer();
          await v.loadSkin(skinUrl, { model });
          v.loadCape(null);
          
          if (options?.width && options?.height) {
            v.setSize(options.width, options.height);
          } else {
            v.setSize(120, 160);
          }

          if (options?.fullBody) {
             v.zoom = 0.8;
             v.fov = 40;
             v.playerWrapper.rotation.y = -Math.PI / 8;
             v.controls.target.set(0, 0, 0);
          } else {
             v.zoom = 1.08;
             v.fov = 34;
             v.playerWrapper.rotation.y = -Math.PI / 8;
             v.controls.target.set(0, 10, 0);
          }
          
          v.controls.update();
          v.render();

          const dataUrl = v.canvas.toDataURL();
          
          // 存入两级缓存
          this.memoryCache.set(cacheKey, dataUrl);
          void this.diskCache.set(cacheKey, dataUrl);

          resolve(dataUrl);
        } catch (e) {
          reject(e);
        }
      });
      void this.processQueue();
    });
  }

  public async renderCape(capeUrl: string): Promise<string> {
    const cacheKey = this.getCacheKey('cape', capeUrl, 'default');

    const memMatch = this.memoryCache.get(cacheKey);
    if (memMatch) return memMatch;

    const diskMatch = await this.diskCache.get(cacheKey);
    if (diskMatch) {
      this.memoryCache.set(cacheKey, diskMatch);
      return diskMatch;
    }

    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const v = this.getViewer();
          v.loadSkin(null);
          await v.loadCape(capeUrl);
          
          v.zoom = 1.35;
          v.fov = 40;
          v.playerWrapper.rotation.y = Math.PI;
          v.controls.target.set(0, 9, 0);
          v.controls.update();
          
          v.render();
          const dataUrl = v.canvas.toDataURL();

          this.memoryCache.set(cacheKey, dataUrl);
          void this.diskCache.set(cacheKey, dataUrl);

          resolve(dataUrl);
        } catch (e) {
          reject(e);
        }
      });
      void this.processQueue();
    });
  }
}

export const ThumbnailRenderer = new ThumbnailRendererClass();
