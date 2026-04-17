import { useCallback, useState } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';

import { focusManager } from '../../../../../ui/focus/FocusManager';
import { useToastStore } from '../../../../../store/useToastStore';

import type { InstanceSnapshot, ModMeta, SnapshotDiff } from '../../../logic/modService';

export interface PendingDeleteState {
  fileNames: string[];
  title: string;
  description: string;
}

interface UseModPanelDialogsOptions {
  fetchHistory: () => Promise<InstanceSnapshot[]>;
  diffSnapshots: (oldId: string, newId: string) => Promise<SnapshotDiff>;
  doRollback: (snapshotId: string) => Promise<void>;
  toggleMod: (fileName: string, currentEnabled: boolean) => void | Promise<void>;
  deleteMod: (fileName: string) => void | Promise<void>;
  deleteMods: (fileNames: string[]) => void | Promise<void>;
  onDeleteComplete?: (fileNames: string[]) => void;
}

export interface ModPanelDialogState {
  selectedMod: ModMeta | null;
  pendingDelete: PendingDeleteState | null;
  isHistoryModalOpen: boolean;
  history: InstanceSnapshot[];
  diffs: Record<string, SnapshotDiff>;
}

export interface ModPanelDialogActions {
  openModDetail: (mod: ModMeta) => void;
  closeModDetail: () => void;
  toggleSelectedMod: (fileName: string, currentEnabled: boolean) => void;
  deleteModFromDetail: (fileName: string) => void;
  openHistoryModal: () => Promise<void>;
  syncHistoryAfterSnapshot: () => Promise<void>;
  closeHistoryModal: () => void;
  loadDiff: (oldId: string, newId: string) => Promise<void>;
  rollbackSnapshot: (snapshotId: string) => Promise<void>;
  openDeleteConfirm: (fileNames: string[]) => void;
  closeDeleteConfirm: () => void;
  confirmDelete: () => void;
}

export const useModPanelDialogs = ({
  fetchHistory,
  diffSnapshots,
  doRollback,
  toggleMod,
  deleteMod,
  deleteMods,
  onDeleteComplete,
}: UseModPanelDialogsOptions): {
  state: ModPanelDialogState;
  actions: ModPanelDialogActions;
} => {
  const { t } = useTranslation();
  const addToast = useToastStore((state) => state.addToast);

  const [selectedMod, setSelectedMod] = useState<ModMeta | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [history, setHistory] = useState<InstanceSnapshot[]>([]);
  const [diffs, setDiffs] = useState<Record<string, SnapshotDiff>>({});
  const [lastDeleteFocusKey, setLastDeleteFocusKey] = useState<string | null>(null);

  const openModDetail = useCallback((mod: ModMeta) => {
    setSelectedMod(mod);
  }, []);

  const closeModDetail = useCallback(() => {
    setSelectedMod(null);
    window.setTimeout(() => focusManager.restoreFocus('tab-boundary-mods'), 50);
  }, []);

  const toggleSelectedMod = useCallback((fileName: string, currentEnabled: boolean) => {
    setSelectedMod((prev) => (
      prev
        ? {
          ...prev,
          isEnabled: !currentEnabled,
          fileName: currentEnabled ? `${fileName}.disabled` : fileName.replace('.disabled', '')
        }
        : null
    ));

    void toggleMod(fileName, currentEnabled);
  }, [toggleMod]);

  const deleteModFromDetail = useCallback((fileName: string) => {
    setSelectedMod(null);
    onDeleteComplete?.([fileName]);
    void deleteMod(fileName);
  }, [deleteMod, onDeleteComplete]);

  const openHistoryModal = useCallback(async () => {
    try {
      const historyItems = await fetchHistory();
      setHistory(historyItems);
      setIsHistoryModalOpen(true);
    } catch (error) {
      console.error(error);
      addToast('error', t('modSnapshots.messages.historyLoadFailed', {
        defaultValue: 'Failed to load snapshot history. Check the logs for details.'
      }));
    }
  }, [addToast, fetchHistory, t]);

  const syncHistoryAfterSnapshot = useCallback(async () => {
    if (!isHistoryModalOpen) {
      return;
    }

    try {
      const historyItems = await fetchHistory();
      setHistory(historyItems);
    } catch (error) {
      console.error(error);
    }
  }, [fetchHistory, isHistoryModalOpen]);

  const closeHistoryModal = useCallback(() => {
    setIsHistoryModalOpen(false);
    window.setTimeout(() => focusManager.restoreFocus('tab-boundary-mods', 'mod-btn-history'), 50);
  }, []);

  const loadDiff = useCallback(async (oldId: string, newId: string) => {
    try {
      const diff = await diffSnapshots(oldId, newId);
      setDiffs((prev) => ({ ...prev, [`${oldId}->${newId}`]: diff }));
    } catch (error) {
      console.error(error);
    }
  }, [diffSnapshots]);

  const rollbackSnapshot = useCallback(async (snapshotId: string) => {
    try {
      await doRollback(snapshotId);
      const refreshedHistory = await fetchHistory();
      setHistory(refreshedHistory);
      addToast('success', t('modSnapshots.messages.rollbackSuccess', {
        defaultValue: 'Rolled back to the selected snapshot.'
      }));
    } catch (error) {
      console.error(error);
      addToast('error', t('modSnapshots.messages.rollbackFailed', {
        defaultValue: 'Failed to roll back snapshot. Check the logs for details.'
      }));
    }
  }, [addToast, doRollback, fetchHistory, t]);

  const openDeleteConfirm = useCallback((fileNames: string[]) => {
    if (fileNames.length === 0) {
      return;
    }

    const currentFocusKey = getCurrentFocusKey();
    if (currentFocusKey && currentFocusKey !== 'SN:ROOT') {
      setLastDeleteFocusKey(currentFocusKey);
    }

    const isBatch = fileNames.length > 1;
    setPendingDelete({
      fileNames,
      title: isBatch ? `删除 ${fileNames.length} 个模组` : '删除模组',
      description: isBatch
        ? `这会从当前实例中永久删除选中的 ${fileNames.length} 个模组文件。`
        : `这会从当前实例中永久删除 "${fileNames[0]}"。`
    });
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setPendingDelete(null);
    window.setTimeout(() => {
      if (lastDeleteFocusKey && doesFocusableExist(lastDeleteFocusKey)) {
        setFocus(lastDeleteFocusKey);
      }
    }, 50);
  }, [lastDeleteFocusKey]);

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) {
      return;
    }

    if (pendingDelete.fileNames.length === 1) {
      void deleteMod(pendingDelete.fileNames[0]);
    } else {
      void deleteMods(pendingDelete.fileNames);
    }

    setSelectedMod((prev) => (
      prev && pendingDelete.fileNames.includes(prev.fileName) ? null : prev
    ));
    onDeleteComplete?.(pendingDelete.fileNames);
    closeDeleteConfirm();
  }, [closeDeleteConfirm, deleteMod, deleteMods, onDeleteComplete, pendingDelete]);

  return {
    state: {
      selectedMod,
      pendingDelete,
      isHistoryModalOpen,
      history,
      diffs
    },
    actions: {
      openModDetail,
      closeModDetail,
      toggleSelectedMod,
      deleteModFromDetail,
      openHistoryModal,
      syncHistoryAfterSnapshot,
      closeHistoryModal,
      loadDiff,
      rollbackSnapshot,
      openDeleteConfirm,
      closeDeleteConfirm,
      confirmDelete
    }
  };
};
