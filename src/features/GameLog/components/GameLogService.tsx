// src/features/GameLog/components/GameLogService.tsx
//
// Headless, always-mounted component that owns all Tauri event listeners.
// Populates useGameLogStore regardless of whether GameLogSidebar is shown,
// so LaunchingAnimation (and any other consumers) always receive live logs.

import React, { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
  const handledRunningInstanceRef = useRef<string | null>(null);

  useLogService({
    forceLauncherToFront,
    restoreLauncherAfterGameExit
  });

  // 1. 精确监听 gameState 变化，仅在状态转移时触发，彻底消除高频日志导致的回调空转
  useEffect(() => {
    return useGameLogStore.subscribe(
      (state) => state.gameState,
      (gameState, previousGameState) => {
        if (gameState === 'launching') {
          handledRunningInstanceRef.current = null;
          return;
        }

        if (gameState !== 'running' || previousGameState === 'running') return;

        const currentInstanceId = useGameLogStore.getState().currentInstanceId;
        const instanceKey = currentInstanceId ?? '__unknown__';
        if (handledRunningInstanceRef.current === instanceKey) return;
        handledRunningInstanceRef.current = instanceKey;

        const launcherVisibility = useSettingsStore.getState().settings.game.launcherVisibility;
        void applyLauncherVisibility(launcherVisibility);
      }
    );
  }, [applyLauncherVisibility]);

  // 2. 精确监听 isOpen 变化，按需同步 Rust IPC 流控状态；若展开时日志为空则按需回填
  useEffect(() => {
    return useGameLogStore.subscribe(
      (state) => state.isOpen,
      (isOpen) => {
        invoke('set_game_log_streaming', { enabled: isOpen }).catch((err) => {
          console.warn('[GameLogService] Failed to set log streaming state:', err);
        });

        if (isOpen && useGameLogStore.getState().logs.length === 0) {
          invoke<string[]>('get_recent_game_logs')
            .then((recentLogs) => {
              if (recentLogs && recentLogs.length > 0) {
                useGameLogStore.getState().addLogs(recentLogs);
              }
            })
            .catch((err) => {
              console.warn('[GameLogService] Failed to fetch recent logs on open:', err);
            });
        }
      }
    );
  }, []);

  React.useEffect(() => {
    console.log('[GameLogService] Headless log service mounted!');
    return () => console.log('[GameLogService] Headless log service UNMOUNTED!');
  }, []);

  return null;
};
