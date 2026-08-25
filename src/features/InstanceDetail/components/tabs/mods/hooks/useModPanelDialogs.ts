import { useCallback, useMemo, useState } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';

import { focusManager } from '../../../../../../ui/focus/FocusManager';
import { useToastStore } from '../../../../../../store/useToastStore';

import type { InstanceSnapshot, ModMeta, SnapshotDiff, SnapshotRollbackResult } from '../../../../logic/modService';
import { getModIdentityKey } from '../../../../logic/modService';

export interface PendingDeleteState {
  fileNames: string[];
  title: string;
  description: string;
}

interface UseModPanelDialogsOptions {
  mods: ModMeta[];
  fetchHistory: () => Promise<InstanceSnapshot[]>;
  diffSnapshots: (oldId: string, newId: string) => Promise<SnapshotDiff>;
  doRollback: (snapshotId: string) => Promise<SnapshotRollbackResult>;
  toggleMod: (fileName: string, currentEnabled: boolean) => void | Promise<void>;
  deleteMod: (fileName: string) => void | Promise<void>;
  deleteMods: (fileNames: string[]) => void | Promise<void>;
  onDeleteComplete?: (fileNames: string[]) => void;
}


export interface ModPanelDialogState {
  selectedMod: ModMeta | null;
  openMetadataSettingsOnDetailOpen: boolean;
  pendingDelete: PendingDeleteState | null;
  isHistoryModalOpen: boolean;
  history: InstanceSnapshot[];
  diffs: Record<string, SnapshotDiff>;
  isGlobalMetadataOpen: boolean;
}

export interface ModPanelDialogActions {
  openModDetail: (mod: ModMeta) => void;
  openModMetadataSettings: (mod: ModMeta) => void;
  markMetadataSettingsOpened: () => void;
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
  openGlobalMetadata: () => void;
  closeGlobalMetadata: () => void;
}

const mergeSelectedModFromList = (current: ModMeta, matched: ModMeta) => {
  const next = {
    ...matched,
    networkInfo: matched.networkInfo || current.networkInfo,
    networkIconUrl: matched.networkIconUrl || current.networkIconUrl
  };

  if (
    current.fileName === next.fileName &&
    current.name === next.name &&
    current.description === next.description &&
    current.version === next.version &&
    current.fileSize === next.fileSize &&
    current.isEnabled === next.isEnabled &&
    current.isFetchingNetwork === next.isFetchingNetwork &&
    current.hasUpdate === next.hasUpdate &&
    current.updateVersionName === next.updateVersionName &&
    current.updatePlatform === next.updatePlatform &&
    current.updateProjectId === next.updateProjectId &&
    current.updateFileId === next.updateFileId &&
    current.updateFileName === next.updateFileName &&
    current.updateDownloadUrl === next.updateDownloadUrl &&
    current.manifestEntry === next.manifestEntry &&
    current.networkInfo === next.networkInfo &&
    current.networkIconUrl === next.networkIconUrl
  ) {
    return current;
  }

  return next;
};

export const useModPanelDialogs = ({
  mods,
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

  const [selectedModKey, setSelectedModKey] = useState<string | null>(null);
  const [selectedModSnapshot, setSelectedModSnapshot] = useState<ModMeta | null>(null);
  const [openMetadataSettingsOnDetailOpen, setOpenMetadataSettingsOnDetailOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [history, setHistory] = useState<InstanceSnapshot[]>([]);
  const [diffs, setDiffs] = useState<Record<string, SnapshotDiff>>({});
  const [lastDeleteFocusKey, setLastDeleteFocusKey] = useState<string | null>(null);
  const [isGlobalMetadataOpen, setIsGlobalMetadataOpen] = useState(false);

  const openModDetail = useCallback((mod: ModMeta) => {
    setOpenMetadataSettingsOnDetailOpen(false);
    setSelectedModKey(getModIdentityKey(mod));
    setSelectedModSnapshot(mod);
  }, []);

  const openModMetadataSettings = useCallback((mod: ModMeta) => {
    setOpenMetadataSettingsOnDetailOpen(true);
    setSelectedModKey(getModIdentityKey(mod));
    setSelectedModSnapshot(mod);
  }, []);

  const markMetadataSettingsOpened = useCallback(() => {
    setOpenMetadataSettingsOnDetailOpen(false);
  }, []);

  const openGlobalMetadata = useCallback(() => {
    setIsGlobalMetadataOpen(true);
  }, []);

  const closeGlobalMetadata = useCallback(() => {
    setIsGlobalMetadataOpen(false);
    window.setTimeout(() => focusManager.restoreFocus('tab-boundary-mods', 'mod-btn-metadata-settings'), 50);
  }, []);

  const selectedMod = useMemo(() => {
    if (!selectedModKey) {
      return null;
    }

    const matched = mods.find((mod) => getModIdentityKey(mod) === selectedModKey);
    if (!matched) {
      return selectedModSnapshot;
    }

    return selectedModSnapshot
      ? mergeSelectedModFromList(selectedModSnapshot, matched)
      : matched;
  }, [mods, selectedModKey, selectedModSnapshot]);

  const closeModDetail = useCallback(() => {
    setOpenMetadataSettingsOnDetailOpen(false);
    setSelectedModKey(null);
    setSelectedModSnapshot(null);
    window.setTimeout(() => focusManager.restoreFocus('tab-boundary-mods'), 50);
  }, []);

  const toggleSelectedMod = useCallback((fileName: string, currentEnabled: boolean) => {
    setSelectedModSnapshot((prev) => (
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

  const deleteModFromDetail = useCallback((fileName: string) => {
    openDeleteConfirm([fileName]);
  }, [openDeleteConfirm]);

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) {
      return;
    }

    if (pendingDelete.fileNames.length === 1) {
      void deleteMod(pendingDelete.fileNames[0]);
    } else {
      void deleteMods(pendingDelete.fileNames);
    }

    if (selectedMod && pendingDelete.fileNames.includes(selectedMod.fileName)) {
      setSelectedModKey(null);
      setSelectedModSnapshot(null);
    }
    onDeleteComplete?.(pendingDelete.fileNames);
    closeDeleteConfirm();
  }, [closeDeleteConfirm, deleteMod, deleteMods, onDeleteComplete, pendingDelete, selectedMod]);

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
      const result = await doRollback(snapshotId);
      const refreshedHistory = await fetchHistory();
      setHistory(refreshedHistory);
      addToast('success', t('modSnapshots.messages.rollbackSuccess', {
        id: result.preRollbackSnapshotId,
        defaultValue: 'Rolled back to the selected snapshot. A safety snapshot was created: {{id}}.'
      }));
    } catch (error) {
      console.error(error);
      addToast('error', t('modSnapshots.messages.rollbackFailed', {
        defaultValue: 'Failed to roll back snapshot. Check the logs for details.'
      }));
    }
  }, [addToast, doRollback, fetchHistory, t]);

  return {
    state: {
      selectedMod,
      openMetadataSettingsOnDetailOpen,
      pendingDelete,
      isHistoryModalOpen,
      history,
      diffs,
      isGlobalMetadataOpen
    },
    actions: {
      openModDetail,
      openModMetadataSettings,
      markMetadataSettingsOpened,
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
      confirmDelete,
      openGlobalMetadata,
      closeGlobalMetadata
    }
  };
};
