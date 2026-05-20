import { open as openExternal } from '@tauri-apps/plugin-shell';

export const openExternalLink = async (url?: string) => {
  if (!url) {
    return;
  }

  try {
    await openExternal(url);
  } catch (error) {
    console.warn('Tauri shell open failed, falling back to window.open', error);
    window.open(url, '_blank');
  }
};
