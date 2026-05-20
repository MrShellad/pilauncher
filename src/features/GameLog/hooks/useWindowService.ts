import { useCallback, useRef } from 'react';
import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window';

export const useWindowService = () => {
  const appWindowRef = useRef(getCurrentWindow());
  const foregroundLockRef = useRef(false);

  const forceLauncherToFront = useCallback(async () => {
    if (foregroundLockRef.current) return;
    foregroundLockRef.current = true;

    const appWindow = appWindowRef.current;
    try {
      const minimized = await appWindow.isMinimized().catch(() => false);
      if (minimized) {
        await appWindow.unminimize().catch(() => undefined);
      }

      await appWindow.show().catch(() => undefined);
      await appWindow.setAlwaysOnTop(true).catch(() => undefined);
      await appWindow.setFocus().catch(() => undefined);
      await appWindow.requestUserAttention(UserAttentionType.Critical).catch(() => undefined);
    } finally {
      setTimeout(() => {
        appWindow.requestUserAttention(null).catch(() => undefined);
        appWindow.setAlwaysOnTop(false).catch(() => undefined);
        foregroundLockRef.current = false;
      }, 900);
    }
  }, []);

  return { forceLauncherToFront };
};
