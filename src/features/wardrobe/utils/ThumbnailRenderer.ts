import { SkinViewer } from 'skinview3d';

type RenderTask = () => Promise<void>;

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
  private viewer: SkinViewer | null = null;
  private queue: RenderTask[] = [];
  private isProcessing = false;
  private inFlight = new Map<string, Promise<string>>();
  private memoryCache = new Map<string, string>();
  private diskCache = new PersistentCache();
  private readonly maxMemoryEntries = 160;

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

  private getCacheKey(type: 'skin' | 'cape', url: string, extra: string): string {
    return `${type}_v4_${url}_${extra}`;
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
      this.getOrRender(frontKey, () => this.renderSkinAngle(skinUrl, model, -Math.PI / 8, options)),
      this.getOrRender(backKey, () => this.renderSkinAngle(skinUrl, model, Math.PI - Math.PI / 8, options)),
    ]);

    return { front, back };
  }

  private async renderSkinAngle(
    skinUrl: string,
    model: 'default' | 'slim',
    rotationY: number,
    options?: { fullBody?: boolean; width?: number; height?: number }
  ): Promise<string> {
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
      v.controls.target.set(0, 0, 0);
    } else {
      v.zoom = 1.08;
      v.fov = 34;
      v.controls.target.set(0, 10, 0);
    }

    v.playerWrapper.rotation.y = rotationY;
    v.controls.update();
    v.render();

    return v.canvas.toDataURL('image/webp', 0.88);
  }

  public async renderCape(capeUrl: string): Promise<string> {
    const cacheKey = this.getCacheKey('cape', capeUrl, 'default');

    return this.getOrRender(cacheKey, async () => {
      const v = this.getViewer();
      v.loadSkin(null);
      await v.loadCape(capeUrl);

      v.zoom = 1.35;
      v.fov = 40;
      v.playerWrapper.rotation.y = Math.PI;
      v.controls.target.set(0, 2, 0);
      v.controls.update();

      v.render();
      return v.canvas.toDataURL('image/webp', 0.88);
    });
  }
}

export const ThumbnailRenderer = new ThumbnailRendererClass();
