// /src/features/InstanceDetail/components/tabs/SavePanel.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { OreAssetRow } from '../../../../ui/primitives/OreAssetRow';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { Globe, FolderOpen, Archive, Trash2, Loader2, HardDrive, History } from 'lucide-react';

import { useSaveManager } from '../../hooks/useSaveManager';
import { saveService } from '../../logic/saveService';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { SaveRestoreModal } from './saves/SaveRestoreModal';
import { BackupListModal } from './saves/BackupListModal';
import type { SaveBackupMetadata } from '../../logic/saveService';

const TOP_FOCUS_ORDER = ['save-btn-history', 'save-btn-folder'];

export const SavePanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const { saves, backups, isLoading, isBackingUp, backupSave, deleteSave, formatSize, formatDate } = useSaveManager(instanceId);

  const [isBackupListOpen, setIsBackupListOpen] = useState(false);
  const [verifyingBackup, setVerifyingBackup] = useState<SaveBackupMetadata | null>(null);
  const [saveToDelete, setSaveToDelete] = useState<string | null>(null);

  const handleSelectBackup = (backup: SaveBackupMetadata) => {
    setIsBackupListOpen(false);
    setVerifyingBackup(backup);
  };

  const handleOpenFolder = async () => {
    try {
      await saveService.openSavesFolder(instanceId);
    } catch (error) {
      console.error('打开存档目录失败:', error);
    }
  };

  // 全部焦点：顶部 2 个按钮 + 每行 2 个操作按钮
  const fullFocusOrder = useMemo(() => [
    ...TOP_FOCUS_ORDER,
    ...saves.flatMap((_, i) => [`save-btn-backup-${i}`, `save-btn-delete-${i}`])
  ], [saves]);

  const { handleLinearArrow } = useLinearNavigation(fullFocusOrder, fullFocusOrder[0], false);

  // 顶部按钮：末尾向下跳入列表
  const handleTopArrow = useCallback((direction: string) => {
    if (direction === 'down') {
      const available = fullFocusOrder.filter((k) => doesFocusableExist(k));
      const current = getCurrentFocusKey();
      const topAvailable = TOP_FOCUS_ORDER.filter((k) => doesFocusableExist(k));
      if (topAvailable.length > 0 && current === topAvailable[topAvailable.length - 1]) {
        const firstRow = available.find((k) => !TOP_FOCUS_ORDER.includes(k));
        if (firstRow) { setFocus(firstRow); return false; }
      }
    }
    return handleLinearArrow(direction);
  }, [fullFocusOrder, handleLinearArrow]);

  // 列表按钮：第一个向上跳回顶部
  const handleRowArrow = useCallback((direction: string) => {
    if (direction === 'up') {
      const available = fullFocusOrder.filter((k) => doesFocusableExist(k));
      const current = getCurrentFocusKey();
      const firstRow = available.find((k) => !TOP_FOCUS_ORDER.includes(k));
      if (current && firstRow && current === firstRow) {
        const topAvailable = TOP_FOCUS_ORDER.filter((k) => doesFocusableExist(k));
        const target = topAvailable[topAvailable.length - 1];
        if (target) { setFocus(target); return false; }
      }
    }
    return handleLinearArrow(direction);
  }, [fullFocusOrder, handleLinearArrow]);

  return (
    <SettingsPageLayout>
      <div className="relative flex flex-col w-full h-full">
        {/* 顶部控件 */}
        <div className="flex justify-between items-center mb-6 bg-[#18181B] p-4 border-2 border-[#2A2A2C]">
          <div>
            <h3 className="text-white font-minecraft flex items-center">
              <HardDrive size={18} className="mr-2 text-ore-green" /> 存储概览
            </h3>
            <p className="text-sm text-ore-text-muted mt-1">共发现 {saves.length} 个存档，{backups.length} 个历史备份。</p>
          </div>
          <div className="flex space-x-3">
            <OreButton
              focusKey="save-btn-history"
              variant="secondary"
              size="sm"
              onArrowPress={handleTopArrow}
              onClick={() => setIsBackupListOpen(true)}
            >
              <History size={16} className="mr-2" /> 恢复中心
            </OreButton>
            <OreButton
              focusKey="save-btn-folder"
              variant="secondary"
              size="sm"
              onArrowPress={handleTopArrow}
              onClick={handleOpenFolder}
            >
              <FolderOpen size={16} className="mr-2" /> 打开目录
            </OreButton>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12 text-ore-green"><Loader2 size={32} className="animate-spin" /></div>
        ) : (
          <FocusBoundary
            id="save-list"
            trapFocus={false}
            className="flex flex-col space-y-2 overflow-y-auto custom-scrollbar px-2 pb-4"
          >
            {saves.map((save, i) => (
              <OreAssetRow
                key={i}
                focusable={false}
                title={save.worldName}
                description={`最后游玩：${formatDate(save.lastPlayedTime)}`}
                metaItems={[save.folderName, formatSize(save.sizeBytes)]}
                leading={
                  save.iconPath ? (
                    <img
                      src={`${convertFileSrc(save.iconPath)}?t=${save.lastPlayedTime}`}
                      alt="Save Icon"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Globe size={26} className="text-[var(--ore-downloadDetail-labelText)] drop-shadow-md" />
                  )
                }
                trailingClassName="flex items-center space-x-3"
                trailing={
                  <>
                    <OreButton
                      focusKey={`save-btn-backup-${i}`}
                      variant="secondary"
                      size="auto"
                      className="!h-10 !min-h-10"
                      onArrowPress={handleRowArrow}
                      onClick={() => backupSave(save.folderName)}
                      disabled={isBackingUp}
                    >
                      {isBackingUp ? <Loader2 size={16} className="animate-spin mr-2" /> : <Archive size={16} className="mr-2" />}
                      备份
                    </OreButton>

                    <OreButton
                      focusKey={`save-btn-delete-${i}`}
                      variant="danger"
                      size="auto"
                      className="!h-10 !min-h-10"
                      onArrowPress={handleRowArrow}
                      onClick={() => setSaveToDelete(save.folderName)}
                    >
                      <Trash2 size={16} className="mr-2" />
                      删除
                    </OreButton>
                  </>
                }
              />
            ))}
          </FocusBoundary>
        )}

        {/* 弹窗 */}
        <BackupListModal
          isOpen={isBackupListOpen}
          onClose={() => setIsBackupListOpen(false)}
          backups={backups}
          formatSize={formatSize}
          formatDate={formatDate}
          onSelectBackup={handleSelectBackup}
        />

        <SaveRestoreModal
          instanceId={instanceId}
          backupMeta={verifyingBackup}
          onClose={() => setVerifyingBackup(null)}
          onConfirmRestore={(uuid) => {
            alert(`正在恢复快照：${uuid}\n(底层覆盖逻辑开发中...)`);
            setVerifyingBackup(null);
          }}
        />

        <OreModal
          isOpen={saveToDelete !== null}
          onClose={() => setSaveToDelete(null)}
          title="删除存档确认"
          actions={
            <>
              <OreButton
                focusKey="save-del-cancel"
                variant="secondary"
                onClick={() => setSaveToDelete(null)}
                className="flex-1"
              >
                移入回收站
              </OreButton>
              <OreButton
                focusKey="save-del-confirm"
                variant="danger"
                onClick={() => {
                  if (saveToDelete) {
                    deleteSave(saveToDelete, true);
                    setSaveToDelete(null);
                  }
                }}
                className="flex-1"
              >
                强制彻底删除
              </OreButton>
            </>
          }
        >
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2 border-2 border-red-500/20 shadow-[inset_0_0_15px_rgba(239,68,68,0.2)]">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-white font-minecraft">确认删除此存档？</h3>
            <p className="text-ore-text-muted font-minecraft px-4">
              您即将操作存档 <span className="text-red-400 font-bold">"{saveToDelete}"</span>。<br />
              您可以选择将其<strong>移入回收站</strong>（保留7天），或选择<strong>强制彻底删除</strong>（无法恢复）。
            </p>
          </div>
        </OreModal>
      </div>
    </SettingsPageLayout>
  );
};
