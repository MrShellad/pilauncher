// /src/hooks/useGameLaunch.ts
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAccountStore } from '../store/useAccountStore'; // ✅ 引入账号 Store

export const useGameLaunch = () => {
  const [isLaunching, setIsLaunching] = useState(false);

  const launchGame = useCallback(async (instanceId: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (isLaunching) return;

    // ✅ 提取当前选中的账号
    const { accounts, activeAccountId } = useAccountStore.getState();
    const currentAccount = accounts.find(a => a.uuid === activeAccountId);

    if (!currentAccount) {
      alert("启动失败：请先在设置页面添加并选择一个游戏账号！");
      return;
    }

    try {
      setIsLaunching(true);
      console.log(`[Launch] 准备使用账号 [${currentAccount.name}] 启动实例: ${instanceId}`);
      
      await invoke('launch_game', { 
        instanceId, 
        // 按照后端的 AccountPayload 格式封装数据
        account: {
          uuid: currentAccount.uuid,
          name: currentAccount.name,
          access_token: currentAccount.accessToken,
          type: currentAccount.type
        }
      });

    } catch (error) {
      console.error('游戏启动失败:', error);
      alert(`启动失败: ${error}`);
    } finally {
      // 这里的 finally 只是解除了前端按钮的 loading 状态，游戏会在后台持续运行
      setIsLaunching(false);
    }
  }, [isLaunching]);

  return {
    isLaunching,
    launchGame,
  };
};