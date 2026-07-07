// src/features/InstanceDetail/components/modpack/ModpackUpgradeModal.tsx
import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Undo2, ArrowUp } from 'lucide-react';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreCheckbox } from '../../../../ui/primitives/OreCheckbox';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { useModpackUpgrade } from '../../hooks/useModpackUpgrade';

interface ModpackUpgradeModalProps {
  instanceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ModpackUpgradeModal: React.FC<ModpackUpgradeModalProps> = ({
  instanceId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    status,
    upgradeInfo,
    progress,
    error,
    checkUpdate,
    upgradeModpack,
    rollbackUpgrade,
    setStatus,
  } = useModpackUpgrade(instanceId);

  const [useBackup, setUseBackup] = useState(true);
  const [rollbackProgress, setRollbackProgress] = useState(0);

  // Trigger check on open
  useEffect(() => {
    if (isOpen) {
      checkUpdate();
    }
  }, [isOpen, instanceId]);

  // Simulate smooth progress bar for rollback
  useEffect(() => {
    if (status === 'rolling-back') {
      setRollbackProgress(0);
      const timer = setInterval(() => {
        setRollbackProgress((prev) => {
          if (prev >= 95) {
            clearInterval(timer);
            return prev;
          }
          return prev + 5;
        });
      }, 80);
      return () => clearInterval(timer);
    }
  }, [status]);

  const handleStartUpgrade = async () => {
    await upgradeModpack('', !useBackup);
  };

  const handleRollback = async () => {
    await rollbackUpgrade();
  };

  // Correct version comparison: Compare new Minecraft version with current Minecraft version
  const isMajorUpgrade = upgradeInfo && 
    upgradeInfo.newMcVersion !== upgradeInfo.currentMcVersion;

  // Define standard actions footer matching the OreModal spec
  const modalActions = (() => {
    const hasBackup = upgradeInfo?.backupOriginalVersion != null;

    if (status === 'idle') {
      if (upgradeInfo && !upgradeInfo.hasUpdate) {
        // Already on latest version
        return (
          <div className="flex w-full gap-3">
            {hasBackup && (
              <OreButton
                onClick={() => setStatus('rollback-confirm')}
                variant="secondary"
                className="flex-1 flex items-center justify-center gap-1.5 h-12"
              >
                <Undo2 className="w-4 h-4" />
                <span>回滚上个版本</span>
              </OreButton>
            )}
            <div className={`flex-1 flex items-center justify-center h-12 text-sm font-minecraft border-2 border-green-500/20 bg-green-500/10 text-green-500 rounded-[2px]`}>
              已是最新版本
            </div>
          </div>
        );
      }

      // Has update
      return (
        <div className="flex w-full gap-3">
          {hasBackup && (
            <OreButton
              onClick={() => setStatus('rollback-confirm')}
              variant="secondary"
              className="flex-1 flex items-center justify-center gap-1.5 h-12"
            >
              <Undo2 className="w-4 h-4" />
              <span>回滚上个版本</span>
            </OreButton>
          )}
          <OreButton
            onClick={handleStartUpgrade}
            variant="primary"
            className="flex-1 flex items-center justify-center gap-1.5 h-12"
          >
            <ArrowUp className="w-4 h-4" />
            <span>立即安全升级</span>
          </OreButton>
        </div>
      );
    }

    if (status === 'rollback-confirm') {
      return (
        <div className="flex w-full gap-3">
          <OreButton
            onClick={() => setStatus('idle')}
            variant="secondary"
            size="full"
            className="flex-1"
          >
            取消
          </OreButton>

          <OreButton
            onClick={handleRollback}
            variant="primary"
            size="full"
            className="flex-1 bg-amber-600 hover:bg-amber-700"
          >
            确认回滚
          </OreButton>
        </div>
      );
    }

    return null;
  })();

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        status === 'rollback-confirm' || status === 'rolling-back' || status === 'rolled-back'
          ? '还原整合包备份'
          : '整合包升级中心'
      }
      className="w-[640px]"
      actions={modalActions}
    >
      <div className="flex flex-col text-white font-minecraft pb-1 space-y-5">
        {error && (
          <div className="p-3 bg-[#E52E3D]/10 border-2 border-[#E52E3D]/20 text-[#E52E3D] flex gap-3 text-sm rounded-[2px]">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold ore-text-shadow">升级失败</p>
              <p className="opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Stage 1: Active Upgrading / Rolling Back Progress */}
        {status !== 'idle' && status !== 'checking' && status !== 'completed' && status !== 'rollback-confirm' && status !== 'rolled-back' && status !== 'failed' ? (
          <div className="py-6 text-center space-y-6">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-white/5 border-t-ore-blue animate-spin" />
              <Download className="w-7 h-7 text-ore-blue animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold ore-text-shadow">
                {status === 'backing-up' && '正在打包备份本地数据...'}
                {status === 'downloading' && '正在下载并校验模组...'}
                {status === 'extracting' && '正在提取配置文件...'}
                {status === 'rolling-back' && '正在还原旧版备份文件...'}
              </h3>
              <p className="text-xs text-gray-400">
                {progress ? progress.message : '请耐心等待，这可能需要一两分钟...'}
              </p>
            </div>

            {/* Progress bar */}
            {(progress || status === 'rolling-back') && (
              <div className="max-w-xs mx-auto space-y-2">
                <div className="w-full bg-black/40 border-2 border-[#58585A] rounded-[2px] h-3 overflow-hidden">
                  <div
                    className="bg-ore-blue h-full transition-all duration-300"
                    style={{
                      width: `${
                        status === 'rolling-back'
                          ? rollbackProgress
                          : progress
                          ? (progress.current / progress.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span className="truncate max-w-[200px]">
                    {status === 'rolling-back' ? '正在还原配置文件及存档...' : progress?.fileName || '正在处理'}
                  </span>
                  <span>
                    {status === 'rolling-back' ? `${rollbackProgress}%` : `${progress?.current} / ${progress?.total}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : status === 'completed' ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-500/10 border-2 border-green-500/20 flex items-center justify-center mx-auto mb-2 shadow-[inset_0_0_15px_rgba(34,197,94,0.2)]">
              <CheckCircle2 className="w-8 h-8 text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
            </div>
            <h3 className="text-xl font-bold ore-text-shadow">整合包升级成功！</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto leading-relaxed">
              升级已完成，您原有的单人存档、游戏键位、联机服务器均已自动为您还原。
            </p>
            <div className="pt-2 flex justify-center gap-3 w-full px-6">
              {useBackup && (
                <OreButton
                  onClick={() => setStatus('rollback-confirm')}
                  variant="secondary"
                  className="w-1/2 flex items-center justify-center gap-1.5"
                >
                  <Undo2 className="w-4 h-4" />
                  <span>回滚上个版本</span>
                </OreButton>
              )}
              <OreButton
                onClick={() => {
                  onClose();
                  if (onSuccess) onSuccess();
                }}
                variant="primary"
                className={useBackup ? 'w-1/2' : 'w-32'}
              >
                完成
              </OreButton>
            </div>
          </div>
        ) : status === 'rolled-back' ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-500/10 border-2 border-green-500/20 flex items-center justify-center mx-auto mb-2 shadow-[inset_0_0_15px_rgba(34,197,94,0.2)]">
              <CheckCircle2 className="w-8 h-8 text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
            </div>
            <h3 className="text-xl font-bold ore-text-shadow">已成功回滚到上个版本</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto leading-relaxed">
              已清除升级配置，所有原版模组和配置文件均已还原至升级前状态。
            </p>
            <div className="pt-2 flex justify-center">
              <OreButton
                onClick={() => {
                  onClose();
                  if (onSuccess) onSuccess();
                }}
                variant="primary"
                className="w-32"
              >
                完成
              </OreButton>
            </div>
          </div>
        ) : status === 'rollback-confirm' ? (
          /* Rollback Confirmation Page with previous version details */
          <div className="space-y-5">
            <div className="p-3 bg-[#E5982E]/10 border-2 border-[#E5982E]/20 text-[#E5982E] flex gap-3 text-xs leading-relaxed rounded-[2px]">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold ore-text-shadow">您确定要回退到升级前的版本吗？</p>
                <p className="opacity-90 mt-0.5">
                  此操作将完全抹除本次升级产生的所有模组和配置文件，原汁原味恢复升级前的单人存档世界和按键设置。
                </p>
              </div>
            </div>

            {/* Rollback Details Block */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-300 ore-text-shadow">回滚目标版本信息 (Rollback Target Details)</h4>
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-[var(--ore-nav-active)] border-2 border-[var(--ore-border-color)] rounded-[2px] text-xs font-minecraft">
                {/* Modpack version */}
                <div className="flex flex-col space-y-1 border-r border-[var(--ore-border-color)] pr-2">
                  <span className="text-gray-400 text-[10px]">回滚整合包版本</span>
                  <span className="text-gray-200 font-bold">
                    {upgradeInfo?.latestVersion} <span className="text-ore-blue">→</span> {upgradeInfo?.backupOriginalVersion || 'v1.0.0'}
                  </span>
                </div>

                {/* Minecraft game version */}
                <div className="flex flex-col space-y-1 border-r border-[var(--ore-border-color)] pr-2 pl-2">
                  <span className="text-gray-400 text-[10px]">回滚游戏版本 (Minecraft)</span>
                  <span className="text-gray-200 font-bold">
                    {upgradeInfo?.newMcVersion} <span className="text-ore-blue">→</span> {upgradeInfo?.backupOriginalMcVersion || upgradeInfo?.currentMcVersion}
                  </span>
                </div>

                {/* Loader version */}
                <div className="flex flex-col space-y-1 pl-2">
                  <span className="text-gray-400 text-[10px]">回滚加载器 (Loader)</span>
                  <span className="text-gray-200 font-bold uppercase truncate">
                    {upgradeInfo?.backupOriginalLoaderType || upgradeInfo?.newLoaderType} ({upgradeInfo?.backupOriginalLoaderVersion || upgradeInfo?.newLoaderVersion})
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Stage 2: Selection / Info */
          <div className="space-y-5">
            {upgradeInfo && !upgradeInfo.hasUpdate && (
              <div className="p-3 bg-green-500/10 border-2 border-green-500/20 text-green-400 flex gap-3 text-xs leading-relaxed rounded-[2px]">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-green-500" />
                <div>
                  <p className="font-bold ore-text-shadow">已成功升级至最新版本 ({upgradeInfo.latestVersion})</p>
                  <p className="opacity-90 mt-0.5">
                    如果您升级后遇到了游戏崩溃、存档不兼容或配置丢失等问题，可以使用底部的“回滚上个版本”功能。
                  </p>
                </div>
              </div>
            )}

            {/* Version & Component Details comparison table */}
            {upgradeInfo && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-300 ore-text-shadow">版本组件详情 (Version Details)</h4>
                <div className="grid grid-cols-3 gap-3 p-3.5 bg-[var(--ore-nav-active)] border-2 border-[var(--ore-border-color)] rounded-[2px] text-xs font-minecraft">
                  {/* Modpack version */}
                  <div className="flex flex-col space-y-1 border-r border-[var(--ore-border-color)] pr-2">
                    <span className="text-gray-400 text-[10px]">整合包版本</span>
                    <span className="text-gray-200 font-bold">
                      {upgradeInfo.hasUpdate ? (
                        <>{upgradeInfo.currentVersion || 'v1.0.0'} <span className="text-ore-blue">→</span> {upgradeInfo.latestVersion}</>
                      ) : (
                        <>{upgradeInfo.latestVersion} (最新版)</>
                      )}
                    </span>
                  </div>

                  {/* Minecraft game version */}
                  <div className="flex flex-col space-y-1 border-r border-[var(--ore-border-color)] pr-2 pl-2">
                    <span className="text-gray-400 text-[10px]">游戏版本 (Minecraft)</span>
                    <span className={`font-bold ${upgradeInfo.hasUpdate && upgradeInfo.currentMcVersion !== upgradeInfo.newMcVersion ? 'text-amber-400' : 'text-gray-200'}`}>
                      {upgradeInfo.newMcVersion} {upgradeInfo.hasUpdate && upgradeInfo.currentMcVersion !== upgradeInfo.newMcVersion ? `(由 ${upgradeInfo.currentMcVersion} 升级)` : '(保持不变)'}
                    </span>
                  </div>

                  {/* Loader version */}
                  <div className="flex flex-col space-y-1 pl-2">
                    <span className="text-gray-400 text-[10px]">加载器 (Loader)</span>
                    <span className="text-gray-200 font-bold uppercase truncate" title={`${upgradeInfo.newLoaderType} (${upgradeInfo.newLoaderVersion})`}>
                      {upgradeInfo.newLoaderType} ({upgradeInfo.newLoaderVersion})
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Major Upgrade Warnings */}
            {upgradeInfo?.hasUpdate && isMajorUpgrade && (
              <div className="p-3 bg-[#E5982E]/10 border-2 border-[#E5982E]/20 text-[#E5982E] flex gap-3 text-xs leading-relaxed rounded-[2px]">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-bold ore-text-shadow">检测到游戏主版本发生变更</p>
                  <p className="opacity-90 mt-0.5">
                    本次升级将 Minecraft 版本从 {upgradeInfo?.currentMcVersion} 升级至 {upgradeInfo?.newMcVersion}。
                    跨大版本升级极易导致旧世界存档兼容性损坏！强烈建议您勾选自动备份。
                  </p>
                </div>
              </div>
            )}

            {/* Changelog Render Box using OreOverlayScrollArea */}
            {upgradeInfo?.hasUpdate && upgradeInfo?.changelog && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-gray-300 ore-text-shadow">更新日志 (Changelog)</h4>
                <OreOverlayScrollArea className="h-40 border-2 border-[var(--ore-border-color)] bg-black/40 rounded-[2px] text-xs text-gray-400 font-mono leading-relaxed p-3">
                  <div className="whitespace-pre-wrap">{upgradeInfo.changelog}</div>
                </OreOverlayScrollArea>
              </div>
            )}

            {/* Backup Checkbox using standard OreCheckbox */}
            {upgradeInfo?.hasUpdate && (
              <div className="pt-1.5 space-y-1">
                <OreCheckbox
                  checked={useBackup}
                  onChange={(checked) => setUseBackup(checked)}
                  label="升级前自动备份存档与配置文件"
                  focusKey="upgrade-backup-checkbox"
                />
                <p className="text-xs text-gray-400 pl-8 mt-1 leading-relaxed">
                  勾选后，系统会在升级开始前，为您备份原实例的 saves 存档、options.txt 键位与服务器列表。
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </OreModal>
  );
};
