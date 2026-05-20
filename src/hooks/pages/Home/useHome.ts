// /src/hooks/pages/Home/useHome.ts
import { useCallback } from 'react';
import { useLauncherStore } from '../../../store/useLauncherStore';
import { useGameLaunch } from '../../useGameLaunch'; // ✅ 建议引入专门负责启动逻辑的 hook

export const useHome = () => {
  // 1. 从 Store 获取全局状态和路由切换方法
  const { setSelectedInstanceId, setActiveTab } = useLauncherStore();
  
  // 2. 引入实际的启动逻辑（我们在上几步中重构过的带 Account 验证的启动逻辑）
  const { launchGame, isLaunching } = useGameLaunch();

  // ✅ 核心修复：让 handleLaunch 接收 instanceId 和 isGamepad 参数
  const handleLaunch = useCallback(async (instanceId: string, isGamepad?: boolean) => {
    if (!instanceId) return;
    await launchGame(instanceId, isGamepad);
  }, [launchGame]);

  // ✅ 优化细节：点击“设置”时，锁定当前实例 ID 并跳转到详情页
  const handleOpenSettings = useCallback((instanceId: string) => {
    if (!instanceId) return;
    setSelectedInstanceId(instanceId); // 锁定实例
    setActiveTab('instance-detail');  // 跳转到详情页路由
  }, [setSelectedInstanceId, setActiveTab]);

  const handleSelectInstance = useCallback(() => {
    // 跳转到实例列表页以便选择
    setActiveTab('instances');
  }, [setActiveTab]);

  return {
    handleLaunch,
    handleOpenSettings,
    handleSelectInstance,
    isLaunching,
  };
};