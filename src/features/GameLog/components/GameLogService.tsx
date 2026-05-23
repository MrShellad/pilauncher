// src/features/GameLog/components/GameLogService.tsx
//
// Headless, always-mounted component that owns all Tauri event listeners.
// Populates useGameLogStore regardless of whether GameLogSidebar is shown,
// so LaunchingAnimation (and any other consumers) always receive live logs.

import React, { useEffect, useRef } from 'react';
import { useWindowService } from '../hooks/useWindowService';
import { useLogService } from '../hooks/useLogService';
import { useGameLogStore } from '../../../store/useGameLogStore';
import { useSettingsStore } from '../../../store/useSettingsStore';

export const GameLogService: React.FC = () => {
  const {
    forceLauncherToFront,
    applyLauncherVisibility,
    restoreLauncherAfterGameExit
  } = useWindowService();
  const previousGameStateRef = useRef(useGameLogStore.getState().gameState);
  const handledRunningInstanceRef = useRef<string | null>(null);

  useLogService({
    forceLauncherToFront,
    restoreLauncherAfterGameExit
  });

  useEffect(() => {
    return useGameLogStore.subscribe((state) => {
      const previousGameState = previousGameStateRef.current;
      previousGameStateRef.current = state.gameState;

      if (state.gameState === 'launching') {
        handledRunningInstanceRef.current = null;
        return;
      }

      if (state.gameState !== 'running' || previousGameState === 'running') return;

      const instanceKey = state.currentInstanceId ?? '__unknown__';
      if (handledRunningInstanceRef.current === instanceKey) return;
      handledRunningInstanceRef.current = instanceKey;

      const launcherVisibility = useSettingsStore.getState().settings.game.launcherVisibility;
      void applyLauncherVisibility(launcherVisibility);
    });
  }, [applyLauncherVisibility]);

  React.useEffect(() => {
    console.log('[GameLogService] Headless log service mounted!');
    return () => console.log('[GameLogService] Headless log service UNMOUNTED!');
  }, []);

  return null;
};
