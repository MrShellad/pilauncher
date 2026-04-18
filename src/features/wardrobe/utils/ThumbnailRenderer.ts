import { SkinViewer } from 'skinview3d';

type RenderTask = () => Promise<void>;

class ThumbnailRendererClass {
  private viewer: SkinViewer | null = null;
  private queue: RenderTask[] = [];
  private isProcessing = false;

  private getViewer(): SkinViewer {
    if (!this.viewer) {
      const canvas = document.createElement('canvas');
      // Fix dimensions for thumbnail
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

  public renderSkin(skinUrl: string, model: 'default' | 'slim', options?: { fullBody?: boolean, width?: number, height?: number }): Promise<string> {
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
          resolve(v.canvas.toDataURL());
        } catch (e) {
          reject(e);
        }
      });
      void this.processQueue();
    });
  }

  public renderCape(capeUrl: string): Promise<string> {
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
          resolve(v.canvas.toDataURL());
        } catch (e) {
          reject(e);
        }
      });
      void this.processQueue();
    });
  }
}

export const ThumbnailRenderer = new ThumbnailRendererClass();
