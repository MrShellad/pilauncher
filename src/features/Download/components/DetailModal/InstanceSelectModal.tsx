import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { AlertTriangle, BoxSelect, CheckCircle2, CheckSquare, Loader2, Monitor, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useInputAction } from '../../../../ui/focus/InputDriver';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreCheckbox } from '../../../../ui/primitives/OreCheckbox';
import { getProjectDetails, type OreProjectVersion } from '../../../InstanceDetail/logic/modrinthApi';
import { getCurseForgeProjectDetails } from '../../logic/curseforgeApi';
import type { DownloadSource } from '../../hooks/useResourceDownload';
import { getInstalledProjectIds, getInstalledVersionIds, modService } from '../../../InstanceDetail/logic/modService';

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
  projectId?: string;
  source?: DownloadSource;
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
  ignoreLoader = false,
  projectId,
  source = 'modrinth'
}) => {
  const { t } = useTranslation();
  const [instances, setInstances] = useState<CompatibleInstance[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingDeps, setIsCheckingDeps] = useState(false);
  const [missingDeps, setMissingDeps] = useState<MissingDependency[]>([]);
  const [autoInstallDeps, setAutoInstallDeps] = useState(true);
  const [isScanningMods, setIsScanningMods] = useState(false);
  const [alreadyInstalledInstanceIds, setAlreadyInstalledInstanceIds] = useState<Set<string>>(new Set());
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
    if (instances.length === 0 || !version) {
      setAlreadyInstalledInstanceIds(new Set());
      return;
    }

    const checkInstalled = async () => {
      const installedSet = new Set<string>();
      setIsScanningMods(true);

      for (const instance of instances) {
        if (cancelled) break;
        // Yield to the event loop so the UI (like loading spinners) doesn't freeze
        await new Promise((resolve) => setTimeout(resolve, 0));

        try {
          const mods = await modService.getCachedModManifest(instance.id).catch(() => []);
          const installedProjectIds = getInstalledProjectIds(mods);
          const installedVersionIds = getInstalledVersionIds(mods);

          const hasProject = projectId && installedProjectIds.includes(projectId);
          const hasVersion = installedVersionIds.includes(version.id) || 
                             installedVersionIds.includes(version.version_number) || 
                             (version.file_name && installedVersionIds.includes(version.file_name));

          if (hasProject || hasVersion) {
            installedSet.add(instance.id);
            // Feel free to do progressive updates if you want:
            setAlreadyInstalledInstanceIds(new Set(installedSet));
          }
        } catch {
          // ignore
        }
      }

      if (!cancelled) {
        setAlreadyInstalledInstanceIds(installedSet);
        setIsScanningMods(false);
      }
    };

    void checkInstalled();

    return () => {
      cancelled = true;
    };
  }, [instances, projectId, version]);

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
            const installedMods = await modService.getCachedModManifest(instanceId).catch(() => []);
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
              const fetchDetails = source === 'curseforge' ? getCurseForgeProjectDetails : getProjectDetails;
              const detail = await fetchDetails(dependencyId);
              return { id: dependencyId, name: detail.title };
            } catch {
              return { id: dependencyId, name: t('download.instanceSelect.unknownDependency', { id: dependencyId, defaultValue: `未知前置 (${dependencyId})` }) };
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
    <div className="flex h-full items-center border-[0.125rem] border-[#3C8527] bg-[#1E1E1F] px-[0.75rem] font-minecraft text-[0.75rem] text-[#6CC349] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.08)]">
      <Loader2 size={14} className="mr-[0.5rem] animate-spin" />
      {t('download.instanceSelect.checkingDeps', { defaultValue: '正在分析前置依赖环境...' })}
    </div>
  ) : missingDeps.length > 0 ? (
    <div className="h-full border-[0.125rem] border-[#D6A02A] bg-[#3A300F] p-[0.75rem] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.12)]">
      <div className="mb-[0.5rem] flex items-start text-[#F5C542]">
        <AlertTriangle size={16} className="mr-[0.5rem] mt-[0.125rem] flex-shrink-0" />
        <div className="font-minecraft text-[0.75rem] leading-[1.55]">
          {t('download.instanceSelect.missingDepsPrefix', { defaultValue: '已选实例缺少 ' })}
          <span className="font-bold">{missingDeps.length}</span>
          {t('download.instanceSelect.missingDepsSuffix', { defaultValue: ' 个必需的前置：' })}
          <br />
          <span className="break-words font-bold text-[#FFE08A]">{missingDeps.map((dependency) => dependency.name).join(t('download.instanceSelect.commaSeparator', { defaultValue: '、' }))}</span>
        </div>
      </div>

      <OreCheckbox
        focusKey={AUTO_DEPS_FOCUS_KEY}
        checked={autoInstallDeps}
        onChange={setAutoInstallDeps}
        onArrowPress={handleLinearFocus}
        label={t('download.instanceSelect.autoDownloadDeps', { defaultValue: '自动下载并补全前置模组' })}
        className="mt-2"
      />
    </div>
  ) : (
    <div className="flex h-full items-center border-[0.125rem] border-[#1E1E1F] bg-[#242425] px-[0.75rem] font-minecraft text-[0.75rem] text-[#B1B2B5] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.06)]">
      {selectedIds.length > 0
        ? t('download.instanceSelect.depCheckStatusEmpty', { defaultValue: '已选实例的前置检查结果会显示在这里' })
        : t('download.instanceSelect.depCheckStatusIdle', { defaultValue: '选择实例后将在这里分析前置依赖' })}
    </div>
  );

  return (
    <OreModal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('download.instanceSelect.title', { defaultValue: '选择安装目标' })}
      hideCloseButton
      defaultFocusKey={initialFocusKey}
      className="h-[min(42rem,85vh)] w-[44rem] max-w-[calc(100vw-2rem)] border-[0.1875rem] border-[#1E1E1F] bg-[var(--ore-modal-bg)] sm:max-w-[calc(100vw-3rem)]"
      contentClassName="flex flex-col overflow-hidden p-0"
    >
      <div className="flex-shrink-0 border-b-[0.1875rem] border-[#1E1E1F] bg-[#48494A] p-[1.25rem] font-minecraft text-[0.875rem] text-[#D0D1D4] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.16)]">
        <div className="mb-[0.25rem] text-[1.125rem] font-bold leading-[1.35] text-white">{t('download.instanceSelect.headerTitle', { defaultValue: '目标实例确认' })}</div>
        <div className="truncate leading-[1.5]">
          {t('download.instanceSelect.headerSubtitle', { defaultValue: '准备部署：' })}
          <span className="ml-[0.25rem] inline-block max-w-full truncate align-bottom font-bold text-[#6CC349]">
            {version.file_name}
          </span>
        </div>
        <div className="mt-[0.25rem] text-[0.625rem] uppercase tracking-[0.08em] text-[#B1B2B5]">
          {t('download.instanceSelect.envRequirement', { defaultValue: '环境需求：' })} MC {version.game_versions[0]} {ignoreLoader ? '' : `| ${version.loaders.join(', ')}`}
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 space-y-[0.5rem] overflow-y-auto bg-[#313233] p-[1rem] shadow-[inset_0_0.625rem_1.25rem_-0.625rem_rgba(0,0,0,0.55)]">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center py-[3rem] text-[#6CC349]">
            <Loader2 className="mb-[0.75rem] animate-spin" size={32} />
            <span className="font-minecraft text-[0.875rem]">{t('download.instanceSelect.matchingInstances', { defaultValue: '正在匹配兼容的实例...' })}</span>
          </div>
        ) : instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-[3rem] text-[#B1B2B5]">
            <BoxSelect size={48} className="mb-[1rem] opacity-70" />
            <div className="mb-[0.25rem] text-center font-minecraft text-[1.125rem] text-white">{t('download.instanceSelect.noMatchingInstancesTitle', { defaultValue: '未找到匹配实例' })}</div>
            <div className="px-[2rem] text-center font-minecraft text-[0.75rem] leading-[1.55]">
              {t('download.instanceSelect.noMatchingInstancesDesc', { defaultValue: '该 Mod 的运行环境与您现有的实例不兼容，请先创建一个匹配的实例。' })}
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
                      relative flex cursor-pointer items-center gap-[0.75rem] overflow-hidden border-[0.125rem] p-[0.75rem] transition-none
                      ${isSelected ? 'border-[#1D4D13] bg-[#6CC349]' : alreadyInstalledInstanceIds.has(instance.id) ? 'border-[#D6A02A] bg-[#3A300F] hover:border-[#F5C542]' : 'border-[#1E1E1F] bg-[#D0D1D4] hover:bg-[#B1B2B5]'}
                      ${focused ? 'z-10 outline outline-[0.125rem] outline-offset-[0.1875rem] outline-white brightness-[1.06]' : ''}
                    `}
                    style={{
                      boxShadow: isSelected
                        ? 'inset 0 -0.25rem 0 #3C8527, inset 0.125rem 0.125rem 0 rgba(255,255,255,0.24)'
                        : alreadyInstalledInstanceIds.has(instance.id)
                          ? 'inset 0 -0.25rem 0 #6B4F00, inset 0.125rem 0.125rem 0 rgba(255,255,255,0.12)'
                          : 'inset 0 -0.25rem 0 #58585A, inset 0.125rem 0.125rem 0 rgba(255,255,255,0.68)'
                    }}
                  >
                    <div className={`flex h-[2rem] w-[2rem] items-center justify-center border-[0.125rem] ${
                      isSelected
                        ? 'border-[#1D4D13] bg-[#D0D1D4] text-[#111214]'
                        : alreadyInstalledInstanceIds.has(instance.id)
                          ? 'border-[#D6A02A] bg-[#1E1E1F] text-[#F5C542]'
                          : 'border-[#1E1E1F] bg-[#48494A] text-[#D0D1D4]'
                    }`}>
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>

                    <Monitor
                      size={24}
                      className={`transition-colors ${isSelected ? 'text-[#1D4D13]' : alreadyInstalledInstanceIds.has(instance.id) ? 'text-[#F5C542]' : 'text-[#24563C]'}`}
                    />

                    <div className="min-w-0 flex-1">
                      <div className={`truncate font-minecraft text-[1rem] leading-[1.35] ${isSelected ? 'font-bold text-[#111214]' : alreadyInstalledInstanceIds.has(instance.id) ? 'font-bold text-[#FFE08A]' : 'text-[#111214]'}`}>
                        {instance.name}
                      </div>
                      <div className={`mt-[0.125rem] font-mono text-[0.625rem] ${isSelected ? 'text-[#1D4D13]' : alreadyInstalledInstanceIds.has(instance.id) ? 'text-[#F5C542]' : 'text-[#313233]'}`}>
                        {instance.version || t('download.instanceSelect.unknownVersion', { defaultValue: '未知版本' })} | {instance.loader || t('download.instanceSelect.unknownLoader', { defaultValue: '未知 Loader' })}
                      </div>
                    </div>

                    {isSelected ? (
                      <div className="ml-[0.75rem] flex-shrink-0 text-right">
                        <CheckCircle2 className="ml-auto text-[#1D4D13]" size={20} />
                        <div className="mt-[0.25rem] font-minecraft text-[0.625rem] uppercase tracking-[0.12em] text-[#1D4D13]">
                          {t('download.instanceSelect.selectedStatus', { defaultValue: '已选择' })}
                        </div>
                      </div>
                    ) : alreadyInstalledInstanceIds.has(instance.id) ? (
                      <div className="ml-[0.75rem] flex-shrink-0 text-right">
                        <CheckCircle2 className="ml-auto text-[#F5C542]" size={20} />
                        <div className="mt-[0.25rem] font-minecraft text-[0.625rem] uppercase tracking-[0.12em] text-[#F5C542]">
                          {t('download.instanceSelect.alreadyInstalled', { defaultValue: '已存在' })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </FocusItem>
            );
          })
        )}
      </div>

      <div className="flex flex-shrink-0 flex-col border-t-[0.1875rem] border-[#1E1E1F] bg-[#48494A] p-[1rem] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.14)]">
        <div className="mb-[1rem] min-h-[7.25rem]">
          {dependencyStatusContent}
        </div>

        <div className="flex items-center justify-between gap-[1rem]">
          <div className="flex min-w-0 items-center gap-[0.75rem]">
            <div className="min-h-[1rem] font-minecraft text-[0.625rem] uppercase tracking-[0.14em] text-[#D0D1D4]">
              {selectedIds.length > 0
                ? t('download.instanceSelect.selectedCount', { count: selectedIds.length, defaultValue: `已选择 ${selectedIds.length} 个实例` })
                : t('download.instanceSelect.pleaseSelectInstance', { defaultValue: '请至少选择一个实例' })}
            </div>
            {isScanningMods && (
              <div className="flex items-center font-minecraft text-[0.625rem] uppercase tracking-[0.08em] text-[#6CC349]">
                <Loader2 className="mr-[0.375rem] animate-spin" size={12} />
                {t('download.instanceSelect.scanningMods', { defaultValue: '正在读取实例 MOD 缓存...' })}
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-end gap-[1rem]">
            <OreButton
              focusKey={CANCEL_BUTTON_FOCUS_KEY}
              variant="secondary"
              onClick={handleClose}
              onArrowPress={handleCancelArrow}
            >
              {t('common.cancel', { defaultValue: '取消' })}
            </OreButton>
            <OreButton
              focusKey={CONFIRM_BUTTON_FOCUS_KEY}
              variant="primary"
              disabled={selectedIds.length === 0 || isLoading || isCheckingDeps || isScanningMods}
              onClick={() => { void handleConfirm(); }}
              onArrowPress={handleConfirmArrow}
              className="font-bold tracking-[0.12em]"
            >
              {t('download.instanceSelect.confirmAndDeploy', { defaultValue: '确认并部署' })}
            </OreButton>
          </div>
        </div>
      </div>
    </OreModal>
  );
};
