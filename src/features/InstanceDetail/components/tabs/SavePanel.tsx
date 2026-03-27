// /src/features/InstanceDetail/components/tabs/SavePanel.tsx
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { OreAssetRow } from '../../../../ui/primitives/OreAssetRow';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useInputMode } from '../../../../ui/focus/FocusProvider';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { Globe, FolderOpen, Archive, Trash2, Loader2, HardDrive, History } from 'lucide-react';

import { useSaveManager } from '../../hooks/useSaveManager';
import { saveService } from '../../logic/saveService';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { SaveRestoreModal } from './saves/SaveRestoreModal';
import { BackupListModal } from './saves/BackupListModal';
import type { SaveBackupMetadata } from '../../logic/saveService';

const TOP_FOCUS_ORDER = ['save-btn-history', 'save-btn-folder'];
const ROW_ACTIONS = ['backup', 'delete'] as const;
type RowAction = (typeof ROW_ACTIONS)[number];

export const SavePanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const { saves, backups, isLoading, isBackingUp, backupSave, deleteSave, formatSize, formatDate } = useSaveManager(instanceId);

  const [isBackupListOpen, setIsBackupListOpen] = useState(false);
  const [verifyingBackup, setVerifyingBackup] = useState<SaveBackupMetadata | null>(null);
  const [saveToDelete, setSaveToDelete] = useState<string | null>(null);
  const inputMode = useInputMode();

  const [operationRowIndex, setOperationRowIndex] = useState<number | null>(null);

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

  // 焦点键生成器
  const getRowFocusKey = (index: number) => `save-row-${index}`;
  const getActionFocusKey = (index: number, action: RowAction) => `save-action-${action}-${index}`;

  // 1. 顶层/行级 焦点序列
  const rowLevelOrder = useMemo(() => [
    ...TOP_FOCUS_ORDER,
    ...saves.map((_, i) => getRowFocusKey(i))
  ], [saves]);

  const { handleLinearArrow: handleRowNavigation } = useLinearNavigation(rowLevelOrder, rowLevelOrder[0], false);

  // 2. 进入行内操作模式
  const enterRowOperation = useCallback((index: number) => {
    setOperationRowIndex(index);
    const firstAction = getActionFocusKey(index, 'backup');
    window.setTimeout(() => {
      if (doesFocusableExist(firstAction)) {
        setFocus(firstAction);
      }
    }, 20);
  }, []);

  // 3. 退出行内操作模式
  const exitRowOperation = useCallback((index: number) => {
    setOperationRowIndex(null);
    const rowKey = getRowFocusKey(index);
    window.setTimeout(() => {
      if (doesFocusableExist(rowKey)) {
        setFocus(rowKey);
      }
    }, 20);
  }, []);

  // 处理 Escape 退出操作模式
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && operationRowIndex !== null) {
        exitRowOperation(operationRowIndex);
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [operationRowIndex, exitRowOperation]);

  // 4. 重载顶部按钮导航
  const handleTopArrow = useCallback((direction: string) => {
    if (direction === 'down') {
      const current = getCurrentFocusKey();
      const topAvailable = TOP_FOCUS_ORDER.filter(doesFocusableExist);
      if (topAvailable.length > 0 && current === topAvailable[topAvailable.length - 1]) {
        const firstRow = getRowFocusKey(0);
        if (doesFocusableExist(firstRow)) {
          setFocus(firstRow);
          return false;
        }
      }
    }
    return handleRowNavigation(direction);
  }, [handleRowNavigation]);

  // 5. 行内按钮导航
  const handleActionArrow = useCallback((index: number, action: RowAction, direction: string) => {
    if (inputMode === 'mouse') return true;

    if (direction === 'left' || direction === 'right') {
      const idx = ROW_ACTIONS.indexOf(action);
      const nextIdx = direction === 'right'
        ? Math.min(ROW_ACTIONS.length - 1, idx + 1)
        : Math.max(0, idx - 1);
      const target = getActionFocusKey(index, ROW_ACTIONS[nextIdx]);
      if (doesFocusableExist(target)) setFocus(target);
      return false;
    }

    if (direction === 'up' || direction === 'down') {
      if (direction === 'up' && index === 0) {
        setOperationRowIndex(null);
        const lastTop = TOP_FOCUS_ORDER[TOP_FOCUS_ORDER.length - 1];
        window.setTimeout(() => {
          if (doesFocusableExist(lastTop)) setFocus(lastTop);
        }, 20);
        return false;
      }

      const nextIndex = direction === 'down'
        ? Math.min(saves.length - 1, index + 1)
        : Math.max(0, index - 1);

      if (nextIndex !== index) {
        setOperationRowIndex(nextIndex);
        const target = getActionFocusKey(nextIndex, action);
        window.setTimeout(() => {
          if (doesFocusableExist(target)) setFocus(target);
        }, 20);
      }
      return false;
    }

    return false;
  }, [saves.length, inputMode]);

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
            trapFocus={operationRowIndex !== null}
            className="flex flex-col space-y-2 overflow-y-auto custom-scrollbar px-2 pb-4"
          >
            {saves.map((save, i) => (
              <FocusItem
                key={i}
                focusKey={getRowFocusKey(i)}
                onEnter={() => enterRowOperation(i)}
                onArrowPress={handleRowNavigation}
              >
                {({ ref, focused }) => (
                  <div ref={ref as any}>
                    <OreAssetRow
                      focusable={false}
                      focused={focused}
                      operationActive={operationRowIndex === i}
                      title={save.worldName}
                      description={`最后游玩：${formatDate(save.lastPlayedTime)}`}
                      metaItems={[`文件名：${save.folderName}    大小：${formatSize(save.sizeBytes)}`]}
                      leading={
                        save.iconPath ? (
                          <img
                            src={`${convertFileSrc(save.iconPath)}?t=${save.lastPlayedTime}`}
                            alt="Save Icon"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Globe size={28} className="text-[var(--ore-downloadDetail-labelText)] drop-shadow-md" />
                        )
                      }
                      trailingClassName="flex items-center space-x-3"
                      trailing={
                        <>
                          <OreButton
                            focusKey={getActionFocusKey(i, 'backup')}
                            variant="secondary"
                            size="auto"
                            className="!h-10 !min-h-10"
                            onArrowPress={(dir) => handleActionArrow(i, 'backup', dir)}
                            onClick={() => backupSave(save.folderName)}
                            disabled={isBackingUp}
                          >
                            {isBackingUp ? <Loader2 size={16} className="animate-spin mr-2" /> : <Archive size={16} className="mr-2" />}
                            备份
                          </OreButton>

                          <OreButton
                            focusKey={getActionFocusKey(i, 'delete')}
                            variant="danger"
                            size="auto"
                            className="!h-10 !min-h-10"
                            onArrowPress={(dir) => handleActionArrow(i, 'delete', dir)}
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('Delete button clicked for:', save.folderName);
                              setSaveToDelete(save.folderName);
                            }}
                          >
                            <Trash2 size={16} className="mr-2" />
                            删除
                          </OreButton>
                        </>
                      }
                    />
                  </div>
                )}
              </FocusItem>
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
