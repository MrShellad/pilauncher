import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  doesFocusableExist,
  getCurrentFocusKey,
  setFocus,
} from '@noriginmedia/norigin-spatial-navigation';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  FolderOpen,
  Globe,
  HardDrive,
  History,
  Loader2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { focusManager } from '../../../../ui/focus/FocusManager';
import { useInputMode } from '../../../../ui/focus/FocusProvider';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { OreAssetRow } from '../../../../ui/primitives/OreAssetRow';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';

import { useSaveManager } from '../../hooks/useSaveManager';
import { saveService, type SaveBackupMetadata } from '../../logic/saveService';
import { BackupListModal, getBackupActionFocusKey } from './saves/BackupListModal';
import { SaveRestoreModal } from './saves/SaveRestoreModal';

const TOP_FOCUS_ORDER = ['save-btn-history', 'save-btn-folder'];
const ROW_ACTIONS = ['backup', 'history', 'delete'] as const;
type RowAction = (typeof ROW_ACTIONS)[number];

const formatTrigger = (trigger: string) => {
  switch (trigger) {
    case 'manual':
      return '手动';
    case 'auto_exit':
      return '退出';
    case 'auto_interval':
      return '定时';
    case 'restore_guard':
      return '恢复前';
    case 'legacy':
      return '旧版';
    default:
      return trigger || '未知';
  }
};

