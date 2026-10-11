import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  doesFocusableExist,
  getCurrentFocusKey,
  setFocus,
} from '@noriginmedia/norigin-spatial-navigation';

import {
  deleteManagedJava,
  scanJava,
  type JavaInstall,
  validateCachedJava,
} from '../logic/javaDetector';

interface UseJavaSelectorOptions {
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
  focusKeyPrefix: string;
}

const sortJavaInstalls = (javas: JavaInstall[]) =>
  [...javas].sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));

export const useJavaSelector = ({
  value,
  onChange,
  disabled,
  focusKeyPrefix,
}: UseJavaSelectorOptions) => {
  const [isModalOpen, setModalOpen] = useState(false);
  const [javaList, setJavaList] = useState<JavaInstall[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [browserStartPath, setBrowserStartPath] = useState('');
  const [pendingDeleteJava, setPendingDeleteJava] = useState<JavaInstall | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const wasModalOpen = useRef(false);
  const wasBrowserOpen = useRef(false);

  const browseButtonFocusKey = `${focusKeyPrefix}-btn-browse`;
  const modalScanFocusKey = `${focusKeyPrefix}-modal-btn-scan`;
  const modalBrowseFocusKey = `${focusKeyPrefix}-modal-btn-browse`;
  const getModalItemFocusKey = useCallback(
    (index: number) => `${focusKeyPrefix}-modal-item-${index}`,
    [focusKeyPrefix],
  );
  const getModalDeleteFocusKey = useCallback(
    (index: number) => `${focusKeyPrefix}-modal-delete-${index}`,
    [focusKeyPrefix],
  );
  const confirmDeleteFocusKey = `${focusKeyPrefix}-confirm-delete`;
  const cancelDeleteFocusKey = `${focusKeyPrefix}-cancel-delete`;

  const returnFocusKeyRef = useRef<string>(browseButtonFocusKey);

  const restoreFocusAfterClose = useCallback(() => {
    const candidates = [returnFocusKeyRef.current, browseButtonFocusKey];
    let attempts = 0;
    let timer: number | undefined;

    const tryRestore = () => {
      const next = candidates.find((key) => !!key && doesFocusableExist(key));
      if (next) {
        setFocus(next);
        return;
      }

      attempts += 1;
      if (attempts < 8) {
        timer = window.setTimeout(tryRestore, 70);
      }
    };

    timer = window.setTimeout(tryRestore, 80);

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [browseButtonFocusKey]);

  const openSelectorModal = useCallback((fallbackFocusKey = browseButtonFocusKey) => {
    if (disabled) return;

    const current = getCurrentFocusKey();
    const isValidCurrent = current
      && current !== 'SN:ROOT'
      && (current === browseButtonFocusKey || current.startsWith(`${focusKeyPrefix}-modal-`));

    returnFocusKeyRef.current = isValidCurrent ? current : fallbackFocusKey;
    setModalOpen(true);
  }, [browseButtonFocusKey, disabled, focusKeyPrefix]);

  const closeSelectorModal = useCallback((nextFocusKey?: string) => {
    if (nextFocusKey) {
      returnFocusKeyRef.current = nextFocusKey;
    }
    setModalOpen(false);
  }, []);

  const loadFromCache = useCallback(async () => {
    setIsScanning(true);
    const { valid } = await validateCachedJava();
    setJavaList(sortJavaInstalls(valid));
    setIsScanning(false);
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (isModalOpen && !wasModalOpen.current) {
      void loadFromCache();
      window.setTimeout(() => setFocus(modalScanFocusKey), 100);
    }

    if (!isModalOpen && wasModalOpen.current && !isBrowserOpen) {
      cleanup = restoreFocusAfterClose();
    }

    wasModalOpen.current = isModalOpen;
    return cleanup;
  }, [isBrowserOpen, isModalOpen, loadFromCache, modalScanFocusKey, restoreFocusAfterClose]);

  useEffect(() => {
    if (!isBrowserOpen && wasBrowserOpen.current && isModalOpen) {
      window.setTimeout(() => {
        if (doesFocusableExist(modalBrowseFocusKey)) {
          setFocus(modalBrowseFocusKey);
        }
      }, 80);
    }

    wasBrowserOpen.current = isBrowserOpen;
  }, [isBrowserOpen, isModalOpen, modalBrowseFocusKey]);

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    const javas = await scanJava();
    setJavaList(sortJavaInstalls(javas));
    setIsScanning(false);
  }, []);

  const handleBrowseDirectory = useCallback(async () => {
    try {
      const basePath = await invoke<string | null>('get_base_directory');
      if (basePath) {
        const separator = basePath.includes('\\') ? '\\' : '/';
        setBrowserStartPath(`${basePath}${separator}runtime${separator}java`);
      } else {
        setBrowserStartPath('');
      }
    } catch {
      setBrowserStartPath('');
    }

    setIsBrowserOpen(true);
  }, []);

  const handleDirSelect = useCallback((dirPath: string) => {
    const isWindowsPath = dirPath.includes('\\');
    const separator = isWindowsPath ? '\\' : '/';
    const executable = dirPath.endsWith('bin')
      ? `${dirPath}${separator}${isWindowsPath ? 'java.exe' : 'java'}`
      : `${dirPath}${separator}bin${separator}${isWindowsPath ? 'java.exe' : 'java'}`;

    onChange(executable);
    setIsBrowserOpen(false);
    closeSelectorModal(browseButtonFocusKey);
  }, [browseButtonFocusKey, closeSelectorModal, onChange]);

  const handleDeleteJava = useCallback(async () => {
    if (!pendingDeleteJava || deletingPath) return;

    setDeletingPath(pendingDeleteJava.path);
    setDeleteError(null);

    try {
      const nextList = await deleteManagedJava(pendingDeleteJava.path);
      setJavaList(sortJavaInstalls(nextList));
      if (value === pendingDeleteJava.path) {
        onChange('');
      }
      setPendingDeleteJava(null);
      window.setTimeout(() => {
        if (doesFocusableExist(modalScanFocusKey)) {
          setFocus(modalScanFocusKey);
        }
      }, 80);
    } catch (error) {
      setDeleteError(String(error));
    } finally {
      setDeletingPath(null);
    }
  }, [deletingPath, modalScanFocusKey, onChange, pendingDeleteJava, value]);

  const modalFocusOrder = useMemo(() => {
    const itemKeys = javaList.flatMap((java, index) => {
      const keys = [getModalItemFocusKey(index)];
      if (java.managed) {
        keys.push(getModalDeleteFocusKey(index));
      }
      return keys;
    });

    return [modalScanFocusKey, modalBrowseFocusKey, ...itemKeys];
  }, [getModalDeleteFocusKey, getModalItemFocusKey, javaList, modalBrowseFocusKey, modalScanFocusKey]);

  const handleModalLinearArrow = useCallback((fallbackKey: string) => (direction: string) => {
    const step = direction === 'left' || direction === 'up'
      ? -1
      : direction === 'right' || direction === 'down'
        ? 1
        : 0;

    if (step === 0) return true;

    const currentFocusKey = getCurrentFocusKey();
    const resolvedKey = currentFocusKey && modalFocusOrder.includes(currentFocusKey)
      ? currentFocusKey
      : fallbackKey;
    const currentIndex = modalFocusOrder.indexOf(resolvedKey);

    if (currentIndex === -1) return true;

    for (
      let nextIndex = currentIndex + step;
      nextIndex >= 0 && nextIndex < modalFocusOrder.length;
      nextIndex += step
    ) {
      const nextKey = modalFocusOrder[nextIndex];
      if (doesFocusableExist(nextKey)) {
        setFocus(nextKey);
        return false;
      }
    }

    return true;
  }, [modalFocusOrder]);

  const selectJava = useCallback((path: string) => {
    onChange(path);
    closeSelectorModal(browseButtonFocusKey);
  }, [browseButtonFocusKey, closeSelectorModal, onChange]);

  const requestDeleteJava = useCallback((java: JavaInstall) => {
    setDeleteError(null);
    setPendingDeleteJava(java);
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (!deletingPath) {
      setPendingDeleteJava(null);
      setDeleteError(null);
    }
  }, [deletingPath]);

  const closeMainModal = useCallback(() => {
    if (!pendingDeleteJava) {
      closeSelectorModal();
    }
  }, [closeSelectorModal, pendingDeleteJava]);

  return {
    browserStartPath,
    browseButtonFocusKey,
    cancelDeleteFocusKey,
    closeDeleteModal,
    closeMainModal,
    confirmDeleteFocusKey,
    deleteError,
    deletingPath,
    getModalDeleteFocusKey,
    getModalItemFocusKey,
    handleBrowseDirectory,
    handleDeleteJava,
    handleDirSelect,
    handleModalLinearArrow,
    handleScan,
    isBrowserOpen,
    isModalOpen,
    isScanning,
    javaList,
    modalBrowseFocusKey,
    modalScanFocusKey,
    openSelectorModal,
    pendingDeleteJava,
    requestDeleteJava,
    selectJava,
    setIsBrowserOpen,
  };
};

export type JavaSelectorController = ReturnType<typeof useJavaSelector>;
