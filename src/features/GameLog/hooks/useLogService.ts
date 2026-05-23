import { useEffect, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useGameLogStore } from '../../../store/useGameLogStore';

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

  useEffect(() => {
    const unlistenLog = listen<string>('game-log', (event) => {
      const line = event.payload;
      logBufferRef.current.push(line);

      if (isMinecraftStoppingLog(line)) {
        const store = useGameLogStore.getState();
        store.setGameState('idle');
        void restoreLauncherAfterGameExit();
      }
    });

    const flushTimer = setInterval(() => {
      if (logBufferRef.current.length > 0) {
        useGameLogStore.getState().addLogs(logBufferRef.current);
        logBufferRef.current = [];
      }
    }, 50);

    const unlistenExit = listen<{ code: number }>('game-exit', (event) => {
      if (logBufferRef.current.length > 0) {
        useGameLogStore.getState().addLogs(logBufferRef.current);
        logBufferRef.current = [];
      }
      const store = useGameLogStore.getState();
      if (event.payload.code !== 0) {
        store.analyzeCrash();
        store.setOpen(true);
        void forceLauncherToFront();
      } else {
        store.setGameState('idle');
        void restoreLauncherAfterGameExit();
      }
    });

    return () => {
      clearInterval(flushTimer);
      unlistenLog.then(f => f());
      unlistenExit.then(f => f());
    };
  }, [
    forceLauncherToFront,
    isMinecraftStoppingLog,
    restoreLauncherAfterGameExit
  ]);
};
