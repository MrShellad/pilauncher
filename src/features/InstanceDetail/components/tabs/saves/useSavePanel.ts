import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { focusManager } from '../../../../../ui/focus/FocusManager';
import { useInputMode } from '../../../../../ui/focus/FocusProvider';
import { useLinearNavigation } from '../../../../../ui/focus/useLinearNavigation';
import { useSaveManager } from '../../../hooks/useSaveManager';
import { type SaveBackupMetadata } from '../../../logic/saveService';
import { getBackupActionFocusKey } from './BackupListModal';

export const TOP_FOCUS_ORDER = ['save-btn-history', 'save-btn-folder'];
export const ROW_ACTIONS = ['backup', 'history', 'delete'] as const;
export type RowAction = (typeof ROW_ACTIONS)[number];

export const getRowFocusKey = (index: number) => `save-row-${index}`;
export const getActionFocusKey = (index: number, action: RowAction) => `save-action-${action}-${index}`;

export const useSavePanel = (instanceId: string) => {
  const manager = useSaveManager(instanceId);
  const {
    saves,
    backups,
    isBackingUp,
    backupProgress,
    backupSave,
    deleteBackup,
    clearBackupProgress,
  } = manager;

  const [isBackupListOpen, setIsBackupListOpen] = useState(false);
  const [backupListWorldUuid, setBackupListWorldUuid] = useState<string | null>(null);
  const [backupListTitle, setBackupListTitle] = useState('恢复中心');
  const [verifyingBackup, setVerifyingBackup] = useState<SaveBackupMetadata | null>(null);
  const [backupToDelete, setBackupToDelete] = useState<SaveBackupMetadata | null>(null);
  const [backupDeleteReturnFocusKey, setBackupDeleteReturnFocusKey] = useState<string | null>(null);
  const [saveToDelete, setSaveToDelete] = useState<string | null>(null);
  const [pendingBackupSave, setPendingBackupSave] = useState<{ folderName: string; worldName: string } | null>(null);
  const [activeBackupSave, setActiveBackupSave] = useState<{ folderName: string; worldName: string } | null>(null);
  const [operationRowIndex, setOperationRowIndex] = useState<number | null>(null);
  const [returnFocusKey, setReturnFocusKey] = useState<string>('save-btn-history');
  const backupProgressTimerRef = useRef<number | null>(null);
  const inputMode = useInputMode();

  const backupSummaryByWorld = useMemo(() => {
    const summary = new Map<string, { count: number; latest: SaveBackupMetadata | null }>();
    for (const backup of backups) {
      const key = backup.world.uuid || backup.world.folderName;
      const current = summary.get(key);
      if (!current) {
        summary.set(key, { count: 1, latest: backup });
        continue;
      }
      summary.set(key, {
        count: current.count + 1,
        latest: !current.latest || backup.createdAt > current.latest.createdAt ? backup : current.latest,
      });
    }
    return summary;
  }, [backups]);

  const visibleBackups = useMemo(() => {
    if (!backupListWorldUuid) return backups;
    return backups.filter(
      (backup) => backup.world.uuid === backupListWorldUuid || backup.world.folderName === backupListWorldUuid
    );
  }, [backups, backupListWorldUuid]);

  const rowLevelOrder = useMemo(
    () => [...TOP_FOCUS_ORDER, ...saves.map((_, index) => getRowFocusKey(index))],
    [saves]
  );
  const { handleLinearArrow: handleRowNavigation } = useLinearNavigation(rowLevelOrder, rowLevelOrder[0], false);

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

  const handleSelectBackup = useCallback((backup: SaveBackupMetadata) => {
    setIsBackupListOpen(false);
    setBackupDeleteReturnFocusKey(null);
    setVerifyingBackup(backup);
  }, []);

  const closeBackupConfirmModal = useCallback(() => {
    setPendingBackupSave(null);
    restoreSavePanelFocus();
  }, [restoreSavePanelFocus]);

  const openBackupDeleteModal = useCallback((backup: SaveBackupMetadata, focusKey: string) => {
    setBackupDeleteReturnFocusKey(focusKey);
    setBackupToDelete(backup);
  }, []);

  const closeBackupDeleteModal = useCallback(() => {
    setBackupToDelete(null);
    if (isBackupListOpen) {
      restoreBackupListFocus(backupDeleteReturnFocusKey);
      return;
    }
    restoreSavePanelFocus();
  }, [backupDeleteReturnFocusKey, isBackupListOpen, restoreBackupListFocus, restoreSavePanelFocus]);

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

  const handleConfirmBackup = useCallback(async (mode: 'full' | 'differential') => {
    if (!pendingBackupSave) return;
    const target = pendingBackupSave;
    setPendingBackupSave(null);
    setActiveBackupSave(target);

    try {
      await backupSave(target.folderName, mode);
      completeBackupFlow(900);
    } catch (error) {
      clearBackupProgress();
      setActiveBackupSave(null);
      alert(`备份失败: ${error}`);
      restoreSavePanelFocus();
    }
  }, [pendingBackupSave, backupSave, completeBackupFlow, clearBackupProgress, restoreSavePanelFocus]);

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
  }, [backupDeleteReturnFocusKey, backupToDelete, deleteBackup, isBackupListOpen, restoreBackupListFocus, restoreSavePanelFocus]);

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

        const nextRowIndex = direction === 'down' ? Math.min(saves.length - 1, index + 1) : Math.max(0, index - 1);
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

  return {
    manager,
    state: {
      isBackupListOpen,
      backupListTitle,
      visibleBackups,
      verifyingBackup,
      backupToDelete,
      saveToDelete,
      pendingBackupSave,
      activeBackupSave,
      operationRowIndex,
      backupSummaryByWorld,
      isBackupProgressOpen: !!activeBackupSave && (!!backupProgress || isBackingUp),
    },
    actions: {
      setReturnFocusKey,
      setPendingBackupSave,
      setSaveToDelete,
      setVerifyingBackup,
      restoreSavePanelFocus,
      openBackupList,
      closeBackupList,
      closeRestoreModal,
      openBackupDeleteModal,
      closeBackupDeleteModal,
      closeBackupConfirmModal,
      handleConfirmBackup,
      handleConfirmDeleteBackup,
      enterRowOperation,
      handleTopArrow,
      handleActionArrow,
      handleRowNavigation,
      handleSelectBackup,
    },
  };
};

export const formatTrigger = (trigger: string) => {
  switch (trigger) {
    case 'manual': return '手动';
    case 'auto_exit': return '退出';
    case 'auto_interval': return '定时';
    case 'restore_guard': return '恢复前';
    case 'legacy': return '旧版';
    default: return trigger || '未知';
  }
};
