import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  doesFocusableExist,
  getCurrentFocusKey,
  setFocus,
} from '@noriginmedia/norigin-spatial-navigation';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OreProjectVersion } from '@/features/resource-catalog';
import { useInputAction } from '../../../../ui/focus/InputDriver';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import type { DownloadSource } from '../../hooks/useResourceDownload';
import { useInstanceSelectData } from '../../hooks/useInstanceSelectData';
import { InstanceDependencyStatus } from './InstanceDependencyStatus';
import { InstanceSelectionList } from './InstanceSelectionList';
import {
  AUTO_DEPS_FOCUS_KEY,
  CANCEL_BUTTON_FOCUS_KEY,
  CONFIRM_BUTTON_FOCUS_KEY,
  getInstanceFocusKey,
} from './instanceSelectModel';

interface InstanceSelectModalProps {
  isOpen: boolean;
  version: OreProjectVersion | null;
  onClose: () => void;
  onConfirm: (instanceIds: string[], autoInstallDeps: boolean) => void | Promise<void>;
  ignoreLoader?: boolean;
  projectId?: string;
  source?: DownloadSource;
}

interface InstanceSelectModalContentProps {
  version: OreProjectVersion;
  onClose: () => void;
  onConfirm: (instanceIds: string[], autoInstallDeps: boolean) => void | Promise<void>;
  ignoreLoader: boolean;
  projectId?: string;
  source: DownloadSource;
}

