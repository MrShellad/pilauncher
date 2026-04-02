import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export const useGameProcessService = () => {
  const killCurrentGame = useCallback(() => {
    invoke('kill_current_game').catch(console.error);
  }, []);

  return { killCurrentGame };
};
