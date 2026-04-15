import React, { useCallback } from 'react';
import { FolderOpen, HardDrive, History, Loader2 } from 'lucide-react';

import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { OreButton } from '../../../../ui/primitives/OreButton';

import { saveService } from '../../logic/saveService';
import { BackupListModal } from './saves/BackupListModal';
import { SaveRestoreModal } from './saves/SaveRestoreModal';
import { BackupDeleteConfirmModal } from './saves/BackupDeleteConfirmModal';
import { BackupConfirmModal } from './saves/BackupConfirmModal';
import { BackupProgressModal } from './saves/BackupProgressModal';
import { SaveDeleteConfirmModal } from './saves/SaveDeleteConfirmModal';
import { SaveListRow } from './saves/SaveListRow';
import { getActionFocusKey, useSavePanel } from './saves/useSavePanel';

export const SavePanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const { manager, state, actions } = useSavePanel(instanceId);
  const {
    saves,
    backups,
    isLoading,
    isBackingUp,
    isRestoring,
    isDeletingBackup,
    backupProgress,
    restoreBackup,
    deleteSave,
    formatSize,
    formatDate,
  } = manager;

  const handleOpenFolder = useCallback(async () => {
    try {
      await saveService.openSavesFolder(instanceId);
    } catch (error) {
      console.error('Failed to open saves folder:', error);
    }
  }, [instanceId]);

  return (
    <SettingsPageLayout>
      <div className="relative flex h-full w-full flex-col">
        <div className="mb-6 flex items-center justify-between border-2 border-[#2A2A2C] bg-[#18181B] p-4">
          <div>
            <h3 className="flex items-center font-minecraft text-white">
              <HardDrive size={18} className="mr-2 text-ore-green" />
              存档备份
            </h3>
            <p className="mt-1 text-sm text-ore-text-muted">
              共发现 {saves.length} 个世界，已有 {backups.length} 个历史备份。
            </p>
          </div>

          <div className="flex space-x-3">
            <OreButton
              focusKey="save-btn-history"
              variant="secondary"
              size="sm"
              onArrowPress={actions.handleTopArrow}
              onClick={() => actions.openBackupList('恢复中心', null, 'save-btn-history')}
            >
              <History size={16} className="mr-2" />
              恢复中心
            </OreButton>

            <OreButton
              focusKey="save-btn-folder"
              variant="secondary"
              size="sm"
              onArrowPress={actions.handleTopArrow}
              onClick={handleOpenFolder}
            >
              <FolderOpen size={16} className="mr-2" />
              打开目录
            </OreButton>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12 text-ore-green">
            <Loader2 size={32} className="animate-spin" />
          </div>
        ) : (
          <FocusBoundary
            id="save-list"
            trapFocus={state.operationRowIndex !== null}
            className="flex flex-col space-y-2 overflow-y-auto px-2 pb-4 custom-scrollbar"
          >
            {saves.map((save, index) => {
              const summary = state.backupSummaryByWorld.get(save.worldUuid) ?? state.backupSummaryByWorld.get(save.folderName) ?? { count: 0, latest: null };
              const isCurrentBackupTarget = isBackingUp && state.activeBackupSave?.folderName === save.folderName;

              return (
                <SaveListRow
                  key={save.worldUuid || save.folderName}
                  index={index}
                  save={save}
                  summary={summary}
                  operationRowIndex={state.operationRowIndex}
                  isBackingUp={isBackingUp}
                  isRestoring={isRestoring}
                  isCurrentBackupTarget={isCurrentBackupTarget}
                  formatSize={formatSize}
                  formatDate={formatDate}
                  onEnterContext={actions.enterRowOperation}
                  onArrowPress={actions.handleRowNavigation}
                  onActionArrow={actions.handleActionArrow}
                  onBackup={(idx, saveObj) => {
                    actions.setReturnFocusKey(getActionFocusKey(idx, 'backup'));
                    actions.setPendingBackupSave({ folderName: saveObj.folderName, worldName: saveObj.worldName });
                  }}
                  onHistory={(idx, saveObj) => {
                    actions.openBackupList(`${saveObj.worldName} 的备份记录`, saveObj.worldUuid || saveObj.folderName, getActionFocusKey(idx, 'history'));
                  }}
                  onDelete={(idx, saveObj, e) => {
                    e.stopPropagation();
                    actions.setReturnFocusKey(getActionFocusKey(idx, 'delete'));
                    actions.setSaveToDelete(saveObj.folderName);
                  }}
                />
              );
            })}
          </FocusBoundary>
        )}

        <BackupListModal
          isOpen={state.isBackupListOpen}
          onClose={actions.closeBackupList}
          title={state.backupListTitle}
          backups={state.visibleBackups}
          formatSize={formatSize}
          formatDate={formatDate}
          deletingBackupId={isDeletingBackup ? state.backupToDelete?.backupId ?? null : null}
          isBusy={isRestoring || isDeletingBackup}
          onSelectBackup={actions.handleSelectBackup}
          onDeleteBackup={actions.openBackupDeleteModal}
        />

        <BackupDeleteConfirmModal
          backupToDelete={state.backupToDelete}
          isDeletingBackup={isDeletingBackup}
          formatDate={formatDate}
          onClose={actions.closeBackupDeleteModal}
          onConfirm={() => { void actions.handleConfirmDeleteBackup(); }}
        />

        <SaveRestoreModal
          instanceId={instanceId}
          backupMeta={state.verifyingBackup}
          isRestoring={isRestoring}
          formatDate={formatDate}
          formatSize={formatSize}
          onClose={actions.closeRestoreModal}
          onConfirmRestore={async ({ backupId, restoreConfigs }) => {
            const result = await restoreBackup(backupId, restoreConfigs);
            const guardText = result.guardBackupId ? `\n已自动创建恢复前保护备份：${result.guardBackupId}` : '';
            alert(`已恢复世界 “${result.restoredFolderName}”。${result.restoredConfigs ? '\n已同时恢复配置文件。' : ''}${guardText}`);
            actions.setVerifyingBackup(null);
            actions.restoreSavePanelFocus();
          }}
        />

        <BackupConfirmModal
          pendingBackupSave={state.pendingBackupSave}
          hasFullBackup={backups.some(b => (b.world.folderName === state.pendingBackupSave?.folderName || b.world.uuid === state.pendingBackupSave?.folderName) && (b.backupMode === 'full' || !b.backupMode))}
          onClose={actions.closeBackupConfirmModal}
          onConfirm={(mode) => { void actions.handleConfirmBackup(mode); }}
        />

        <BackupProgressModal
          isBackupProgressOpen={state.isBackupProgressOpen}
          activeBackupSave={state.activeBackupSave}
          backupProgress={backupProgress}
        />

        <SaveDeleteConfirmModal
          saveToDelete={state.saveToDelete}
          onClose={() => { actions.setSaveToDelete(null); actions.restoreSavePanelFocus(); }}
          onDelete={(save, permanent) => {
            deleteSave(save, permanent);
            actions.setSaveToDelete(null);
            actions.restoreSavePanelFocus();
          }}
        />
      </div>
    </SettingsPageLayout>
  );
};
