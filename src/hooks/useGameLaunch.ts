// /src/hooks/useGameLaunch.ts
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAccountStore } from '../store/useAccountStore';

// ✅ 引入我们刚刚创建的游戏日志 Store
import { useGameLogStore } from '../store/useGameLogStore';
import { useGamepadModStore } from '../store/useGamepadModStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { resolveGamepadMod, resolveGamepadModOnDemand, resolveRequiredDependencies } from '../services/gamepadModService';

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
      // ✅ 手柄 Mod 检测 / 阻断启动 / 版本校验（仅在手柄启动时执行）
      // 前端通过 Modrinth/CurseForge API 动态解析下载链接
      // ================================================================
      const { settings } = useSettingsStore.getState();
      const gamepadModCheckEnabled = settings.game.gamepadModCheck;

      if (isGamepad && gamepadModCheckEnabled) {
        try {
          logStore.addLog("[INFO] 手柄模式启动，正在检测手柄 Mod...");
          
          // 1. 获取实例详细配置
          const instanceDetail: any = await invoke('get_instance_detail', { id: instanceId });
          const mcVersion = instanceDetail?.mcVersion;
          const loaderType = instanceDetail?.loader?.type?.toLowerCase();

          if (mcVersion && loaderType) {
            // 2. 调用后端检测本地安装 + 缓存状态
            logStore.addLog("[INFO] 执行手柄 Mod 状态检测...");
            const status: any = await invoke('check_gamepad_mod_status', {
              instanceId,
              mcVersion,
              loaderType,
            });

            if (status.installed) {
              logStore.addLog("[INFO] 手柄模块就绪。");
            }
            else if (status.needsInstall || !status.hasCache) {
              logStore.addLog("[WARN] 未检测到手柄支持模块！");

              // 3. 从前端服务动态解析下载链接（先查缓存，缓存未命中则实时查 API）
              let resolved = resolveGamepadMod(mcVersion, loaderType);
              if (!resolved) {
                logStore.addLog("[INFO] 缓存未命中，正在从 API 实时查询...");
                resolved = await resolveGamepadModOnDemand(mcVersion, loaderType);
              }

              if (resolved) {
                const modInfo = {
                  id: 'gamepad-mod',
                  name: resolved.name,
                  slug: 'gamepad',
                  fileName: resolved.fileName,
                  downloadUrl: resolved.downloadUrl,
                };

                logStore.addLog(`[INFO] 发现适配此实例 (${mcVersion} ${loaderType}) 的手柄支持模块: ${resolved.name} [${resolved.source}]`);
                logStore.addLog("[INFO] 正在挂起启动进程，等待玩家确认安装...");

                const selectedMod = await useGamepadModStore.getState().promptDownload(
                  instanceId, [modInfo], 'install'
                );

                if (selectedMod) {
                  logStore.addLog(`[INFO] 玩家同意安装，下发下载任务: ${selectedMod.fileName}`);
                  
                  // 解析并获取前置依赖
                  let depsToInstall: any[] = [];
                  if (resolved.dependencies && resolved.dependencies.length > 0) {
                     logStore.addLog(`[INFO] 正在解析手柄模块前置依赖...`);
                     const deps = await resolveRequiredDependencies(resolved.dependencies, mcVersion, loaderType);
                     if (deps.length > 0) {
                        logStore.addLog(`[INFO] 找到 ${deps.length} 个必须的前置依赖。`);
                        depsToInstall = deps;
                     }
                  }

                  const allModsToInstall = [resolved, ...depsToInstall];

                  try {
                    for (const m of allModsToInstall) {
                      logStore.addLog(`[INFO] 正在安装: ${m.fileName}`);
                      await invoke('install_remote_mod', {
                        instanceId,
                        downloadUrl: m.downloadUrl,
                        fileName: m.fileName,
                        mcVersion,
                        loaderType,
                      });
                    }
                    
                    logStore.addLog("[INFO] 手柄支持模块及依赖安装成功！");
                    await invoke('check_instance_gamepad', { id: instanceId });
                  } catch (installErr) {
                    logStore.addLog(`[ERROR] 手柄支持模块安装失败: ${installErr}`);
                    logStore.setGameState('crashed');
                    setIsLaunching(false);
                    return;
                  }
                } else {
                  logStore.addLog("[INFO] 玩家取消了安装，启动中止。");
                  logStore.setGameState('crashed');
                  setIsLaunching(false);
                  return;
                }
              } else {
                logStore.addLog("[WARN] 未找到适配当前版本的手柄模块配置，跳过检测。");
              }
            }
            else if (status.hasCache) {
              // 有缓存但实例中未安装 → 检测是否有更新，然后安装
              let resolved = resolveGamepadMod(mcVersion, loaderType);
              if (!resolved) {
                resolved = await resolveGamepadModOnDemand(mcVersion, loaderType);
              }

              const needsUpdate = resolved && status.localFileName && resolved.fileName !== status.localFileName;

              if (needsUpdate && resolved) {
                logStore.addLog("[INFO] 检测到手柄模块有新版本可用。");

                const modInfo = {
                  id: 'gamepad-mod-update',
                  name: resolved.name,
                  slug: 'gamepad',
                  fileName: resolved.fileName,
                  downloadUrl: resolved.downloadUrl,
                };

                const selectedMod = await useGamepadModStore.getState().promptDownload(
                  instanceId, [modInfo], 'update',
                  status.localFileName, resolved.fileName
                );

                if (selectedMod) {
                  logStore.addLog(`[INFO] 玩家同意更新，下发下载任务: ${selectedMod.fileName}`);
                  
                  let depsToInstall: any[] = [];
                  if (resolved.dependencies && resolved.dependencies.length > 0) {
                     logStore.addLog(`[INFO] 正在解析手柄模块前置依赖...`);
                     const deps = await resolveRequiredDependencies(resolved.dependencies, mcVersion, loaderType);
                     if (deps.length > 0) {
                        logStore.addLog(`[INFO] 找到 ${deps.length} 个必须的前置依赖。`);
                        depsToInstall = deps;
                     }
                  }

                  const allModsToInstall = [resolved, ...depsToInstall];

                  try {
                    for (const m of allModsToInstall) {
                      logStore.addLog(`[INFO] 正在更新: ${m.fileName}`);
                      await invoke('install_remote_mod', {
                        instanceId,
                        downloadUrl: m.downloadUrl,
                        fileName: m.fileName,
                        mcVersion,
                        loaderType,
                      });
                    }
                    logStore.addLog("[INFO] 手柄支持模块更新成功！");
                    await invoke('check_instance_gamepad', { id: instanceId });
                  } catch (updateErr) {
                    logStore.addLog(`[WARN] 更新失败，将使用缓存版本继续: ${updateErr}`);
                    try {
                      await invoke('install_remote_mod', {
                        instanceId,
                        downloadUrl: '',
                        fileName: status.localFileName || '',
                        mcVersion,
                        loaderType,
                      });
                    } catch (_) {
                      logStore.addLog("[WARN] 缓存恢复也失败了，继续启动。");
                    }
                  }
                } else {
                  logStore.addLog("[INFO] 玩家跳过更新，使用已有缓存版本。");
                  try {
                    await invoke('install_remote_mod', {
                      instanceId,
                      downloadUrl: '',
                      fileName: status.localFileName || '',
                      mcVersion,
                      loaderType,
                    });
                    logStore.addLog("[INFO] 已从缓存安装手柄模块。");
                    await invoke('check_instance_gamepad', { id: instanceId });
                  } catch (cacheErr) {
                    logStore.addLog(`[WARN] 缓存安装失败: ${cacheErr}`);
                  }
                }
              } else {
                // 无更新，直接从缓存安装
                logStore.addLog("[INFO] 从公共缓存安装手柄模块...");
                try {
                  await invoke('install_remote_mod', {
                    instanceId,
                    downloadUrl: '',
                    fileName: status.localFileName || '',
                    mcVersion,
                    loaderType,
                  });
                  logStore.addLog("[INFO] 手柄模块已从缓存安装。");
                  await invoke('check_instance_gamepad', { id: instanceId });
                } catch (cacheErr) {
                  logStore.addLog(`[WARN] 缓存安装失败: ${cacheErr}`);
                }
              }
            }
          } else {
            logStore.addLog("[INFO] 无法获取实例版本信息，跳过手柄检测。");
          }
        } catch (checkErr) {
          console.error("手柄检测流程异常", checkErr);
          logStore.addLog(`[WARN] 检测手柄状态时遇到小问题，跳过。`);
        }
      } else if (isGamepad && !gamepadModCheckEnabled) {
        logStore.addLog("[INFO] 手柄 Mod 检测已在设置中关闭，跳过。");
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