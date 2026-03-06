// /src/hooks/useGameLaunch.ts
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAccountStore } from '../store/useAccountStore';

export const useGameLaunch = () => {
  const [isLaunching, setIsLaunching] = useState(false);

  const launchGame = useCallback(async (instanceId: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (isLaunching) return;

    // 提取当前选中的账号
    const { accounts, activeAccountId } = useAccountStore.getState();
    const currentAccount = accounts.find(a => a.uuid === activeAccountId);

    if (!currentAccount) {
      // ✅ 移除了原生的 alert()，改为向控制台输出警告并静默中止
      // 真正的拦截与弹窗反馈将由前端 LaunchControls 负责
      console.warn("[Launch] 启动中止：未检测到有效账号");
      return;
    }

    try {
      setIsLaunching(true);
      console.log(`[Launch] 准备使用账号 [${currentAccount.name}] 启动实例: ${instanceId}`);
      
      let mappedAccountType = 'offline';
      if (currentAccount.type?.toLowerCase() === 'microsoft') {
        mappedAccountType = 'microsoft';
      } else if (currentAccount.type?.toLowerCase() === 'authlib') {
        mappedAccountType = 'authlib';
      }

      await invoke('launch_game', { 
        instanceId, 
        account: {
          id: currentAccount.uuid,
          accountType: mappedAccountType, 
          username: currentAccount.name,
          uuid: currentAccount.uuid,
          accessToken: currentAccount.accessToken || "0",
          refreshToken: currentAccount.refreshToken || null,
          expiresAt: currentAccount.expiresAt || null,
          skinUrl: currentAccount.skinUrl || null
        }
      });

    } catch (error) {
      console.error('游戏启动失败:', error);
      alert(`启动失败: ${error}`); // 这里的报错依然保留，因为这是真实的底层崩溃抛出
    } finally {
      setIsLaunching(false);
    }
  }, [isLaunching]);

  return {
    isLaunching,
    launchGame,
  };
};