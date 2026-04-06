import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { AlertTriangle, BoxSelect, CheckCircle2, CheckSquare, Loader2, Monitor, Square } from 'lucide-react';

import { useInputAction } from '../../../../ui/focus/InputDriver';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { getProjectDetails, type OreProjectVersion } from '../../../InstanceDetail/logic/modrinthApi';
import { getInstalledProjectIds, modService } from '../../../InstanceDetail/logic/modService';

interface CompatibleInstance {
  id: string;
  name: string;
  version?: string;
  loader?: string;
}

interface MissingDependency {
  id: string;
  name: string;
}

interface InstanceSelectModalProps {
  isOpen: boolean;
  version: OreProjectVersion | null;
  onClose: () => void;
  onConfirm: (instanceIds: string[], autoInstallDeps: boolean) => void | Promise<void>;
  ignoreLoader?: boolean;
}

const AUTO_DEPS_FOCUS_KEY = 'modal-inst-auto-deps';
const CANCEL_BUTTON_FOCUS_KEY = 'modal-inst-cancel';
const CONFIRM_BUTTON_FOCUS_KEY = 'modal-inst-confirm';
const getInstanceFocusKey = (id: string) => `modal-inst-item-${id}`;

export const InstanceSelectModal: React.FC<InstanceSelectModalProps> = ({
  isOpen,
  version,
  onClose,
  onConfirm,
  ignoreLoader = false
}) => {
  const [instances, setInstances] = useState<CompatibleInstance[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingDeps, setIsCheckingDeps] = useState(false);
  const [missingDeps, setMissingDeps] = useState<MissingDependency[]>([]);
  const [autoInstallDeps, setAutoInstallDeps] = useState(true);
  const lastFocusBeforeModalRef = useRef<string | null>(null);

  const initialFocusKey = instances.length > 0 ? getInstanceFocusKey(instances[0].id) : CANCEL_BUTTON_FOCUS_KEY;
  const focusOrder = useMemo(
    () => [
      ...instances.map((instance) => getInstanceFocusKey(instance.id)),
      ...(missingDeps.length > 0 ? [AUTO_DEPS_FOCUS_KEY] : []),
      CANCEL_BUTTON_FOCUS_KEY,
      CONFIRM_BUTTON_FOCUS_KEY
    ],
    [instances, missingDeps.length]
  );
  const { handleLinearArrow } = useLinearNavigation(focusOrder, initialFocusKey, true, isOpen);

  const toggleSelection = useCallback((instanceId: string) => {
    setSelectedIds((prev) =>
      prev.includes(instanceId)
        ? prev.filter((id) => id !== instanceId)
        : [...prev, instanceId]
    );
  }, []);

  const handleInstanceClick = useCallback((instanceId: string) => {
    const focusKey = getInstanceFocusKey(instanceId);
    if (doesFocusableExist(focusKey)) {
      setFocus(focusKey);
    }
    toggleSelection(instanceId);
  }, [toggleSelection]);

  const restorePreviousFocus = useCallback(() => {
    const candidates = [
      lastFocusBeforeModalRef.current,
      'download-modal-version-row-0',
      'download-modal-mc-dropdown-0'
    ];

    const nextFocus = candidates.find((focusKey): focusKey is string => typeof focusKey === 'string' && doesFocusableExist(focusKey));
    if (nextFocus) {
      setFocus(nextFocus);
    }
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(restorePreviousFocus, 60);
  }, [onClose, restorePreviousFocus]);

  const handleLinearFocus = useCallback((direction: string) => {
    if (direction === 'up' || direction === 'down') {
      return handleLinearArrow(direction);
    }
    return false;
  }, [handleLinearArrow]);

  const handleCancelArrow = useCallback((direction: string) => {
    if (direction === 'right' && doesFocusableExist(CONFIRM_BUTTON_FOCUS_KEY)) {
      setFocus(CONFIRM_BUTTON_FOCUS_KEY);
      return false;
    }

    if (direction === 'left') return false;
    return handleLinearFocus(direction);
  }, [handleLinearFocus]);

  const handleConfirmArrow = useCallback((direction: string) => {
    if (direction === 'left' && doesFocusableExist(CANCEL_BUTTON_FOCUS_KEY)) {
      setFocus(CANCEL_BUTTON_FOCUS_KEY);
      return false;
    }

    if (direction === 'right') return false;
    return handleLinearFocus(direction);
  }, [handleLinearFocus]);

  const handleConfirm = useCallback(() => {
    if (selectedIds.length === 0) return;
    void Promise.resolve(onConfirm(selectedIds, missingDeps.length > 0 ? autoInstallDeps : false));
  }, [autoInstallDeps, missingDeps.length, onConfirm, selectedIds]);

  useInputAction('CANCEL', () => {
    if (isOpen) {
      handleClose();
    }
  });

  useEffect(() => {
    if (!isOpen || !version) {
      setInstances([]);
      setSelectedIds([]);
      setIsLoading(false);
      setMissingDeps([]);
      setIsCheckingDeps(false);
      setAutoInstallDeps(true);
      return;
    }

    const currentFocus = getCurrentFocusKey();
    if (currentFocus && currentFocus !== 'SN:ROOT') {
      lastFocusBeforeModalRef.current = currentFocus;
    }

    let cancelled = false;
    setIsLoading(true);
    setSelectedIds([]);
    setMissingDeps([]);
    setIsCheckingDeps(false);
    setAutoInstallDeps(true);

    invoke<CompatibleInstance[]>('get_compatible_instances', {
      gameVersions: version.game_versions,
      loaders: version.loaders,
      ignoreLoader
    })
      .then((list) => {
        if (!cancelled) {
          setInstances(list || []);
        }
      })
      .catch((error) => {
        console.error('Failed to load compatible instances:', error);
        if (!cancelled) {
          setInstances([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ignoreLoader, isOpen, version]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((instanceId) => instances.some((instance) => instance.id === instanceId)));
  }, [instances]);

  useEffect(() => {
    let cancelled = false;

    if (!isOpen || !version || selectedIds.length === 0) {
      setMissingDeps([]);
      setIsCheckingDeps(false);
      return () => {
        cancelled = true;
      };
    }

    const requiredDeps = (version.dependencies || []).filter(
      (dependency) => dependency.dependency_type?.toLowerCase() === 'required' && dependency.project_id
    );

    if (requiredDeps.length === 0) {
      setMissingDeps([]);
      setIsCheckingDeps(false);
      return () => {
        cancelled = true;
      };
    }

    const checkDependencies = async () => {
      setIsCheckingDeps(true);

      try {
        const missingDepIds = new Set<string>();

        await Promise.all(
          selectedIds.map(async (instanceId) => {
            const installedMods = await modService.getMods(instanceId).catch(() => []);
            const installedModIds = new Set(getInstalledProjectIds(installedMods));

            requiredDeps.forEach((dependency) => {
              const dependencyId = dependency.project_id;
              if (dependencyId && !installedModIds.has(dependencyId)) {
                missingDepIds.add(dependencyId);
              }
            });
          })
        );

        if (cancelled) return;

        if (missingDepIds.size === 0) {
          setMissingDeps([]);
          return;
        }

        const resolvedMissingDeps = await Promise.all(
          [...missingDepIds].map(async (dependencyId) => {
            try {
              const detail = await getProjectDetails(dependencyId);
              return { id: dependencyId, name: detail.title };
            } catch {
              return { id: dependencyId, name: `\u672a\u77e5\u524d\u7f6e (${dependencyId})` };
            }
          })
        );

        if (!cancelled) {
          setMissingDeps(resolvedMissingDeps.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (error) {
        console.error('Failed to inspect missing dependencies:', error);
        if (!cancelled) {
          setMissingDeps([]);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingDeps(false);
        }
      }
    };

    void checkDependencies();

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedIds, version]);

  useEffect(() => {
    if (!isOpen) return;

    const currentFocus = getCurrentFocusKey();
    if (currentFocus && doesFocusableExist(currentFocus)) return;

    const fallbackKey = [initialFocusKey, CANCEL_BUTTON_FOCUS_KEY, CONFIRM_BUTTON_FOCUS_KEY].find((focusKey) => doesFocusableExist(focusKey));
    if (fallbackKey) {
      setFocus(fallbackKey);
    }
  }, [initialFocusKey, instances.length, isCheckingDeps, isOpen, missingDeps.length, selectedIds.length]);

  if (!isOpen || !version) return null;

  const dependencyStatusContent = isCheckingDeps ? (
    <div className="flex h-full items-center rounded-sm border border-ore-green/20 bg-ore-green/5 px-3 text-xs text-ore-green">
      <Loader2 size={14} className="mr-2 animate-spin" />
      {'\u6b63\u5728\u5206\u6790\u524d\u7f6e\u4f9d\u8d56\u73af\u5883...'}
    </div>
  ) : missingDeps.length > 0 ? (
    <div className="h-full rounded-sm border border-yellow-500/30 bg-yellow-500/10 p-3">
      <div className="mb-2 flex items-start text-yellow-500">
        <AlertTriangle size={16} className="mt-0.5 mr-2 flex-shrink-0" />
        <div className="text-xs font-minecraft leading-relaxed">
          {'\u5df2\u9009\u5b9e\u4f8b\u7f3a\u5c11 '}
          <span className="font-bold">{missingDeps.length}</span>
          {' \u4e2a\u5fc5\u9700\u7684\u524d\u7f6e\uff1a'}
          <br />
          <span className="break-words font-bold text-yellow-400">{missingDeps.map((dependency) => dependency.name).join('\u3001')}</span>
        </div>
      </div>

      <FocusItem
        focusKey={AUTO_DEPS_FOCUS_KEY}
        onEnter={() => setAutoInstallDeps((prev) => !prev)}
        onArrowPress={handleLinearFocus}
      >
        {({ ref, focused }) => (
          <div
            ref={ref as any}
            onClick={() => setAutoInstallDeps((prev) => !prev)}
            className={`w-max cursor-pointer rounded-sm p-1.5 outline-none transition-all ${
              focused ? 'bg-white/10 ring-1 ring-white' : 'hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${
                autoInstallDeps ? 'border-ore-green bg-ore-green text-black' : 'border-gray-500 bg-transparent'
              }`}>
                {autoInstallDeps && <CheckCircle2 size={10} />}
              </div>
              <span className="font-minecraft text-xs uppercase tracking-wider text-gray-300">
                {'\u81ea\u52a8\u4e0b\u8f7d\u5e76\u8865\u5168\u524d\u7f6e\u6a21\u7ec4'}
              </span>
            </div>
          </div>
        )}
      </FocusItem>
    </div>
  ) : (
    <div className="flex h-full items-center rounded-sm border border-white/5 bg-white/[0.03] px-3 text-xs text-gray-500">
      {selectedIds.length > 0
        ? '\u5df2\u9009\u5b9e\u4f8b\u7684\u524d\u7f6e\u68c0\u67e5\u7ed3\u679c\u4f1a\u663e\u793a\u5728\u8fd9\u91cc'
        : '\u9009\u62e9\u5b9e\u4f8b\u540e\u5c06\u5728\u8fd9\u91cc\u5206\u6790\u524d\u7f6e\u4f9d\u8d56'}
    </div>
  );

  return (
    <OreModal
      isOpen={isOpen}
      onClose={handleClose}
      title={'\u9009\u62e9\u5b89\u88c5\u76ee\u6807'}
      hideCloseButton
      defaultFocusKey={initialFocusKey}
      className="h-[min(42rem,85vh)] w-[44rem] max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-3rem)] border-[2px] border-[#313233] bg-[#18181B]"
      contentClassName="flex flex-col overflow-hidden p-0"
    >
      <div className="flex-shrink-0 border-b border-white/5 bg-black/40 p-5 text-sm text-gray-300">
        <div className="mb-1 font-minecraft text-lg text-white">{'\u76ee\u6807\u5b9e\u4f8b\u786e\u8ba4'}</div>
        <div className="truncate">
          {'\u51c6\u5907\u90e8\u7f72\uff1a'}
          <span className="ml-1 inline-block max-w-full truncate align-bottom font-bold text-ore-green">
            {version.file_name}
          </span>
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-tighter text-gray-500">
          {'\u73af\u5883\u9700\u6c42\uff1a'} MC {version.game_versions[0]} {ignoreLoader ? '' : `| ${version.loaders.join(', ')}`}
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#111112] p-4">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center py-12 text-ore-green opacity-80">
            <Loader2 className="mb-3 animate-spin" size={32} />
            <span className="font-minecraft text-sm">{'\u6b63\u5728\u5339\u914d\u517c\u5bb9\u7684\u5b9e\u4f8b...'}</span>
          </div>
        ) : instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <BoxSelect size={48} className="mb-4 opacity-50" />
            <div className="mb-1 text-center font-minecraft text-lg text-white">{'\u672a\u627e\u5230\u5339\u914d\u5b9e\u4f8b'}</div>
            <div className="px-8 text-center text-xs">
              {'\u8be5 Mod \u7684\u8fd0\u884c\u73af\u5883\u4e0e\u60a8\u73b0\u6709\u7684\u5b9e\u4f8b\u4e0d\u517c\u5bb9\uff0c\u8bf7\u5148\u521b\u5efa\u4e00\u4e2a\u5339\u914d\u7684\u5b9e\u4f8b\u3002'}
            </div>
          </div>
        ) : (
          instances.map((instance) => {
            const isSelected = selectedIds.includes(instance.id);

            return (
              <FocusItem
                key={instance.id}
                focusKey={getInstanceFocusKey(instance.id)}
                onEnter={() => toggleSelection(instance.id)}
                onArrowPress={handleLinearFocus}
              >
                {({ ref, focused }) => (
                  <div
                    ref={ref as any}
                    onClick={() => handleInstanceClick(instance.id)}
                    className={`
                      relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-sm border p-3 transition-none
                      ${isSelected ? 'border-ore-green bg-ore-green/10' : 'border-white/5 bg-black/30 hover:border-white/20'}
                      ${focused ? 'z-10 scale-[1.02] ring-2 ring-white shadow-[0_0_15px_rgba(255,255,255,0.1)] brightness-110' : ''}
                    `}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-sm border ${
                      isSelected
                        ? 'border-ore-green bg-ore-green text-black'
                        : 'border-[#3A3A3C] bg-black/40 text-gray-500'
                    }`}>
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>

                    <Monitor
                      size={24}
                      className={`transition-colors ${isSelected ? 'text-ore-green' : 'text-blue-400 opacity-60'}`}
                    />

                    <div className="min-w-0 flex-1">
                      <div className={`truncate font-minecraft text-base ${isSelected ? 'font-bold text-white' : 'text-gray-300'}`}>
                        {instance.name}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-gray-500">
                        {instance.version || '\u672a\u77e5\u7248\u672c'} | {instance.loader || '\u672a\u77e5 Loader'}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="ml-3 flex-shrink-0 text-right">
                        <CheckCircle2 className="ml-auto text-ore-green" size={20} />
                        <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-ore-green">
                          {'\u5df2\u9009\u62e9'}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </FocusItem>
            );
          })
        )}
      </div>

      <div className="flex flex-shrink-0 flex-col border-t border-white/10 bg-black/60 p-4">
        <div className="mb-4 min-h-[7.25rem]">
          {dependencyStatusContent}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="min-h-[1rem] font-minecraft text-[10px] uppercase tracking-[0.14em] text-gray-400">
            {selectedIds.length > 0
              ? `\u5df2\u9009\u62e9 ${selectedIds.length} \u4e2a\u5b9e\u4f8b`
              : '\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u5b9e\u4f8b'}
          </div>

          <div className="flex justify-end gap-4">
            <OreButton
              focusKey={CANCEL_BUTTON_FOCUS_KEY}
              variant="secondary"
              onClick={handleClose}
              onArrowPress={handleCancelArrow}
            >
              {'\u53d6\u6d88'}
            </OreButton>
            <OreButton
              focusKey={CONFIRM_BUTTON_FOCUS_KEY}
              variant="primary"
              disabled={selectedIds.length === 0 || isLoading || isCheckingDeps}
              onClick={() => { void handleConfirm(); }}
              onArrowPress={handleConfirmArrow}
              className="font-bold tracking-widest text-black"
            >
              {'\u786e\u8ba4\u5e76\u90e8\u7f72'}
            </OreButton>
          </div>
        </div>
      </div>
    </OreModal>
  );
};
