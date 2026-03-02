// /src/hooks/useGameLaunch.ts
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export const useGameLaunch = () => {
  const [isLaunching, setIsLaunching] = useState(false);

  /**
   * 触发启动游戏
   * @param instanceId 目标实例 ID
   * @param e 可选的点击事件（用于自动拦截冒泡）
   */
  const launchGame = useCallback(async (instanceId: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    // 统一拦截事件冒泡，防止触发外层卡片的点击事件
    if (e) {
      e.stopPropagation();
    }

    if (isLaunching) return;

    try {
      setIsLaunching(true);
      
      // TODO: 未来这里可以从全局状态(如 useAuthStore) 中获取当前选中的账号名称
      const offlineName = 'PiPlayer'; 

      console.log(`[Launch] 准备启动实例: ${instanceId}`);
      
      await invoke('launch_game', { 
        instanceId, 
        offlineName 
      });

    } catch (error) {
      console.error('游戏启动失败:', error);
      alert(`启动失败: ${error}`);
    } finally {
      setIsLaunching(false);
    }
  }, [isLaunching]);

  return {
    isLaunching,
    launchGame,
  };
};