export const SavePanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const {
    saves,
    backups,
    isLoading,
    isBackingUp,
    isRestoring,
    isDeletingBackup,
    backupProgress,
    backupSave,
    restoreBackup,
    deleteSave,
    deleteBackup,
    clearBackupProgress,
    formatSize,
    formatDate,
  } = useSaveManager(instanceId);

  const [isBackupListOpen, setIsBackupListOpen] = useState(false);
  const [backupListWorldUuid, setBackupListWorldUuid] = useState<string | null>(null);
  const [backupListTitle, setBackupListTitle] = useState('恢复中心');
  const [verifyingBackup, setVerifyingBackup] = useState<SaveBackupMetadata | null>(null);
  const [backupToDelete, setBackupToDelete] = useState<SaveBackupMetadata | null>(null);
  const [backupDeleteReturnFocusKey, setBackupDeleteReturnFocusKey] = useState<string | null>(
    null
  );
  const [saveToDelete, setSaveToDelete] = useState<string | null>(null);
  const [pendingBackupSave, setPendingBackupSave] = useState<{
    folderName: string;
    worldName: string;
  } | null>(null);
  const [activeBackupSave, setActiveBackupSave] = useState<{
    folderName: string;
    worldName: string;
  } | null>(null);
  const [operationRowIndex, setOperationRowIndex] = useState<number | null>(null);
  const [returnFocusKey, setReturnFocusKey] = useState<string>('save-btn-history');
  const backupProgressTimerRef = useRef<number | null>(null);
  const inputMode = useInputMode();

  const backupSummaryByWorld = useMemo(() => {
    const summary = new Map<
      string,
      { count: number; latest: SaveBackupMetadata | null }
    >();

    for (const backup of backups) {
      const key = backup.world.uuid || backup.world.folderName;
      const current = summary.get(key);
      if (!current) {
        summary.set(key, { count: 1, latest: backup });
        continue;
      }

      summary.set(key, {
        count: current.count + 1,
        latest:
          !current.latest || backup.createdAt > current.latest.createdAt
            ? backup
            : current.latest,
      });
    }

    return summary;
  }, [backups]);

  const visibleBackups = useMemo(() => {
    if (!backupListWorldUuid) return backups;
    return backups.filter(
      (backup) =>
        backup.world.uuid === backupListWorldUuid ||
        backup.world.folderName === backupListWorldUuid
    );
  }, [backups, backupListWorldUuid]);

  const getRowFocusKey = (index: number) => `save-row-${index}`;
  const getActionFocusKey = (index: number, action: RowAction) =>
    `save-action-${action}-${index}`;

  const rowLevelOrder = useMemo(
    () => [...TOP_FOCUS_ORDER, ...saves.map((_, index) => getRowFocusKey(index))],
    [saves]
  );
  const { handleLinearArrow: handleRowNavigation } = useLinearNavigation(
    rowLevelOrder,
    rowLevelOrder[0],
    false
  );

  const restoreSavePanelFocus = useCallback(
    (fallback = returnFocusKey) => {
      window.setTimeout(() => {
        if (fallback && doesFocusableExist(fallback)) {
          setFocus(fallback);
          return;
        }
        focusManager.restoreFocus('tab-boundary-saves', 'save-btn-history');
      }, 60);
    },
    [returnFocusKey]
  );

  const openBackupList = useCallback(
    (title: string, worldUuid: string | null, focusKey: string) => {
      setReturnFocusKey(focusKey);
      setBackupListTitle(title);
      setBackupListWorldUuid(worldUuid);
      setIsBackupListOpen(true);
    },
    []
  );

  const closeBackupList = useCallback(() => {
    setIsBackupListOpen(false);
    setBackupListWorldUuid(null);
    setBackupDeleteReturnFocusKey(null);
    restoreSavePanelFocus();
  }, [restoreSavePanelFocus]);

  const restoreBackupListFocus = useCallback(
    (fallback?: string | null) => {
      window.setTimeout(() => {
        const focusCandidates = [
          fallback ?? undefined,
          ...visibleBackups.flatMap((backup) => [
            getBackupActionFocusKey(backup.backupId, 'restore'),
            getBackupActionFocusKey(backup.backupId, 'delete'),
          ]),
          'backup-list-empty-close',
        ].filter((focusKey): focusKey is string => !!focusKey);

        const targetKey = focusCandidates.find((focusKey) => doesFocusableExist(focusKey));
        if (targetKey) {
          setFocus(targetKey);
          return;
        }

        closeBackupList();
      }, 60);
    },
    [closeBackupList, visibleBackups]
  );

  const closeRestoreModal = useCallback(() => {
    setVerifyingBackup(null);
    restoreSavePanelFocus();
  }, [restoreSavePanelFocus]);

  useEffect(() => {
    return () => {
      if (backupProgressTimerRef.current) {
        window.clearTimeout(backupProgressTimerRef.current);
      }
    };
  }, []);

  const handleSelectBackup = useCallback(
    (backup: SaveBackupMetadata) => {
      setIsBackupListOpen(false);
      setBackupDeleteReturnFocusKey(null);
      setVerifyingBackup(backup);
    },
    []
  );

  const handleOpenFolder = async () => {
    try {
      await saveService.openSavesFolder(instanceId);
    } catch (error) {
      console.error('Failed to open saves folder:', error);
    }
  };

  const closeBackupConfirmModal = useCallback(() => {
    setPendingBackupSave(null);
    restoreSavePanelFocus();
  }, [restoreSavePanelFocus]);

  const openBackupDeleteModal = useCallback(
    (backup: SaveBackupMetadata, focusKey: string) => {
      setBackupDeleteReturnFocusKey(focusKey);
      setBackupToDelete(backup);
    },
    []
  );

  const closeBackupDeleteModal = useCallback(() => {
    setBackupToDelete(null);
    if (isBackupListOpen) {
      restoreBackupListFocus(backupDeleteReturnFocusKey);
      return;
    }
    restoreSavePanelFocus();
  }, [
    backupDeleteReturnFocusKey,
    isBackupListOpen,
    restoreBackupListFocus,
    restoreSavePanelFocus,
  ]);

  const completeBackupFlow = useCallback(
    (delayMs = 0) => {
      if (backupProgressTimerRef.current) {
        window.clearTimeout(backupProgressTimerRef.current);
      }

      backupProgressTimerRef.current = window.setTimeout(() => {
        clearBackupProgress();
        setActiveBackupSave(null);
        restoreSavePanelFocus();
      }, delayMs);
    },
    [clearBackupProgress, restoreSavePanelFocus]
  );

  const handleConfirmBackup = useCallback(async () => {
    if (!pendingBackupSave) return;

    const target = pendingBackupSave;
    setPendingBackupSave(null);
    setActiveBackupSave(target);

    try {
      await backupSave(target.folderName);
      completeBackupFlow(900);
    } catch (error) {
      clearBackupProgress();
      setActiveBackupSave(null);
      alert(`备份失败: ${error}`);
      restoreSavePanelFocus();
    }
  }, [
    pendingBackupSave,
    backupSave,
    completeBackupFlow,
    clearBackupProgress,
    restoreSavePanelFocus,
  ]);

  const handleConfirmDeleteBackup = useCallback(async () => {
    if (!backupToDelete) return;

    const fallbackFocusKey = backupDeleteReturnFocusKey;

    try {
      await deleteBackup(backupToDelete.backupId);
      setBackupToDelete(null);

      if (isBackupListOpen) {
        restoreBackupListFocus(fallbackFocusKey);
        return;
      }

      restoreSavePanelFocus();
    } catch (error) {
      alert(`删除备份失败: ${error}`);
      window.setTimeout(() => {
        if (doesFocusableExist('backup-del-confirm')) {
          setFocus('backup-del-confirm');
        }
      }, 60);
    }
  }, [
    backupDeleteReturnFocusKey,
    backupToDelete,
    deleteBackup,
    isBackupListOpen,
    restoreBackupListFocus,
    restoreSavePanelFocus,
  ]);

  const enterRowOperation = useCallback((index: number) => {
    setOperationRowIndex(index);
    const firstAction = getActionFocusKey(index, 'backup');
    window.setTimeout(() => {
      if (doesFocusableExist(firstAction)) {
        setFocus(firstAction);
      }
    }, 20);
  }, []);

  const exitRowOperation = useCallback((index: number) => {
    setOperationRowIndex(null);
    const rowFocusKey = getRowFocusKey(index);
    window.setTimeout(() => {
      if (doesFocusableExist(rowFocusKey)) {
        setFocus(rowFocusKey);
      }
    }, 20);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || operationRowIndex === null) return;
      exitRowOperation(operationRowIndex);
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [operationRowIndex, exitRowOperation]);

  const handleTopArrow = useCallback(
    (direction: string) => {
      if (direction === 'down') {
        const current = getCurrentFocusKey();
        const topAvailable = TOP_FOCUS_ORDER.filter((focusKey) => doesFocusableExist(focusKey));
        if (topAvailable.length > 0 && current === topAvailable[topAvailable.length - 1]) {
          const firstRow = getRowFocusKey(0);
          if (doesFocusableExist(firstRow)) {
            setFocus(firstRow);
            return false;
          }
        }
      }

      return handleRowNavigation(direction);
    },
    [handleRowNavigation]
  );

  const handleActionArrow = useCallback(
    (index: number, action: RowAction, direction: string) => {
      if (inputMode === 'mouse') return true;

      if (direction === 'left' || direction === 'right') {
        const currentIndex = ROW_ACTIONS.indexOf(action);
        const nextIndex =
          direction === 'right'
            ? Math.min(ROW_ACTIONS.length - 1, currentIndex + 1)
            : Math.max(0, currentIndex - 1);
        const target = getActionFocusKey(index, ROW_ACTIONS[nextIndex]);
        if (doesFocusableExist(target)) {
          setFocus(target);
        }
        return false;
      }

      if (direction === 'up' || direction === 'down') {
        if (direction === 'up' && index === 0) {
          setOperationRowIndex(null);
          const lastTop = TOP_FOCUS_ORDER[TOP_FOCUS_ORDER.length - 1];
          window.setTimeout(() => {
            if (doesFocusableExist(lastTop)) {
              setFocus(lastTop);
            }
          }, 20);
          return false;
        }

        const nextRowIndex =
          direction === 'down'
            ? Math.min(saves.length - 1, index + 1)
            : Math.max(0, index - 1);

        if (nextRowIndex !== index) {
          setOperationRowIndex(nextRowIndex);
          const target = getActionFocusKey(nextRowIndex, action);
          window.setTimeout(() => {
            if (doesFocusableExist(target)) {
              setFocus(target);
            }
          }, 20);
        }

        return false;
      }

      return false;
    },
    [inputMode, saves.length]
  );

  const backupProgressPercent = backupProgress
    ? Math.round((backupProgress.current / Math.max(backupProgress.total, 1)) * 100)
    : 0;
  const activeBackupLabel =
    activeBackupSave?.worldName ||
    activeBackupSave?.folderName ||
    backupProgress?.folderName ||
    '';
  const backupStageLabel = (() => {
    switch (backupProgress?.stage) {
      case 'QUEUE':
        return '等待启动';
      case 'PREPARE':
        return '准备快照';
      case 'PACK_WORLD':
        return '压缩世界数据';
      case 'PACK_CONFIGS':
        return '压缩配置文件';
      case 'FINALIZE':
        return '写入元数据';
      case 'DONE':
        return '备份完成';
      case 'ERROR':
        return '备份失败';
      default:
        return '处理中';
    }
  })();
  const backupStatusTitle =
    backupProgress?.stage === 'DONE'
      ? '压缩备份已完成'
      : backupProgress?.stage === 'ERROR'
        ? '备份任务失败'
        : '正在压缩存档备份';
  const backupStatusMessage =
    backupProgress?.stage === 'DONE'
      ? `${activeBackupLabel || '当前世界'} 已生成新的压缩快照。`
      : backupProgress?.stage === 'ERROR'
        ? backupProgress.message
        : backupProgress?.message || '正在准备文件并生成压缩包...';
  const isBackupProgressOpen = !!activeBackupSave && (!!backupProgress || isBackingUp);

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
              onArrowPress={handleTopArrow}
              onClick={() => openBackupList('恢复中心', null, 'save-btn-history')}
            >
              <History size={16} className="mr-2" />
              恢复中心
            </OreButton>

            <OreButton
              focusKey="save-btn-folder"
              variant="secondary"
              size="sm"
              onArrowPress={handleTopArrow}
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
            trapFocus={operationRowIndex !== null}
            className="flex flex-col space-y-2 overflow-y-auto px-2 pb-4 custom-scrollbar"
          >
            {saves.map((save, index) => {
              const summary =
                backupSummaryByWorld.get(save.worldUuid) ??
                backupSummaryByWorld.get(save.folderName) ?? {
                  count: 0,
                  latest: null,
                };
              const latestBackup = summary.latest;
              const isCurrentBackupTarget =
                isBackingUp && activeBackupSave?.folderName === save.folderName;

              return (
                <FocusItem
                  key={save.worldUuid || save.folderName}
                  focusKey={getRowFocusKey(index)}
                  onEnter={() => enterRowOperation(index)}
                  onArrowPress={handleRowNavigation}
                >
                  {({ ref, focused }) => (
                    <div ref={ref as React.RefObject<HTMLDivElement>}>
                      <OreAssetRow
                        focusable={false}
                        focused={focused}
                        operationActive={operationRowIndex === index}
                        title={save.worldName}
                        description={
                          latestBackup
                            ? `最近备份：${formatDate(latestBackup.createdAt)} · ${formatTrigger(
                                latestBackup.trigger
                              )}`
                            : `最后游玩：${formatDate(save.lastPlayedTime)}`
                        }
                        metaItems={[
                          `文件夹：${save.folderName}`,
                          `世界大小：${formatSize(save.sizeBytes)}`,
                          summary.count > 0
                            ? `备份 ${summary.count} 个`
                            : '暂无备份',
                        ]}
                        leading={
                          save.iconPath ? (
                            <img
                              src={`${convertFileSrc(save.iconPath)}?t=${save.lastPlayedTime}`}
                              alt="Save Icon"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Globe
                              size={28}
                              className="text-[var(--ore-downloadDetail-labelText)] drop-shadow-md"
                            />
                          )
                        }
                        badges={
                          latestBackup?.state.safeBackup ? (
                            <span className="inline-flex items-center gap-1 rounded-sm border border-ore-green/40 bg-ore-green/10 px-2 py-0.5 text-[11px] text-ore-green">
                              <ShieldCheck size={12} />
                              安全快照
                            </span>
                          ) : null
                        }
                        trailingClassName="flex items-center space-x-3"
                        trailing={
                          <>
                            <OreButton
                              focusKey={getActionFocusKey(index, 'backup')}
                              variant="secondary"
                              size="auto"
                              className="!h-10 !min-h-10"
                              onArrowPress={(direction) =>
                                handleActionArrow(index, 'backup', direction)
                              }
                              onClick={() => {
                                setReturnFocusKey(getActionFocusKey(index, 'backup'));
                                setPendingBackupSave({
                                  folderName: save.folderName,
                                  worldName: save.worldName,
                                });
                              }}
                              disabled={isBackingUp || isRestoring}
                            >
                              {isCurrentBackupTarget ? (
                                <Loader2 size={16} className="mr-2 animate-spin" />
                              ) : (
                                <Archive size={16} className="mr-2" />
                              )}
                              立即备份
                            </OreButton>

                            <OreButton
                              focusKey={getActionFocusKey(index, 'history')}
                              variant="secondary"
                              size="auto"
                              className="!h-10 !min-h-10"
                              onArrowPress={(direction) =>
                                handleActionArrow(index, 'history', direction)
                              }
                              onClick={() =>
                                openBackupList(
                                  `${save.worldName} 的备份记录`,
                                  save.worldUuid || save.folderName,
                                  getActionFocusKey(index, 'history')
                                )
                              }
                            >
                              <History size={16} className="mr-2" />
                              查看历史
                            </OreButton>

                            <OreButton
                              focusKey={getActionFocusKey(index, 'delete')}
                              variant="danger"
                              size="auto"
                              className="!h-10 !min-h-10"
                              onArrowPress={(direction) =>
                                handleActionArrow(index, 'delete', direction)
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                setReturnFocusKey(getActionFocusKey(index, 'delete'));
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
              );
            })}
          </FocusBoundary>
        )}

        <BackupListModal
          isOpen={isBackupListOpen}
          onClose={closeBackupList}
          title={backupListTitle}
          backups={visibleBackups}
          formatSize={formatSize}
          formatDate={formatDate}
          deletingBackupId={isDeletingBackup ? backupToDelete?.backupId ?? null : null}
          isBusy={isRestoring || isDeletingBackup}
          onSelectBackup={handleSelectBackup}
          onDeleteBackup={openBackupDeleteModal}
        />

        <OreModal
          isOpen={backupToDelete !== null}
          onClose={isDeletingBackup ? () => {} : closeBackupDeleteModal}
          title="删除备份确认"
          closeOnOutsideClick={!isDeletingBackup}
          actions={
            <>
              <OreButton
                focusKey="backup-del-cancel"
                variant="secondary"
                onClick={closeBackupDeleteModal}
                disabled={isDeletingBackup}
                className="flex-1"
              >
                取消
              </OreButton>
              <OreButton
                focusKey="backup-del-confirm"
                variant="danger"
                onClick={() => {
                  void handleConfirmDeleteBackup();
                }}
                disabled={isDeletingBackup}
                className="flex-1"
              >
                {isDeletingBackup ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Trash2 size={16} className="mr-2" />
                )}
                删除备份
              </OreButton>
            </>
          }
        >
          <div className="flex flex-col items-center justify-center space-y-4 p-6 text-center">
            <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-500/20 bg-red-500/10 text-red-500 shadow-[inset_0_0_15px_rgba(239,68,68,0.2)]">
              <Trash2 size={32} />
            </div>
            <h3 className="font-minecraft text-xl font-bold text-white">确认删除这个备份？</h3>
            <p className="max-w-xl px-4 font-minecraft text-ore-text-muted">
              目标快照：
              <span className="font-bold text-white">
                {' '}
                {backupToDelete?.world.name}
              </span>
              。创建时间为
              <span className="font-bold text-white">
                {' '}
                {backupToDelete ? formatDate(backupToDelete.createdAt) : ''}
              </span>
              ，删除后将无法再从恢复中心还原这个快照，但不会影响当前存档本体。
            </p>
          </div>
        </OreModal>

        <SaveRestoreModal
          instanceId={instanceId}
          backupMeta={verifyingBackup}
          isRestoring={isRestoring}
          formatDate={formatDate}
          formatSize={formatSize}
          onClose={closeRestoreModal}
          onConfirmRestore={async ({ backupId, restoreConfigs }) => {
            const result = await restoreBackup(backupId, restoreConfigs);
            const guardText = result.guardBackupId
              ? `\n已自动创建恢复前保护备份：${result.guardBackupId}`
              : '';
            alert(
              `已恢复世界 “${result.restoredFolderName}”。${
                result.restoredConfigs ? '\n已同时恢复配置文件。' : ''
              }${guardText}`
            );
            setVerifyingBackup(null);
            restoreSavePanelFocus();
          }}
        />

        <OreModal
          isOpen={pendingBackupSave !== null}
          onClose={closeBackupConfirmModal}
          title="立即备份确认"
          actions={
            <>
              <OreButton
                focusKey="save-backup-cancel"
                variant="secondary"
                onClick={closeBackupConfirmModal}
                className="flex-1"
              >
                取消
              </OreButton>
              <OreButton
                focusKey="save-backup-confirm"
                variant="primary"
                onClick={() => {
                  void handleConfirmBackup();
                }}
                className="flex-1"
              >
                立即开始
              </OreButton>
            </>
          }
        >
          <div className="flex flex-col items-center justify-center space-y-4 p-6 text-center">
            <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#FFE866]/25 bg-[#FFE866]/10 text-[#FFE866] shadow-[inset_0_0_15px_rgba(255,232,102,0.16)]">
              <AlertTriangle size={32} />
            </div>
            <h3 className="font-minecraft text-xl font-bold text-white">
              确认立即备份这个世界？
            </h3>
            <p className="max-w-xl px-4 font-minecraft text-ore-text-muted">
              目标世界：
              <span className="font-bold text-white">
                {' '}
                {pendingBackupSave?.worldName || pendingBackupSave?.folderName}
              </span>
              。备份时会压缩打包当前存档内容，并一并生成配置文件快照。为了避免拿到不完整数据，建议在游戏退出后再执行。
            </p>
          </div>
        </OreModal>

        <OreModal
          isOpen={isBackupProgressOpen}
          onClose={() => {}}
          title={backupStatusTitle}
          hideCloseButton={true}
          closeOnOutsideClick={false}
          className="w-[42rem] max-w-[calc(100vw-2rem)]"
        >
          <div className="flex min-h-[21rem] flex-col items-center justify-center space-y-7 p-8 text-center">
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-full border-[3px] shadow-[inset_0_0_18px_rgba(255,255,255,0.08)] ${
                backupProgress?.stage === 'DONE'
                  ? 'border-ore-green/40 bg-ore-green/10 text-ore-green'
                  : 'border-[#2A2A2C] bg-[#18181B] text-ore-green'
              }`}
            >
              {backupProgress?.stage === 'DONE' ? (
                <CheckCircle2 size={40} />
              ) : (
                <Loader2 size={40} className="animate-spin" />
              )}
            </div>

            <div className="w-full max-w-xl space-y-2">
              <h3 className="font-minecraft text-2xl font-bold tracking-widest text-white">
                {backupStatusTitle}
              </h3>
              <p className="text-sm text-ore-text-muted">
                {activeBackupLabel ? `${activeBackupLabel} · ${backupStageLabel}` : backupStageLabel}
              </p>
            </div>

            <div className="w-full max-w-xl space-y-4">
              <div className="overflow-hidden rounded-full border-2 border-[#2A2A2C] bg-[#141415] shadow-inner">
                <div
                  className="h-4 bg-[length:20px_20px] bg-[linear-gradient(45deg,rgba(255,255,255,.14)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.14)_50%,rgba(255,255,255,.14)_75%,transparent_75%,transparent)] bg-[#3C8527] shadow-[inset_0_2px_rgba(255,255,255,0.3),inset_0_-2px_rgba(0,0,0,0.2)] transition-[width] duration-200"
                  style={{ width: `${backupProgressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.18em] text-[#A1A3A5]">
                <span>{backupStageLabel}</span>
                <span className="text-ore-green">{backupProgressPercent}%</span>
              </div>

              <div className="rounded-sm border border-[#2A2A2C] bg-[#18181B] px-4 py-3 text-left text-sm text-[#D0D1D4] shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
                {backupStatusMessage}
              </div>
            </div>
          </div>
        </OreModal>

        <OreModal
          isOpen={saveToDelete !== null}
          onClose={() => {
            setSaveToDelete(null);
            restoreSavePanelFocus();
          }}
          title="删除存档确认"
          actions={
            <>
              <OreButton
                focusKey="save-del-cancel"
                variant="secondary"
                onClick={() => {
                  if (!saveToDelete) return;
                  deleteSave(saveToDelete, false);
                  setSaveToDelete(null);
                  restoreSavePanelFocus();
                }}
                className="flex-1"
              >
                移入回收站
              </OreButton>
              <OreButton
                focusKey="save-del-confirm"
                variant="danger"
                onClick={() => {
                  if (!saveToDelete) return;
                  deleteSave(saveToDelete, true);
                  setSaveToDelete(null);
                  restoreSavePanelFocus();
                }}
                className="flex-1"
              >
                彻底删除
              </OreButton>
            </>
          }
        >
          <div className="flex flex-col items-center justify-center space-y-4 p-6 text-center">
            <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-500/20 bg-red-500/10 text-red-500 shadow-[inset_0_0_15px_rgba(239,68,68,0.2)]">
              <Trash2 size={32} />
            </div>
            <h3 className="font-minecraft text-xl font-bold text-white">
              确认删除这个世界？
            </h3>
            <p className="px-4 font-minecraft text-ore-text-muted">
              目标世界：
              <span className="font-bold text-red-300">“{saveToDelete}”</span>
              。您可以先移入回收站保留一段时间，也可以直接彻底删除。
            </p>
          </div>
        </OreModal>
      </div>
    </SettingsPageLayout>
  );
};
