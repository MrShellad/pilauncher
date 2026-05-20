// src/features/runtime/components/JavaSelector.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { AlertTriangle, FolderOpen, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';

import { OreButton } from '../../../ui/primitives/OreButton';
import { OreInput } from '../../../ui/primitives/OreInput';
import { OreModal } from '../../../ui/primitives/OreModal';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { DirectoryBrowserModal } from '../../../ui/components/DirectoryBrowserModal';

import {
  getJavaRecommendation,
  deleteManagedJava,
  scanJava,
  type JavaInstall,
  validateCachedJava,
} from '../logic/javaDetector';

export const JavaSelector: React.FC<{
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
  isError?: boolean;
  onArrowPress?: (direction: string) => boolean;
  focusKeyPrefix?: string;
}> = ({ value, onChange, disabled, isError, onArrowPress, focusKeyPrefix = 'java' }) => {
  const { t } = useTranslation();
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
    [focusKeyPrefix]
  );
  const getModalDeleteFocusKey = useCallback(
    (index: number) => `${focusKeyPrefix}-modal-delete-${index}`,
    [focusKeyPrefix]
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
    const isValidCurrent =
      current &&
      current !== 'SN:ROOT' &&
      (current === browseButtonFocusKey || current.startsWith(`${focusKeyPrefix}-modal-`));

    returnFocusKeyRef.current = isValidCurrent ? current : fallbackFocusKey;
    setModalOpen(true);
  }, [browseButtonFocusKey, disabled, focusKeyPrefix]);

  const closeSelectorModal = useCallback((nextFocusKey?: string) => {
    if (nextFocusKey) {
      returnFocusKeyRef.current = nextFocusKey;
    }
    setModalOpen(false);
  }, []);

  const sortJavas = useCallback(
    (javas: JavaInstall[]) =>
      [...javas].sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true })),
    []
  );

  const loadFromCache = useCallback(async () => {
    setIsScanning(true);
    const { valid } = await validateCachedJava();
    setJavaList(sortJavas(valid));
    setIsScanning(false);
  }, [sortJavas]);

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
    setJavaList(sortJavas(javas));
    setIsScanning(false);
  }, [sortJavas]);

  const handleBrowseDirectory = useCallback(async () => {
    try {
      const basePath = await invoke<string | null>('get_base_directory');
      if (basePath) {
        const sep = basePath.includes('\\') ? '\\' : '/';
        setBrowserStartPath(`${basePath}${sep}runtime${sep}java`);
      } else {
        setBrowserStartPath('');
      }
    } catch {
      setBrowserStartPath('');
    }

    setIsBrowserOpen(true);
  }, []);

  const handleDirSelect = useCallback((dirPath: string) => {
    const isWin = dirPath.includes('\\');
    const sep = isWin ? '\\' : '/';
    const executable = dirPath.endsWith('bin')
      ? `${dirPath}${sep}${isWin ? 'java.exe' : 'java'}`
      : `${dirPath}${sep}bin${sep}${isWin ? 'java.exe' : 'java'}`;

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
      setJavaList(sortJavas(nextList));
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
  }, [deletingPath, modalScanFocusKey, onChange, pendingDeleteJava, sortJavas, value]);

  const modalFocusOrder = useMemo(
    () => {
      const itemKeys = javaList.flatMap((java, idx) => {
        const keys = [getModalItemFocusKey(idx)];
        if (java.managed) {
          keys.push(getModalDeleteFocusKey(idx));
        }
        return keys;
      });

      return [
        modalScanFocusKey,
        modalBrowseFocusKey,
        ...itemKeys,
      ];
    },
    [getModalDeleteFocusKey, getModalItemFocusKey, javaList, modalBrowseFocusKey, modalScanFocusKey]
  );

  const handleModalLinearArrow = useCallback((fallbackKey: string) => (direction: string) => {
    const step =
      direction === 'left' || direction === 'up'
        ? -1
        : direction === 'right' || direction === 'down'
          ? 1
          : 0;

    if (step === 0) return true;

    const currentFocusKey = getCurrentFocusKey();
    const resolvedKey =
      currentFocusKey && modalFocusOrder.includes(currentFocusKey)
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

  return (
    <>
      <div className="flex items-stretch gap-2">
        <div
          className="min-w-0 flex-1 cursor-pointer"
          onClick={() => openSelectorModal(browseButtonFocusKey)}
          onMouseDown={(event) => event.preventDefault()}
        >
          <OreInput
            value={value}
            readOnly
            tabIndex={-1}
            onFocus={(event) => event.currentTarget.blur()}
            placeholder={t('settings.java.selector.placeholder')}
            disabled={disabled}
            className={`pointer-events-none cursor-pointer ${isError ? '!text-red-400 font-bold' : ''}`}
            containerClassName="!space-y-0"
          />
        </div>

        <OreButton
          focusKey={browseButtonFocusKey}
          onArrowPress={onArrowPress}
          variant="secondary"
          onClick={() => openSelectorModal(browseButtonFocusKey)}
          disabled={disabled}
          className="shrink-0 !min-w-[7.5rem] !h-10 !px-4 !justify-center gap-1 whitespace-nowrap"
        >
          <FolderOpen size={14} />
          {t('settings.java.selector.select')}
        </OreButton>
      </div>

      <OreModal
        isOpen={isModalOpen}
        onClose={() => {
          if (!pendingDeleteJava) {
            closeSelectorModal();
          }
        }}
        title={t('settings.java.selector.modalTitle')}
        hideTitleBar={true}
        defaultFocusKey={modalScanFocusKey}
        className="w-[37.5rem] h-[31.25rem]"
        contentClassName="overflow-hidden p-0"
      >
        <FocusBoundary
          id={`${focusKeyPrefix}-selector-boundary`}
          trapFocus={isModalOpen && !pendingDeleteJava}
          onEscape={() => {
            if (!pendingDeleteJava) {
              closeSelectorModal();
            }
          }}
          className="flex h-full flex-col px-5 py-5 outline-none"
        >
          <div className="mb-4 flex shrink-0 gap-3 [.intent-controller_&]:flex-col">
            <OreButton
              focusKey={modalScanFocusKey}
              onArrowPress={handleModalLinearArrow(modalScanFocusKey)}
              onClick={handleScan}
              disabled={isScanning}
              variant="secondary"
              size="auto"
              className="flex-1 !min-w-0 !h-11 !justify-center gap-2"
            >
              <RefreshCw size={16} className={isScanning ? 'animate-spin' : ''} />
              <span>{isScanning ? t('settings.java.selector.rescanning') : t('settings.java.selector.rescan')}</span>
            </OreButton>

            <OreButton
              focusKey={modalBrowseFocusKey}
              onArrowPress={handleModalLinearArrow(modalBrowseFocusKey)}
              onClick={handleBrowseDirectory}
              variant="secondary"
              size="auto"
              className="flex-1 !min-w-0 !h-11 !justify-center gap-2"
            >
              <FolderOpen size={16} />
              <span>{t('settings.java.selector.manualBrowse')}</span>
            </OreButton>
          </div>

          <div className="custom-scrollbar -mr-1 flex-1 overflow-y-auto pr-1">
            {isScanning && javaList.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[2px] border-2 border-dashed border-[var(--ore-border-color)] bg-[var(--ore-modal-bg)]/55 p-6 text-ore-text-muted">
                <Loader2 size={32} className="animate-spin opacity-60" />
                <span className="font-minecraft text-sm tracking-wide">{t('settings.java.selector.scanningDisk')}</span>
              </div>
            ) : javaList.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[2px] border-2 border-dashed border-[var(--ore-border-color)] bg-[var(--ore-modal-bg)]/55 p-6 text-ore-text-muted">
                <Search size={32} className="opacity-60" />
                <span className="font-minecraft text-sm tracking-wide">{t('settings.java.selector.notFound')}</span>
              </div>
            ) : (
              <div className="space-y-3 pb-2 pl-1 pt-1">
                {javaList.map((java, idx) => {
                  const recommendation = getJavaRecommendation(java.version);
                  const itemFocusKey = getModalItemFocusKey(idx);
                  const deleteFocusKey = getModalDeleteFocusKey(idx);
                  const isSelected = value === java.path;
                  const isDeleting = deletingPath === java.path;

                  return (
                    <div key={java.path} className="flex items-stretch gap-2">
                      <FocusItem
                        focusKey={itemFocusKey}
                        onEnter={() => {
                          onChange(java.path);
                          closeSelectorModal(browseButtonFocusKey);
                        }}
                        onArrowPress={handleModalLinearArrow(itemFocusKey)}
                      >
                        {({ ref, focused }) => (
                          <button
                            type="button"
                            ref={ref as any}
                            onClick={() => {
                              onChange(java.path);
                              closeSelectorModal(browseButtonFocusKey);
                            }}
                            className={`
                              min-w-0 flex flex-1 rounded-[2px] border-2 px-4 py-3 text-left outline-none transition-all duration-150
                              ${isSelected
                                ? 'border-ore-green bg-[var(--ore-modal-header-bg)]/95 brightness-110 shadow-[0_0_0_1px_rgba(56,133,39,0.45),0_0_18px_rgba(56,133,39,0.18)]'
                                : 'border-[var(--ore-border-color)] bg-[var(--ore-modal-bg)] hover:bg-[var(--ore-modal-header-bg)]/88'
                              }
                              ${focused
                                ? 'border-white ring-2 ring-inset ring-[var(--ore-focus-ring)] drop-shadow-[0_0_6px_var(--ore-focus-glow)] brightness-110'
                                : ''
                              }
                            `}
                          >
                            <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_9.5rem] gap-x-4 gap-y-2">
                              <div className="min-w-0 self-start">
                                <div className="truncate font-minecraft text-lg leading-tight text-white">Java {java.version}</div>
                              </div>

                              <div className="flex w-[9.5rem] flex-none flex-col items-end gap-1 self-start">
                                {recommendation && (
                                  <span className="max-w-full rounded-[2px] border border-[var(--ore-border-color)] bg-[var(--ore-btn-secondary-bg)] px-2 py-0.5 text-right font-minecraft text-[0.625rem] uppercase leading-tight tracking-[0.12em] text-black">
                                    {recommendation}
                                  </span>
                                )}
                                {java.managed && (
                                  <span className="max-w-full rounded-[2px] border border-ore-green/40 bg-ore-green/15 px-2 py-0.5 text-right font-minecraft text-[0.625rem] uppercase leading-tight tracking-[0.12em] text-ore-green">
                                    {t('settings.java.selector.managed', { defaultValue: '启动器内' })}
                                  </span>
                                )}
                              </div>

                              <div className="col-span-2 min-w-0">
                                <span className="block truncate font-minecraft text-sm leading-tight text-ore-text-muted">{java.path}</span>
                              </div>
                            </div>
                          </button>
                        )}
                      </FocusItem>

                      {java.managed && (
                        <FocusItem
                          focusKey={deleteFocusKey}
                          disabled={!!deletingPath}
                          onArrowPress={handleModalLinearArrow(deleteFocusKey)}
                          onEnter={() => {
                            setDeleteError(null);
                            setPendingDeleteJava(java);
                          }}
                        >
                          {({ ref, focused }) => (
                            <button
                              ref={ref as any}
                              type="button"
                              disabled={!!deletingPath}
                              onClick={() => {
                                setDeleteError(null);
                                setPendingDeleteJava(java);
                              }}
                              title={t('settings.java.selector.delete', { defaultValue: '删除' })}
                              className={`
                                ore-btn ore-btn-danger flex h-11 w-11 flex-none self-center items-center justify-center rounded-[2px] border-2 p-0 font-minecraft outline-none transition-none
                                !min-w-0 !px-0 text-white [&_svg]:text-white
                                disabled:cursor-not-allowed disabled:opacity-60
                                ${focused ? 'is-focused border-white ring-2 ring-inset ring-[var(--ore-focus-ring)] drop-shadow-[0_0_6px_var(--ore-focus-glow)] brightness-110' : ''}
                              `}
                            >
                              {isDeleting ? (
                                <Loader2 size={17} className="animate-spin" />
                              ) : (
                                <Trash2 size={17} />
                              )}
                            </button>
                          )}
                        </FocusItem>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </FocusBoundary>
      </OreModal>

      <OreModal
        isOpen={!!pendingDeleteJava}
        onClose={() => {
          if (!deletingPath) {
            setPendingDeleteJava(null);
            setDeleteError(null);
          }
        }}
        hideTitleBar={true}
        defaultFocusKey={cancelDeleteFocusKey}
        className="w-full max-w-md"
      >
        <FocusBoundary
          id={`${focusKeyPrefix}-delete-java-boundary`}
          trapFocus={!!pendingDeleteJava}
          onEscape={() => {
            if (!deletingPath) {
              setPendingDeleteJava(null);
              setDeleteError(null);
            }
          }}
          className="outline-none"
        >
          <div className="flex flex-col items-center p-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[2px] border-2 border-red-500/40 bg-red-500/15 text-red-300">
              <AlertTriangle size={28} />
            </div>
            <h3 className="mb-2 font-minecraft text-xl text-white">
              {t('settings.java.selector.deleteConfirmTitle', { defaultValue: '确认删除 Java' })}
            </h3>
            <p className="mb-3 text-sm leading-relaxed text-ore-text-muted">
              {t('settings.java.selector.deleteConfirmDesc', {
                defaultValue: '只会删除启动器自动下载到 runtime/java 内的 Java，不会删除外部安装的 Java。',
              })}
            </p>
            {pendingDeleteJava && (
              <div className="mb-4 w-full rounded-[2px] border border-[var(--ore-border-color)] bg-black/20 p-3 text-left">
                <div className="font-minecraft text-sm text-white">Java {pendingDeleteJava.version}</div>
                <div className="mt-1 break-all text-xs text-ore-text-muted">{pendingDeleteJava.path}</div>
              </div>
            )}
            {deleteError && <div className="mb-4 w-full text-left text-sm text-red-300">{deleteError}</div>}

            <div className="flex w-full gap-3">
              <OreButton
                focusKey={cancelDeleteFocusKey}
                variant="secondary"
                onClick={() => {
                  setPendingDeleteJava(null);
                  setDeleteError(null);
                }}
                disabled={!!deletingPath}
                className="flex-1 !justify-center"
              >
                {t('common.cancel', { defaultValue: '取消' })}
              </OreButton>
              <OreButton
                focusKey={confirmDeleteFocusKey}
                variant="primary"
                onClick={() => void handleDeleteJava()}
                disabled={!!deletingPath}
                className="flex-1 !justify-center gap-2 !bg-red-600 hover:!bg-red-500"
              >
                {deletingPath ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {t('settings.java.selector.confirmDelete', { defaultValue: '确认删除' })}
              </OreButton>
            </div>
          </div>
        </FocusBoundary>
      </OreModal>

      <DirectoryBrowserModal
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        onSelect={handleDirSelect}
        initialPath={browserStartPath}
      />
    </>
  );
};
