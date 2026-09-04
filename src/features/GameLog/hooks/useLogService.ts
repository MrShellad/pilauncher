import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEvent } from '../../../hooks/useEvent';
import { useGameLogStore } from '../../../store/useGameLogStore';
import { useUpdaterStore } from '../../../hooks/useAppUpdater';

interface UseLogServiceProps {
  forceLauncherToFront: () => Promise<void>;
  restoreLauncherAfterGameExit: () => Promise<void>;
}

export const useLogService = ({
  forceLauncherToFront,
  restoreLauncherAfterGameExit
}: UseLogServiceProps) => {
  const triggerPostGameUpdateReminder = useCallback(() => {
    const updaterStore = useUpdaterStore.getState();
    if (updaterStore.isRemindedLater && updaterStore.updateInfo) {
      updaterStore.setIsUpdateDialogOpen(true);
      updaterStore.setIsRemindedLater(false);
    }
  }, []);

  useEvent('game-log', (line) => {
    // Compatibility path for launcher messages produced before the game process
    // starts. Game stdout/stderr arrives through game-log-batch.
    useGameLogStore.getState().addLogs([line]);
  });

  useEvent('game-log-batch', (batch) => {
    const store = useGameLogStore.getState();
    store.applyLogBatch(batch);

    // 状态流转已由 Rust 端作为唯一真相源解析并下发
    if (batch.gameState === 'idle') {
      store.setGameState('idle');
      void restoreLauncherAfterGameExit();
      triggerPostGameUpdateReminder();
    }
  });

  useEvent('game-log-metrics', (metrics) => {
    console.info('[GameLog] session metrics', metrics);
  });

  useEvent('game-launch-progress', (progress) => {
    useGameLogStore.getState().applyLaunchProgress(progress);
  });

  useEvent('game-exit', async (payload) => {
    const store = useGameLogStore.getState();
    if (payload.code !== 0) {
      // 异常退出时，若此前流控静默导致 store.logs 为空，即时拉取最近日志以支持崩溃分析
      if (store.logs.length === 0) {
        try {
          const recentLogs = await invoke<string[]>('get_recent_game_logs');
          if (recentLogs && recentLogs.length > 0) {
            store.addLogs(recentLogs);
          }
        } catch (err) {
          console.warn('[useLogService] Failed to fetch recent logs on crash:', err);
        }
      }
      store.analyzeCrash();
      store.setOpen(true);
      void forceLauncherToFront();
    } else {
      store.setGameState('idle');
      void restoreLauncherAfterGameExit();
      triggerPostGameUpdateReminder();
    }
  });
};
