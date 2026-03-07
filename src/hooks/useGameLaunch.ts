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

    // 提取当前选中的账号，✅ 注意这里解构出了 updateAccount
    const { accounts, activeAccountId, updateAccount } = useAccountStore.getState();
    const currentAccount = accounts.find(a => a.uuid === activeAccountId);

    if (!currentAccount) {
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

      // ================================================================
      // ✅ 终极防掉线方案：启动前检查 Token 有效期并自动续期
      // ================================================================
      let activeAccessToken = currentAccount.accessToken || "0";
      
      if (mappedAccountType === 'microsoft' && currentAccount.refreshToken) {
        const nowInSeconds = Math.floor(Date.now() / 1000);
        
        // 如果没有过期时间，或者距离过期不足 1 小时 (3600秒)
        if (!currentAccount.expiresAt || currentAccount.expiresAt < nowInSeconds + 3600) {
          console.log("[Launch] 微软 Token 即将过期或已过期，正在后台执行静默刷新...");
          
          try {
            // 调用 Rust 中写好的 refresh_microsoft_token
            const refreshedAccount = await invoke<any>('refresh_microsoft_token', { 
              refreshToken: currentAccount.refreshToken 
            });
            
            // 提取最新数据，兼容 Rust 传回来的下划线命名与驼峰命名
            const newAccessToken = refreshedAccount.access_token || refreshedAccount.accessToken;
            const newRefreshToken = refreshedAccount.refresh_token || refreshedAccount.refreshToken || currentAccount.refreshToken;
            const newExpiresAt = refreshedAccount.expires_at || refreshedAccount.expiresAt;

            // 同步到全局 Store 永久保存
            updateAccount(currentAccount.uuid, {
              accessToken: newAccessToken,
              refreshToken: newRefreshToken,
              expiresAt: newExpiresAt
            });

            // 覆盖当前内存里的 Token 以供本次启动使用
            activeAccessToken = newAccessToken;
            console.log("[Launch] 微软 Token 静默续期成功！");
            
          } catch (refreshErr) {
            console.error('Token 刷新失败:', refreshErr);
            alert(`微软账号授权已完全失效且无法自动续期。\n请前往【设置】删除该账号并重新扫码登录！\n详细错误: ${refreshErr}`);
            setIsLaunching(false);
            return;
          }
        }
      }

      // 开始真正调用底层启动
      await invoke('launch_game', { 
        instanceId, 
        account: {
          id: currentAccount.uuid,
          accountType: mappedAccountType, 
          username: currentAccount.name,
          uuid: currentAccount.uuid,
          accessToken: activeAccessToken, // ✅ 传入可能已续期的新 Token
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