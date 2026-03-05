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
      alert("启动失败：请先在设置页面添加并选择一个游戏账号！");
      return;
    }

    try {
      setIsLaunching(true);
      console.log(`[Launch] 准备使用账号 [${currentAccount.name}] 启动实例: ${instanceId}`);
      
      // ✅ 致命修复：必须全部小写！
      // 对应 Rust 端的 'offline', 'microsoft', 'authlib'
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
          accountType: mappedAccountType, // ✅ 传入全小写的字符串
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