// src/features/Settings/components/StartupUpdateChecker.tsx
// 全局始终挂载的组件 —— 负责启动时自动检查更新 + 渲染 UpdateDialog 弹窗
import React, { useEffect, useRef } from 'react';

import { useSettingsStore } from '../../../store/useSettingsStore';
import { useAppUpdater } from '../../../hooks/useAppUpdater';
import { UpdateDialog } from './modals/UpdateDialog';

export const StartupUpdateChecker: React.FC = () => {
  const hasHydrated = useSettingsStore((s) => s._hasHydrated);
  const checkUpdateOnStart = useSettingsStore((s) => s.settings.general.checkUpdateOnStart);
  const startupCheckDoneRef = useRef(false);

  const {
    checkForUpdate,
    installUpdate,
    closeUpdateDialog,
    updateInfo,
    isUpdateDialogOpen,
    isInstalling,
  } = useAppUpdater();

  // ✅ 启动时自动检查更新（仅在 Store 恢复完成后执行一次）
  useEffect(() => {
    if (!hasHydrated || startupCheckDoneRef.current) return;
    startupCheckDoneRef.current = true;

    if (!checkUpdateOnStart) return;

    // 稍作延迟，避免与其他启动任务（Java 检测、新闻弹窗等）竞争
    const timer = window.setTimeout(() => {
      void checkForUpdate();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [hasHydrated, checkUpdateOnStart, checkForUpdate]);

  return (
    <UpdateDialog
      isOpen={isUpdateDialogOpen}
      onClose={closeUpdateDialog}
      updateInfo={updateInfo}
      isInstalling={isInstalling}
      onConfirm={installUpdate}
    />
  );
};
