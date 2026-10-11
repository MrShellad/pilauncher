import { useCallback, useEffect, useRef, useState } from 'react';
import type { TFunction } from 'i18next';

import type { ToastTone } from '../../../../../shared/stores/useToastStore';
import type { ModMeta, ModVersionInstallAction } from '../../../../instance-resources';
import type { OreProjectVersion } from '../../../../resource-catalog';
import type { useModManager } from '../../hooks/useModManager';

type ModManager = ReturnType<typeof useModManager>;

interface UseModUpgradeActionsOptions {
  instanceId: string;
  mods: ModMeta[];
  upgradeMod: ModManager['upgradeMod'];
  installModVersion: ModManager['installModVersion'];
  loadMods: ModManager['loadMods'];
  takeSnapshot: ModManager['takeSnapshot'];
  syncHistoryAfterSnapshot: () => Promise<void>;
  addToast: (tone: ToastTone, message: string, durationMs?: number) => void;
  t: TFunction;
  isBatchUpgradeRunningRef: { current: boolean };
}

export function useModUpgradeActions({
  instanceId,
  mods,
  upgradeMod,
  installModVersion,
  loadMods,
  takeSnapshot,
  syncHistoryAfterSnapshot,
  addToast,
  t,
  isBatchUpgradeRunningRef,
}: UseModUpgradeActionsOptions) {
  const [pendingUpgradeMod, setPendingUpgradeMod] = useState<ModMeta | null>(null);
  const [pendingUpgradeVersion, setPendingUpgradeVersion] = useState<OreProjectVersion | null>(null);
  const [pendingUpgradeAction, setPendingUpgradeAction] = useState<ModVersionInstallAction>('upgrade');
  const [isPreparingUpgradeSnapshot, setIsPreparingUpgradeSnapshot] = useState(false);
  const upgradeSnapshotPromptHandledRef = useRef(false);

  useEffect(() => {
    upgradeSnapshotPromptHandledRef.current = false;
    setPendingUpgradeMod(null);
    setPendingUpgradeVersion(null);
    setPendingUpgradeAction('upgrade');
    setIsPreparingUpgradeSnapshot(false);
  }, [instanceId]);

  const handleUpdateAllMods = useCallback(async () => {
    const modsToUpdate = mods.filter((mod) => mod.hasUpdate && !mod.isUpdatingMod);
    if (modsToUpdate.length === 0) {
      return;
    }

    setIsPreparingUpgradeSnapshot(true);
    try {
      await takeSnapshot(
        'MOD_UPDATE',
        t('modPanel.beforeUpdateAllSnapshotMessage', {
          count: modsToUpdate.length,
          defaultValue: `一键更新 ${modsToUpdate.length} 个模组前的快照`
        })
      );
      addToast('success', t('modPanel.updateAllSnapshotSuccess', {
        defaultValue: '成功创建更新前快照。开始批量更新...'
      }));
      await syncHistoryAfterSnapshot();
    } catch (error) {
      console.error(error);
      addToast('error', t('modPanel.updateAllSnapshotFailed', {
        defaultValue: '创建更新前快照失败，已取消批量更新。'
      }));
      return;
    } finally {
      setIsPreparingUpgradeSnapshot(false);
    }

    let successCount = 0;
    let failCount = 0;

    isBatchUpgradeRunningRef.current = true;
    try {
      for (const mod of modsToUpdate) {
        try {
          await upgradeMod(mod, { reloadAfterInstall: false });
          successCount++;
        } catch (error) {
          console.error(`Failed to upgrade mod ${mod.name || mod.fileName}:`, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        await loadMods({ silent: true });
      }
    } finally {
      isBatchUpgradeRunningRef.current = false;
    }

    if (successCount > 0) {
      addToast('success', t('modPanel.updateAllSuccess', {
        count: successCount,
        defaultValue: `成功更新了 ${successCount} 个模组。`
      }));
    }
    if (failCount > 0) {
      addToast('error', t('modPanel.updateAllFailed', {
        count: failCount,
        defaultValue: `${failCount} 个模组更新失败。`
      }));
    }
  }, [addToast, isBatchUpgradeRunningRef, loadMods, mods, syncHistoryAfterSnapshot, t, takeSnapshot, upgradeMod]);

  const getInstallActionLabel = useCallback((action: ModVersionInstallAction) => {
    if (action === 'downgrade') return t('instanceDetail.mods.actionDowngrade', '降级');
    if (action === 'reinstall') return t('instanceDetail.mods.actionReinstall', '重装');
    if (action === 'install') return t('instanceDetail.mods.actionInstall', '安装');
    return t('instanceDetail.mods.actionUpgrade', '升级');
  }, [t]);

  const executeUpgradeMod = useCallback(async (
    mod: ModMeta,
    version?: OreProjectVersion | null,
    action: ModVersionInstallAction = 'upgrade'
  ) => {
    const actionLabel = getInstallActionLabel(action);
    try {
      if (version) {
        await installModVersion(mod, version, action);
      } else {
        await upgradeMod(mod);
      }
      addToast('success', t('modPanel.installVersionSuccess', {
        action: actionLabel,
        name: mod.name || mod.fileName,
        defaultValue: `已${actionLabel}：\n${mod.name || mod.fileName}`
      }));
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      addToast('error', t('modPanel.installVersionFailed', {
        action: actionLabel,
        error: message,
        defaultValue: `${actionLabel}失败：\n${message}`
      }));
    }
  }, [addToast, getInstallActionLabel, installModVersion, t, upgradeMod]);

  const handleUpgradeMod = useCallback((
    mod: ModMeta,
    version?: OreProjectVersion,
    action: ModVersionInstallAction = 'upgrade'
  ) => {
    if ((!version && !mod.hasUpdate) || mod.isUpdatingMod) {
      return;
    }

    if (!upgradeSnapshotPromptHandledRef.current) {
      setPendingUpgradeMod(mod);
      setPendingUpgradeVersion(version || null);
      setPendingUpgradeAction(action);
      return;
    }

    void executeUpgradeMod(mod, version || null, action);
  }, [executeUpgradeMod]);

  const closeUpgradeSnapshotPrompt = useCallback(() => {
    if (isPreparingUpgradeSnapshot) {
      return;
    }

    setPendingUpgradeMod(null);
    setPendingUpgradeVersion(null);
    setPendingUpgradeAction('upgrade');
  }, [isPreparingUpgradeSnapshot]);

  const confirmUpgradeWithSnapshot = useCallback(async () => {
    if (!pendingUpgradeMod) {
      return;
    }

    setIsPreparingUpgradeSnapshot(true);

    try {
      await takeSnapshot(
        'MOD_UPDATE',
        t('modPanel.beforeUpgradeSnapshotMessage', {
          action: getInstallActionLabel(pendingUpgradeAction),
          name: pendingUpgradeMod.name || pendingUpgradeMod.fileName,
          defaultValue: `${getInstallActionLabel(pendingUpgradeAction)} ${pendingUpgradeMod.name || pendingUpgradeMod.fileName} 前的快照`
        })
      );
      upgradeSnapshotPromptHandledRef.current = true;
      const modToUpgrade = pendingUpgradeMod;
      const versionToInstall = pendingUpgradeVersion;
      const actionToRun = pendingUpgradeAction;
      setPendingUpgradeMod(null);
      setPendingUpgradeVersion(null);
      setPendingUpgradeAction('upgrade');
      await executeUpgradeMod(modToUpgrade, versionToInstall, actionToRun);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      addToast('error', t('modPanel.beforeUpgradeSnapshotFailed', {
        error: message,
        defaultValue: `创建${getInstallActionLabel(pendingUpgradeAction)}前快照失败: ${message}`
      }));
    } finally {
      setIsPreparingUpgradeSnapshot(false);
    }
  }, [addToast, executeUpgradeMod, getInstallActionLabel, pendingUpgradeAction, pendingUpgradeMod, pendingUpgradeVersion, t, takeSnapshot]);

  const skipUpgradeSnapshot = useCallback(() => {
    if (!pendingUpgradeMod || isPreparingUpgradeSnapshot) {
      return;
    }

    upgradeSnapshotPromptHandledRef.current = true;
    const modToUpgrade = pendingUpgradeMod;
    const versionToInstall = pendingUpgradeVersion;
    const actionToRun = pendingUpgradeAction;
    setPendingUpgradeMod(null);
    setPendingUpgradeVersion(null);
    setPendingUpgradeAction('upgrade');
    void executeUpgradeMod(modToUpgrade, versionToInstall, actionToRun);
  }, [executeUpgradeMod, isPreparingUpgradeSnapshot, pendingUpgradeAction, pendingUpgradeMod, pendingUpgradeVersion]);

  return {
    handleUpdateAllMods,
    handleUpgradeMod,
    upgradeSnapshotDialog: {
      isOpen: pendingUpgradeMod !== null,
      mod: pendingUpgradeMod,
      action: pendingUpgradeAction,
      actionLabel: getInstallActionLabel(pendingUpgradeAction),
      isCreatingSnapshot: isPreparingUpgradeSnapshot,
      onClose: closeUpgradeSnapshotPrompt,
      onConfirm: confirmUpgradeWithSnapshot,
      onSkip: skipUpgradeSnapshot,
    },
  };
}