const InstanceSelectModalContent: React.FC<InstanceSelectModalContentProps> = ({
  version,
  onClose,
  onConfirm,
  ignoreLoader,
  projectId,
  source,
}) => {
  const { t } = useTranslation();
  const lastFocusBeforeModalRef = useRef<string | null>(null);
  const {
    instances,
    selectedIds,
    toggleSelection,
    isLoading,
    isCheckingDeps,
    missingDeps,
    autoInstallDeps,
    setAutoInstallDeps,
    isScanningMods,
    alreadyInstalledInstanceIds,
  } = useInstanceSelectData({ version, ignoreLoader, projectId, source });
  const initialFocusKey = instances.length > 0
    ? getInstanceFocusKey(instances[0].id)
    : CANCEL_BUTTON_FOCUS_KEY;
  const focusOrder = useMemo(
    () => [
      ...instances.map((instance) => getInstanceFocusKey(instance.id)),
      ...(missingDeps.length > 0 ? [AUTO_DEPS_FOCUS_KEY] : []),
      CANCEL_BUTTON_FOCUS_KEY,
      CONFIRM_BUTTON_FOCUS_KEY,
    ],
    [instances, missingDeps.length],
  );
  const { handleLinearArrow } = useLinearNavigation(focusOrder, initialFocusKey, true, true);

  useEffect(() => {
    const currentFocus = getCurrentFocusKey();
    if (currentFocus && currentFocus !== 'SN:ROOT') {
      lastFocusBeforeModalRef.current = currentFocus;
    }
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
      'download-modal-mc-dropdown-0',
    ];
    const nextFocus = candidates.find(
      (focusKey): focusKey is string => typeof focusKey === 'string' && doesFocusableExist(focusKey),
    );
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
    void Promise.resolve(onConfirm(
      selectedIds,
      missingDeps.length > 0 ? autoInstallDeps : false,
    ));
  }, [autoInstallDeps, missingDeps.length, onConfirm, selectedIds]);

  useInputAction('CANCEL', handleClose);

  useEffect(() => {
    const currentFocus = getCurrentFocusKey();
    if (currentFocus && doesFocusableExist(currentFocus)) return;

    const fallbackKey = [
      initialFocusKey,
      CANCEL_BUTTON_FOCUS_KEY,
      CONFIRM_BUTTON_FOCUS_KEY,
    ].find((focusKey) => doesFocusableExist(focusKey));
    if (fallbackKey) {
      setFocus(fallbackKey);
    }
  }, [initialFocusKey, instances.length, isCheckingDeps, missingDeps.length, selectedIds.length]);

  return (
    <OreModal
      isOpen
      onClose={handleClose}
      title={t('download.instanceSelect.title', { defaultValue: '选择安装目标' })}
      hideCloseButton
      disableScrollArea
      defaultFocusKey={initialFocusKey}
      className="h-[min(42rem,85vh)] w-[44rem] max-w-[calc(100vw-2rem)] border-[0.1875rem] border-[#1E1E1F] bg-[var(--ore-modal-bg)] sm:max-w-[calc(100vw-3rem)]"
      contentClassName="flex flex-col overflow-hidden p-0"
    >
      <div className="flex-shrink-0 border-b-[0.1875rem] border-[#1E1E1F] bg-[#48494A] p-[1.25rem] font-minecraft text-[0.875rem] text-[#D0D1D4] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.16)]">
        <div className="mb-[0.25rem] text-[1.125rem] font-bold leading-[1.35] text-white">
          {t('download.instanceSelect.headerTitle', { defaultValue: '目标实例确认' })}
        </div>
        <div className="truncate leading-[1.5]">
          {t('download.instanceSelect.headerSubtitle', { defaultValue: '准备部署：' })}
          <span className="ml-[0.25rem] inline-block max-w-full truncate align-bottom font-bold text-[#6CC349]">
            {version.file_name}
          </span>
        </div>
        <div className="mt-[0.25rem] text-[0.625rem] uppercase tracking-[0.08em] text-[#B1B2B5]">
          {t('download.instanceSelect.envRequirement', { defaultValue: '环境需求：' })}
          {' MC '}
          {version.game_versions[0]}
          {ignoreLoader ? '' : ` | ${version.loaders.join(', ')}`}
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 space-y-[0.5rem] overflow-y-auto bg-[#313233] p-[1rem] shadow-[inset_0_0.625rem_1.25rem_-0.625rem_rgba(0,0,0,0.55)]">
        <InstanceSelectionList
          instances={instances}
          selectedIds={selectedIds}
          alreadyInstalledInstanceIds={alreadyInstalledInstanceIds}
          isLoading={isLoading}
          onToggle={toggleSelection}
          onClick={handleInstanceClick}
          onArrowPress={handleLinearFocus}
        />
      </div>

      <div className="flex flex-shrink-0 flex-col border-t-[0.1875rem] border-[#1E1E1F] bg-[#48494A] p-[1rem] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.14)]">
        <div className="mb-[1rem] min-h-[7.25rem]">
          <InstanceDependencyStatus
            isChecking={isCheckingDeps}
            missingDependencies={missingDeps}
            selectedCount={selectedIds.length}
            autoInstall={autoInstallDeps}
            onAutoInstallChange={setAutoInstallDeps}
            onArrowPress={handleLinearFocus}
          />
        </div>

        <div className="flex items-center justify-between gap-[1rem]">
          <div className="flex min-w-0 items-center gap-[0.75rem]">
            <div className="min-h-[1rem] font-minecraft text-[0.625rem] uppercase tracking-[0.14em] text-[#D0D1D4]">
              {selectedIds.length > 0
                ? t('download.instanceSelect.selectedCount', {
                  count: selectedIds.length,
                  defaultValue: `已选择 ${selectedIds.length} 个实例`,
                })
                : t('download.instanceSelect.pleaseSelectInstance', {
                  defaultValue: '请至少选择一个实例',
                })}
            </div>
            {isScanningMods && (
              <div className="flex items-center font-minecraft text-[0.625rem] uppercase tracking-[0.08em] text-[#6CC349]">
                <Loader2 className="mr-[0.375rem] animate-spin" size={12} />
                {t('download.instanceSelect.scanningMods', {
                  defaultValue: '正在读取实例 MOD 缓存...',
                })}
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
              onClick={handleConfirm}
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

export const InstanceSelectModal: React.FC<InstanceSelectModalProps> = ({
  isOpen,
  version,
  onClose,
  onConfirm,
  ignoreLoader = false,
  projectId,
  source = 'modrinth',
}) => {
  if (!isOpen || !version) return null;

  const lifecycleKey = [
    version.id,
    version.version_number,
    version.file_name,
    version.game_versions.join(','),
    version.loaders.join(','),
    ignoreLoader ? 'ignore-loader' : 'match-loader',
  ].join('|');

  return (
    <InstanceSelectModalContent
      key={lifecycleKey}
      version={version}
      onClose={onClose}
      onConfirm={onConfirm}
      ignoreLoader={ignoreLoader}
      projectId={projectId}
      source={source}
    />
  );
};
