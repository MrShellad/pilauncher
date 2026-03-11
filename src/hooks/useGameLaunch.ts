// /src/hooks/useGameLaunch.ts
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAccountStore } from '../store/useAccountStore';

// ✅ 引入我们刚刚创建的游戏日志 Store
import { useGameLogStore } from '../store/useGameLogStore';
import { useGamepadModStore } from '../store/useGamepadModStore';
import gamepadConfig from '../assets/config/gamepad.json';

export const useGameLaunch = () => {
  const [isLaunching, setIsLaunching] = useState(false);

  const launchGame = useCallback(async (instanceId: string, isGamepad?: boolean, e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (isLaunching) return;

    // 提取当前选中的账号
    const { accounts, activeAccountId, updateAccount } = useAccountStore.getState();
    const currentAccount = accounts.find(a => a.uuid === activeAccountId);

    if (!currentAccount) {
      console.warn("[Launch] 启动中止：未检测到有效账号");
      return;
    }

    try {
      setIsLaunching(true);
      console.log(`[Launch] 准备使用账号 [${currentAccount.name}] 启动实例: ${instanceId}`);
      
      // ================================================================
      // ✅ 核心修改：在启动流程开始时，唤出日志侧边栏并进入 Loading 状态
      // ================================================================
      const logStore = useGameLogStore.getState();
      logStore.clearLogs();
      logStore.setInstanceId(instanceId); 
      logStore.setGameState('launching');
      logStore.setOpen(true);

      // ================================================================
      // ✅ 新增：手柄 Mod 自动检测与安装拦截支持
      // ================================================================
      try {
        logStore.addLog("[INFO] 正在检测实例运行环境...");
        
        // 1. 获取实例详细配置
        const instanceDetail: any = await invoke('get_instance_detail', { id: instanceId });
        const hasGamepad = instanceDetail?.gamepad;

        // 2. 如果 instance.json 里 gamepad 没有标记为 true，则调用 Rust 进行深层扫描检测
        if (!hasGamepad) {
          logStore.addLog("[INFO] 执行手柄 Mod 深度扫描...");
          const backendHasGamepad = await invoke<boolean>('check_instance_gamepad', { id: instanceId });
          
          // 3. 扫描依然没有发现手柄 mod，且当前是通过手柄启动，开始尝试推荐下载
          if (!backendHasGamepad && isGamepad) {
            logStore.addLog("[WARN] 未检测到手柄支持模块！");
            
            const mcVersion = instanceDetail?.game_version;
            const loaderType = instanceDetail?.loader_type?.toLowerCase();

            if (mcVersion && loaderType) {
              const versionConfig: any = (gamepadConfig as any)[mcVersion];
              if (versionConfig && versionConfig[loaderType]) {
                const targetModsInfo = versionConfig[loaderType];
                const targetModsArray = Array.isArray(targetModsInfo) ? targetModsInfo : [targetModsInfo];
                
                logStore.addLog(`[INFO] 发现适配此实例 (${mcVersion} ${loaderType}) 的 ${targetModsArray.length} 个手柄支持`);
                logStore.addLog(`[INFO] 正在挂起启动进程，等待玩家确认安装...`);
                
                // 唤出前端 UI
                const selectedMod = await useGamepadModStore.getState().promptDownload(instanceId, targetModsArray);
                
                if (selectedMod) {
                  logStore.addLog(`[INFO] 玩家同意安装，下发下载任务: ${selectedMod.fileName}`);
                  
                  // TODO: 这里直接下发 mod 下载任务给后端或 DownloadStore 处理...
                  try {
                    await invoke('install_remote_mod', { 
                      instanceId, 
                      downloadUrl: selectedMod.downloadUrl,
                      fileName: selectedMod.fileName
                    });
                    logStore.addLog(`[INFO] 手柄支持模块安装成功！`);
                    
                    // 安装成功后告诉后端更新标记
                    await invoke('check_instance_gamepad', { id: instanceId });
                  } catch (installErr) {
                    logStore.addLog(`[ERROR] 手柄支持模块安装失败，但将继续启动游戏。错误: ${installErr}`);
                  }
                } else {
                  logStore.addLog(`[INFO] 玩家跳过了安装推荐。`);
                }
              }
            }
          } else if (!backendHasGamepad && !isGamepad) {
            logStore.addLog("[INFO] 键鼠模式启动，跳过手柄模块检测与提示。");
          } else {
             logStore.addLog("[INFO] 手柄模块就绪。");
          }
        }
      } catch (checkErr) {
        console.error("手柄检测流程异常", checkErr);
        logStore.addLog(`[WARN] 检测手柄状态时遇到小问题，跳过。`);
      }

      let mappedAccountType = 'offline';
      if (currentAccount.type?.toLowerCase() === 'microsoft') {
        mappedAccountType = 'microsoft';
      } else if (currentAccount.type?.toLowerCase() === 'authlib') {
        mappedAccountType = 'authlib';
      }

      let activeAccessToken = currentAccount.accessToken || "0";
      
      if (mappedAccountType === 'microsoft' && currentAccount.refreshToken) {
        const nowInSeconds = Math.floor(Date.now() / 1000);
        
        // 如果没有过期时间，或者距离过期不足 1 小时 (3600秒)
        if (!currentAccount.expiresAt || currentAccount.expiresAt < nowInSeconds + 3600) {
          console.log("[Launch] 微软 Token 即将过期或已过期，正在后台执行静默刷新...");
          logStore.addLog("[INFO] 正在与微软验证服务器通信，静默续期登录状态..."); // 可以在加载时给玩家一点反馈
          
          try {
            const refreshedAccount = await invoke<any>('refresh_microsoft_token', { 
              refreshToken: currentAccount.refreshToken 
            });
            
            const newAccessToken = refreshedAccount.access_token || refreshedAccount.accessToken;
            const newRefreshToken = refreshedAccount.refresh_token || refreshedAccount.refreshToken || currentAccount.refreshToken;
            const newExpiresAt = refreshedAccount.expires_at || refreshedAccount.expiresAt;

            updateAccount(currentAccount.uuid, {
              accessToken: newAccessToken,
              refreshToken: newRefreshToken,
              expiresAt: newExpiresAt
            });

            activeAccessToken = newAccessToken;
            console.log("[Launch] 微软 Token 静默续期成功！");
            logStore.addLog("[INFO] 微软登录状态续期成功，准备构建游戏参数...");
            
          } catch (refreshErr) {
            console.error('Token 刷新失败:', refreshErr);
            // ✅ 如果续期失败，直接把报错打入日志控制台，并判定为崩溃
            logStore.addLog(`[ERROR] 微软账号授权已完全失效且无法自动续期。`);
            logStore.addLog(`[ERROR] 请前往【设置】删除该账号并重新扫码登录！详细错误: ${refreshErr}`);
            logStore.setGameState('crashed');
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
          accessToken: activeAccessToken, 
          refreshToken: currentAccount.refreshToken || null,
          expiresAt: currentAccount.expiresAt || null,
          skinUrl: currentAccount.skinUrl || null
        }
      });

    } catch (error) {
      console.error('游戏启动失败:', error);
      // ✅ 拦截底层直接抛出的致命错误（比如找不到 Java、内存分配错误等），取代丑陋的 alert
      const logStore = useGameLogStore.getState();
      logStore.addLog(`[FATAL] 游戏启动前置校验发生致命错误！`);
      logStore.addLog(`[FATAL] ${error}`);
      logStore.setGameState('crashed');
      logStore.analyzeCrash(); // 触发自动诊断
    } finally {
      setIsLaunching(false);
    }
  }, [isLaunching]);

  return {
    isLaunching,
    launchGame,
  };
};