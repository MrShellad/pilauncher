import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { message } from '@tauri-apps/plugin-dialog';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { SettingsPageLayout } from '../../../../../ui/layout/SettingsPageLayout';
import { OreConfirmDialog } from '../../../../../ui/primitives/OreConfirmDialog';
import { DirectoryBrowserModal } from '../../../../../ui/components/DirectoryBrowserModal';
import { useLinearNavigation } from '../../../../../ui/focus/useLinearNavigation';
import { useSettingsStore } from '../../../../../store/useSettingsStore';

import { BaseDirectorySection } from './components/BaseDirectorySection';
import { CleanLogsDialog } from './components/CleanLogsDialog';
import { RemoteLogsModal } from './components/RemoteLogsModal';
import { RenameDirModal } from './components/RenameDirModal';
import { ThirdPartyDirsSection } from './components/ThirdPartyDirsSection';
import { useCoreDirectory } from './hooks/useCoreDirectory';
import { useLogCleaner } from './hooks/useLogCleaner';
import { useRemoteLogs } from './hooks/useRemoteLogs';

export const DataSettings: React.FC = () => {
  const { t } = useTranslation();
  const { settings, updateGeneralSetting } = useSettingsStore();
  const thirdPartyDirs = useMemo(() => settings.general.thirdPartyDirs || [], [settings.general.thirdPartyDirs]);
  const basePath = settings.general.basePath;

  const coreDirectory = useCoreDirectory({ basePath, updateGeneralSetting });
  const logCleaner = useLogCleaner();
  const remoteLogs = useRemoteLogs();
  const [removeDirTarget, setRemoveDirTarget] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFocus('settings-data-modify-dir');
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleRemoveDir = useCallback(async () => {
    if (!removeDirTarget) return;

    const dirToRemove = removeDirTarget;
    setRemoveDirTarget(null);

    try {
      const removedCount = await invoke<number>('remove_imported_instances', { dirPath: dirToRemove });
      const updatedDirs = thirdPartyDirs.filter(dir => dir !== dirToRemove);
      updateGeneralSetting('thirdPartyDirs', updatedDirs);
      await message(t('settings.data.removedCountSuccess', { count: removedCount }), {
        title: t('settings.data.success'),
        kind: 'info'
      });
    } catch (e) {
      await message(t('settings.data.failed', { error: e }), {
        title: t('settings.data.error'),
        kind: 'error'
      });
    }
  }, [removeDirTarget, t, thirdPartyDirs, updateGeneralSetting]);

  const focusOrder = useMemo(() => {
    const baseFocus = [
      'settings-data-modify-dir',
      'settings-data-rename-dir',
      'settings-data-clean-logs',
      'settings-data-remote-logs'
    ];
    const thirdPartyFocus = thirdPartyDirs.map((_, idx) => `settings-data-remove-dir-${idx}`);
    return [...baseFocus, ...thirdPartyFocus];
  }, [thirdPartyDirs]);

  const isMainNavigationActive =
    !coreDirectory.browserOpen &&
    !coreDirectory.renameOpen &&
    !removeDirTarget &&
    logCleaner.phase === 'idle' &&
    !remoteLogs.isOpen;

  const { handleLinearArrow } = useLinearNavigation(
    focusOrder,
    'settings-data-modify-dir',
    true,
    isMainNavigationActive
  );

  const renameFocusOrder = ['settings-rename-input', 'settings-rename-submit', 'settings-rename-cancel'];
  const { handleLinearArrow: handleRenameArrow } = useLinearNavigation(
    renameFocusOrder,
    'settings-rename-input',
    true,
    coreDirectory.renameOpen
  );

  return (
    <SettingsPageLayout adaptiveScale>
      <OreConfirmDialog
        isOpen={!!removeDirTarget}
        onClose={() => setRemoveDirTarget(null)}
        onConfirm={handleRemoveDir}
        title={t('settings.data.removeConfirmTitle')}
        headline={t('settings.data.removeConfirmHeadline')}
        description={
          <div className="space-y-2">
            <p className="font-mono text-xs bg-black/30 px-3 py-2 rounded break-all">{removeDirTarget}</p>
            <p>{t('settings.data.removeConfirmDesc1')}</p>
            <p className="text-ore-text-muted text-xs">{t('settings.data.removeConfirmDesc2')}</p>
          </div>
        }
        confirmLabel={t('settings.data.btnRemove')}
        cancelLabel={t('settings.data.btnCancel')}
        confirmVariant="danger"
        tone="warning"
      />

      <CleanLogsDialog
        phase={logCleaner.phase}
        count={logCleaner.count}
        error={logCleaner.error}
        basePath={basePath}
        onClose={logCleaner.close}
        onClean={logCleaner.clean}
      />

      <DirectoryBrowserModal
        isOpen={coreDirectory.browserOpen}
        onClose={coreDirectory.closeBrowser}
        onSelect={coreDirectory.handleDirectorySelected}
        initialPath={basePath}
      />

      <RemoteLogsModal
        isOpen={remoteLogs.isOpen}
        records={remoteLogs.records}
        isLoading={remoteLogs.isLoading}
        error={remoteLogs.error}
        nowUnixSeconds={remoteLogs.nowUnixSeconds}
        deletingUuid={remoteLogs.deletingUuid}
        pendingDelete={remoteLogs.pendingDelete}
        deletedLogId={remoteLogs.deletedLogId}
        onClose={remoteLogs.close}
        onReload={remoteLogs.load}
        onRequestDelete={remoteLogs.requestDelete}
        onCloseDeleteConfirm={remoteLogs.closeDeleteConfirm}
        onConfirmDelete={remoteLogs.confirmDelete}
        onCloseDeleteSuccess={remoteLogs.closeDeleteSuccess}
      />

      <RenameDirModal
        isOpen={coreDirectory.renameOpen}
        newName={coreDirectory.newName}
        onNameChange={coreDirectory.setNewName}
        onClose={coreDirectory.closeRenameModal}
        onSubmit={coreDirectory.submitRename}
        onArrowPress={handleRenameArrow}
      />

      <BaseDirectorySection
        basePath={basePath}
        onOpenBrowser={coreDirectory.openBrowser}
        onOpenRename={coreDirectory.openRenameModal}
        onOpenCleanLogs={logCleaner.openConfirm}
        onOpenRemoteLogs={remoteLogs.open}
        onArrowPress={handleLinearArrow}
      />

      <ThirdPartyDirsSection
        thirdPartyDirs={thirdPartyDirs}
        onRemoveDir={setRemoveDirTarget}
        onArrowPress={handleLinearArrow}
      />
    </SettingsPageLayout>
  );
};

export default DataSettings;
