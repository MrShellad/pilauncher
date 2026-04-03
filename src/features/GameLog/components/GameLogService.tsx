// src/features/GameLog/components/GameLogService.tsx
//
// Headless, always-mounted component that owns all Tauri event listeners.
// Populates useGameLogStore regardless of whether GameLogSidebar is shown,
// so LaunchingAnimation (and any other consumers) always receive live logs.

import React, { useCallback } from 'react';
import { useWindowService } from '../hooks/useWindowService';
import { useLogService } from '../hooks/useLogService';
import { useGameLogStore } from '../../../store/useGameLogStore';

export const GameLogService: React.FC = () => {
  const { forceLauncherToFront } = useWindowService();
  const setOpen = useGameLogStore((s) => s.setOpen);

  const closeSidebarAndRestoreFocus = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  useLogService({ closeSidebarAndRestoreFocus, forceLauncherToFront });

  React.useEffect(() => {
    console.log('[GameLogService] Headless log service mounted!');
    return () => console.log('[GameLogService] Headless log service UNMOUNTED!');
  }, []);

  return null;
};
