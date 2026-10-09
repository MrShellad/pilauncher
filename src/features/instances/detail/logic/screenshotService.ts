import { convertFileSrc, invoke } from '@tauri-apps/api/core';

export interface ScreenshotItem {
  id: string;
  fileName: string;
  relativePath: string;
  absolutePath: string;
  capturedAt: number;
  modifiedAt: number;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  format: 'png' | 'jpg' | 'jpeg' | 'webp';
  assetUrl: string;
}

type RawScreenshotItem = Omit<ScreenshotItem, 'assetUrl'>;

export interface ScreenshotDeleteResult {
  deletedIds: string[];
  failures: Array<{ id: string; message: string }>;
  recoveryMethod: 'permanent' | 'trash';
}

const convertBlobToPng = async (source: Blob): Promise<Blob> => {
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建图片转换画布');
    context.drawImage(bitmap, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('无法将截图转换为 PNG')),
        'image/png',
      );
    });
  } finally {
    bitmap.close();
  }
};

const getClipboardPng = async (item: ScreenshotItem): Promise<Blob> => {
  const response = await fetch(item.assetUrl);
  if (!response.ok) throw new Error(`读取截图失败（${response.status}）`);
  const source = await response.blob();
  return item.format === 'png'
    ? new Blob([source], { type: 'image/png' })
    : convertBlobToPng(source);
};

export const screenshotService = {
  async list(instanceId: string): Promise<ScreenshotItem[]> {
    const items = await invoke<RawScreenshotItem[]>('list_instance_screenshots', { id: instanceId });
    return items.map((item) => ({
      ...item,
      assetUrl: `${convertFileSrc(item.absolutePath)}?t=${item.modifiedAt}`,
    }));
  },

  openFolder: (instanceId: string) =>
    invoke<void>('open_instance_screenshots_folder', { id: instanceId }),

  reveal: (instanceId: string, screenshotId: string) =>
    invoke<void>('reveal_instance_screenshot', { id: instanceId, screenshotId }),

  delete: (instanceId: string, screenshotIds: string[]) =>
    invoke<ScreenshotDeleteResult>('delete_instance_screenshots', { id: instanceId, screenshotIds }),

  setAsCover: (instanceId: string, screenshotId: string) =>
    invoke<string>('set_instance_cover_from_screenshot', { id: instanceId, screenshotId }),

  async copyImage(item: ScreenshotItem): Promise<void> {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      throw new Error('当前系统不支持复制图片到剪贴板');
    }

    // Keep the clipboard write inside the originating click gesture while the
    // image is loaded and, when needed, converted to the universally supported PNG format.
    const pngBlob = getClipboardPng(item);
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': pngBlob }),
    ]);
  },
};

