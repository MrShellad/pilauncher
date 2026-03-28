import { useState, useCallback, type KeyboardEvent, type MouseEvent } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAccountStore } from '../store/useAccountStore';
import { useGameLogStore } from '../store/useGameLogStore';
import { useGamepadModStore } from '../store/useGamepadModStore';
import { useSettingsStore } from '../store/useSettingsStore';
import {
  resolveGamepadMod,
  resolveGamepadModOnDemand,
  resolveRequiredDependencies,
} from '../services/gamepadModService';

type LaunchEvent = MouseEvent | KeyboardEvent;

export const useGameLaunch = () => {
  const [isLaunching, setIsLaunching] = useState(false);

  const launchGame = useCallback(
    async (instanceId: string, isGamepad?: boolean, e?: LaunchEvent) => {
      if (e) {
        e.stopPropagation();
      }

      if (isLaunching) return;

      const { accounts, activeAccountId, updateAccount } = useAccountStore.getState();
      const currentAccount = accounts.find((a) => a.uuid === activeAccountId);

      if (!currentAccount) {
        console.warn('[Launch] 启动中止：未检测到有效账号');
        return;
      }

      try {
        setIsLaunching(true);
        console.log(`[Launch] 准备使用账号 [${currentAccount.name}] 启动实例: ${instanceId}`);

        const logStore = useGameLogStore.getState();
        logStore.clearLogs();
        logStore.setInstanceId(instanceId);
        logStore.setGameState('launching');
        logStore.setOpen(true);

        const { settings } = useSettingsStore.getState();
        const gamepadModCheckEnabled = settings.game.gamepadModCheck;

        if (isGamepad && gamepadModCheckEnabled) {
          try {
            logStore.addLogs(['[INFO] 手柄模式启动，正在检测手柄 Mod...']);

            const instanceDetail: any = await invoke('get_instance_detail', { id: instanceId });
            const mcVersion = instanceDetail?.mcVersion;
            const loaderType = instanceDetail?.loader?.type?.toLowerCase();

            if (mcVersion && loaderType) {
              logStore.addLogs(['[INFO] 执行手柄 Mod 状态检测...']);
              const status: any = await invoke('check_gamepad_mod_status', {
                instanceId,
                mcVersion,
                loaderType,
              });

              if (status.installed) {
                logStore.addLogs(['[INFO] 手柄模块就绪。']);
              } else if (status.needsInstall || !status.hasCache) {
                logStore.addLogs(['[WARN] 未检测到手柄支持模块。']);

                let resolved = resolveGamepadMod(mcVersion, loaderType);
                if (!resolved) {
                  logStore.addLogs(['[INFO] 缓存未命中，正在从 API 实时查询...']);
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

                  logStore.addLogs([
                    `[INFO] 发现适配此实例 (${mcVersion} ${loaderType}) 的手柄支持模块: ${resolved.name} [${resolved.source}]`,
                  ]);
                  logStore.addLogs(['[INFO] 正在挂起启动流程，等待玩家确认是否安装...']);

                  const selectedMod = await useGamepadModStore
                    .getState()
                    .promptDownload(instanceId, [modInfo], 'install');

                  if (selectedMod) {
                    logStore.addLogs([
                      `[INFO] 玩家同意安装，开始下载: ${selectedMod.fileName}`,
                    ]);

                    let depsToInstall: any[] = [];
                    if (resolved.dependencies && resolved.dependencies.length > 0) {
                      logStore.addLogs(['[INFO] 正在解析手柄模块前置依赖...']);
                      const deps = await resolveRequiredDependencies(
                        resolved.dependencies,
                        mcVersion,
                        loaderType
                      );
                      if (deps.length > 0) {
                        logStore.addLogs([`[INFO] 找到 ${deps.length} 个必需的前置依赖。`]);
                        depsToInstall = deps;
                      }
                    }

                    const allModsToInstall = [resolved, ...depsToInstall];

                    try {
                      for (const m of allModsToInstall) {
                        logStore.addLogs([`[INFO] 正在安装: ${m.fileName}`]);
                        await invoke('install_remote_mod', {
                          instanceId,
                          downloadUrl: m.downloadUrl,
                          fileName: m.fileName,
                          mcVersion,
                          loaderType,
                        });
                      }

                      logStore.addLogs(['[INFO] 手柄支持模块及依赖安装成功。']);
                      await invoke('check_instance_gamepad', { id: instanceId });
                    } catch (installErr) {
                      logStore.addLogs([`[ERROR] 手柄支持模块安装失败: ${installErr}`]);
                      logStore.setGameState('crashed');
                      setIsLaunching(false);
                      return;
                    }
                  } else {
                    logStore.addLogs(['[INFO] 玩家跳过了手柄支持模块安装，继续启动游戏。']);
                  }
                } else {
                  logStore.addLogs(['[WARN] 未找到适配当前版本的手柄模块配置，跳过检测。']);
                }
              } else if (status.hasCache) {
                let resolved = resolveGamepadMod(mcVersion, loaderType);
                if (!resolved) {
                  resolved = await resolveGamepadModOnDemand(mcVersion, loaderType);
                }

                const needsUpdate =
                  resolved &&
                  status.localFileName &&
                  resolved.fileName !== status.localFileName;

                if (needsUpdate && resolved) {
                  logStore.addLogs(['[INFO] 检测到手柄模块有新版本可用。']);

                  const modInfo = {
                    id: 'gamepad-mod-update',
                    name: resolved.name,
                    slug: 'gamepad',
                    fileName: resolved.fileName,
                    downloadUrl: resolved.downloadUrl,
                  };

                  const selectedMod = await useGamepadModStore
                    .getState()
                    .promptDownload(
                      instanceId,
                      [modInfo],
                      'update',
                      status.localFileName,
                      resolved.fileName
                    );

                  if (selectedMod) {
                    logStore.addLogs([
                      `[INFO] 玩家同意更新，开始下载: ${selectedMod.fileName}`,
                    ]);

                    let depsToInstall: any[] = [];
                    if (resolved.dependencies && resolved.dependencies.length > 0) {
                      logStore.addLogs(['[INFO] 正在解析手柄模块前置依赖...']);
                      const deps = await resolveRequiredDependencies(
                        resolved.dependencies,
                        mcVersion,
                        loaderType
                      );
                      if (deps.length > 0) {
                        logStore.addLogs([`[INFO] 找到 ${deps.length} 个必需的前置依赖。`]);
                        depsToInstall = deps;
                      }
                    }

                    const allModsToInstall = [resolved, ...depsToInstall];

                    try {
                      for (const m of allModsToInstall) {
                        logStore.addLogs([`[INFO] 正在更新: ${m.fileName}`]);
                        await invoke('install_remote_mod', {
                          instanceId,
                          downloadUrl: m.downloadUrl,
                          fileName: m.fileName,
                          mcVersion,
                          loaderType,
                        });
                      }
                      logStore.addLogs(['[INFO] 手柄支持模块更新成功。']);
                      await invoke('check_instance_gamepad', { id: instanceId });
                    } catch (updateErr) {
                      logStore.addLogs([
                        `[WARN] 更新失败，将使用缓存版本继续: ${updateErr}`,
                      ]);
                      try {
                        await invoke('install_remote_mod', {
                          instanceId,
                          downloadUrl: '',
                          fileName: status.localFileName || '',
                          mcVersion,
                          loaderType,
                        });
                      } catch (_) {
                        logStore.addLogs(['[WARN] 缓存恢复也失败了，继续启动。']);
                      }
                    }
                  } else {
                    logStore.addLogs(['[INFO] 玩家跳过更新，使用已有缓存版本。']);
                    try {
                      await invoke('install_remote_mod', {
                        instanceId,
                        downloadUrl: '',
                        fileName: status.localFileName || '',
                        mcVersion,
                        loaderType,
                      });
                      logStore.addLogs(['[INFO] 已从缓存安装手柄模块。']);
                      await invoke('check_instance_gamepad', { id: instanceId });
                    } catch (cacheErr) {
                      logStore.addLogs([`[WARN] 缓存安装失败: ${cacheErr}`]);
                    }
                  }
                } else {
                  logStore.addLogs(['[INFO] 从公共缓存安装手柄模块...']);
                  try {
                    await invoke('install_remote_mod', {
                      instanceId,
                      downloadUrl: '',
                      fileName: status.localFileName || '',
                      mcVersion,
                      loaderType,
                    });
                    logStore.addLogs(['[INFO] 手柄模块已从缓存安装。']);
                    await invoke('check_instance_gamepad', { id: instanceId });
                  } catch (cacheErr) {
                    logStore.addLogs([`[WARN] 缓存安装失败: ${cacheErr}`]);
                  }
                }
              }
            } else {
              logStore.addLogs(['[INFO] 无法获取实例版本信息，跳过手柄检测。']);
            }
          } catch (checkErr) {
            console.error('手柄检测流程异常', checkErr);
            logStore.addLogs(['[WARN] 检测手柄状态时遇到小问题，跳过。']);
          }
        } else if (isGamepad && !gamepadModCheckEnabled) {
          logStore.addLogs(['[INFO] 手柄 Mod 检测已在设置中关闭，跳过。']);
        }

        let mappedAccountType = 'offline';
        if (currentAccount.type?.toLowerCase() === 'microsoft') {
          mappedAccountType = 'microsoft';
        } else if (currentAccount.type?.toLowerCase() === 'authlib') {
          mappedAccountType = 'authlib';
        }

        let activeAccessToken = currentAccount.accessToken || '0';

        if (mappedAccountType === 'microsoft' && currentAccount.refreshToken) {
          const nowInSeconds = Math.floor(Date.now() / 1000);

          if (!currentAccount.expiresAt || currentAccount.expiresAt < nowInSeconds + 3600) {
            console.log('[Launch] 微软 Token 即将过期或已过期，正在后台执行静默刷新...');
            logStore.addLogs([
              '[INFO] 正在与微软验证服务器通信，静默续期登录状态...',
            ]);

            try {
              const refreshedAccount = await invoke<any>('refresh_microsoft_token', {
                refreshToken: currentAccount.refreshToken,
              });

              const newAccessToken =
                refreshedAccount.access_token || refreshedAccount.accessToken;
              const newRefreshToken =
                refreshedAccount.refresh_token ||
                refreshedAccount.refreshToken ||
                currentAccount.refreshToken;
              const newExpiresAt = refreshedAccount.expires_at || refreshedAccount.expiresAt;

              updateAccount(currentAccount.uuid, {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                expiresAt: newExpiresAt,
              });

              activeAccessToken = newAccessToken;
              console.log('[Launch] 微软 Token 静默续期成功');
              logStore.addLogs([
                '[INFO] 微软登录状态续期成功，准备构建游戏参数...',
              ]);
            } catch (refreshErr) {
              console.error('Token 刷新失败:', refreshErr);
              logStore.addLogs([
                '[ERROR] 微软账号授权已完全失效且无法自动续期。',
              ]);
              logStore.addLogs([
                `[ERROR] 请前往【设置】删除该账号并重新扫码登录。详细错误: ${refreshErr}`,
              ]);
              logStore.setGameState('crashed');
              setIsLaunching(false);
              return;
            }
          }
        }

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
            skinUrl: currentAccount.skinUrl || null,
          },
        });
      } catch (error) {
        console.error('游戏启动失败:', error);
        const logStore = useGameLogStore.getState();
        logStore.addLogs(['[FATAL] 游戏启动前置校验发生致命错误。']);
        logStore.addLogs([`[FATAL] ${error}`]);
        logStore.setGameState('crashed');
        logStore.analyzeCrash();
      } finally {
        setIsLaunching(false);
      }
    },
    [isLaunching]
  );

  return {
    isLaunching,
    launchGame,
  };
};
