import { useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window';
import type { GameSettings } from '../../../types/settings';

type LauncherVisibility = GameSettings['launcherVisibility'];

export const useWindowService = () => {
  const appWindowRef = useRef(getCurrentWindow());
  const foregroundLockRef = useRef(false);
  const launcherHiddenByRuntimeRef = useRef(false);

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

  const applyLauncherVisibility = useCallback(async (mode: LauncherVisibility) => {
    if (mode === 'keep') return;

    if (mode === 'minimize') {
      launcherHiddenByRuntimeRef.current = true;
      await appWindowRef.current.minimize().catch(() => undefined);
      return;
    }

    await invoke('plugin:process|exit', { code: 0 }).catch((error) => {
      console.error('[WindowService] Failed to exit launcher after game start:', error);
    });
  }, []);

  const restoreLauncherAfterGameExit = useCallback(async () => {
    if (!launcherHiddenByRuntimeRef.current) return;
    launcherHiddenByRuntimeRef.current = false;
    await forceLauncherToFront();
  }, [forceLauncherToFront]);

  return { forceLauncherToFront, applyLauncherVisibility, restoreLauncherAfterGameExit };
};
