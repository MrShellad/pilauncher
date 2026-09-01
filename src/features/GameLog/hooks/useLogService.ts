import { useCallback } from 'react';
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
  const isMinecraftStoppingLog = useCallback((line: string) => {
    return line.includes('[minecraft/Minecraft]: Stopping!');
  }, []);

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

    if (isMinecraftStoppingLog(line)) {
      const store = useGameLogStore.getState();
      store.setGameState('idle');
      void restoreLauncherAfterGameExit();
      triggerPostGameUpdateReminder();
    }
  });

  useEvent('game-log-batch', (batch) => {
    const store = useGameLogStore.getState();
    store.applyLogBatch(batch);

    if (batch.gameState === 'idle' || batch.lines.some(isMinecraftStoppingLog)) {
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

  useEvent('game-exit', (payload) => {
    const store = useGameLogStore.getState();
    if (payload.code !== 0) {
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
