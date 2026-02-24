// /src/hooks/pages/Home/useHome.ts
import { useCallback } from 'react';
import { useLauncherStore } from '../../../store/useLauncherStore';

export const useHome = () => {
  // 从 Store 获取全局状态
  const { currentInstance, launchGame, setActiveTab } = useLauncherStore();

  // 封装具体的交互动作
  const handleLaunch = useCallback(() => {
    launchGame();
  }, [launchGame]);

  const handleOpenSettings = useCallback(() => {
    setActiveTab('settings');
  }, [setActiveTab]);

  const handleSelectInstance = useCallback(() => {
    // 未来这里可以用来打开“实例选择下拉菜单”或跳转实例页
    setActiveTab('instances');
  }, [setActiveTab]);

  // 返回 UI 所需的所有数据和动作
  return {
    instanceName: currentInstance?.name || 'Select Instance',
    playTime: currentInstance?.playTime || 0,
    lastPlayed: currentInstance?.lastPlayed || 'Never',
    handleLaunch,
    handleOpenSettings,
    handleSelectInstance,
  };
};