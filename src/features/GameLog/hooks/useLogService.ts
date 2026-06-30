import { useEffect, useRef, useCallback } from 'react';
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
  const logBufferRef = useRef<string[]>([]);

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
    logBufferRef.current.push(line);

    if (isMinecraftStoppingLog(line)) {
      const store = useGameLogStore.getState();
      store.setGameState('idle');
      void restoreLauncherAfterGameExit();
      triggerPostGameUpdateReminder();
    }
  });

  useEvent('game-exit', (payload) => {
    if (logBufferRef.current.length > 0) {
      useGameLogStore.getState().addLogs(logBufferRef.current);
      logBufferRef.current = [];
    }
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

  useEffect(() => {
    const flushTimer = setInterval(() => {
      if (logBufferRef.current.length > 0) {
        useGameLogStore.getState().addLogs(logBufferRef.current);
        logBufferRef.current = [];
      }
    }, 50);

    return () => {
      clearInterval(flushTimer);
    };
  }, []);
};
