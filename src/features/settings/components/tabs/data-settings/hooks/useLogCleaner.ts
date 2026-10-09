import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import type { CleanLogsPhase } from '../types';

export const useLogCleaner = () => {
  const [phase, setPhase] = useState<CleanLogsPhase>('idle');
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');

  const openConfirm = useCallback(() => {
    setPhase('confirm');
  }, []);

  const close = useCallback(() => {
    setPhase('idle');
    setCount(0);
    setError('');
  }, []);

  const clean = useCallback(async () => {
    setPhase('cleaning');
    try {
      const removedCount = await invoke<number>('clean_logs');
      setCount(removedCount);
      setPhase('done');
    } catch (e) {
      setError(String(e));
      setPhase('error');
    }
  }, []);

  return {
    phase,
    count,
    error,
    openConfirm,
    close,
    clean
  };
};
