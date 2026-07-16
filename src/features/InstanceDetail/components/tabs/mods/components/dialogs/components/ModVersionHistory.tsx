// src/features/InstanceDetail/components/tabs/mods/components/dialogs/components/ModVersionHistory.tsx
import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CheckCircle2, Clock3, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { OreToggleButton } from '../../../../../../../../ui/primitives/OreToggleButton';
import { OreButton } from '../../../../../../../../ui/primitives/OreButton';
import { FocusItem } from '../../../../../../../../ui/focus/FocusItem';
import { OreOverlayScrollArea } from '../../../../../../../../ui/primitives/OreOverlayScrollArea';
import {
  type ModMeta,
  type ModPlatformId,
  type ModVersionInstallAction
} from '../../../../../../logic/modService';
import { type OreProjectVersion } from '../../../../../../logic/modrinthApi';
import {
  HISTORY_PLATFORM_TABS,
  getPlatformFileId,
  getPlatformProjectId
} from '../utils/modDetailUtils';
import { hasCurseForgeApiKey } from '../../../../../../../Download/logic/curseforgeApi';
import { formatDate } from '../../../../../../../../utils/formatters';

interface ModVersionHistoryProps {
  mod: ModMeta;
  displayMod: ModMeta | null;
  activePlatform: ModPlatformId;
  setActivePlatform: (id: ModPlatformId) => void;
  isLoadingVersions: boolean;
  modVersions: any[];
  onInstallVersion: (mod: ModMeta, version: OreProjectVersion, action: ModVersionInstallAction) => void;
}

const VersionListSkeleton = () => {
  return (
    <div className="border-[2px] border-[var(--ore-downloadDetail-divider)] rounded-sm overflow-hidden flex-1 flex flex-col min-h-0 animate-pulse bg-transparent">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className={`flex flex-col sm:flex-row justify-between sm:items-center py-3.5 px-3 sm:px-4 border-b-[2px] border-[var(--ore-downloadDetail-divider)] ${index === 4 ? 'border-b-0' : ''} gap-3 sm:gap-0 bg-[var(--ore-downloadDetail-rowBg)]/50`}
        >
          <div className="flex items-center flex-1 min-w-0 pr-0 sm:pr-4">
            <div className="hidden sm:block w-2 h-2 rounded-full mr-3 flex-shrink-0 bg-gray-700"></div>
            <div className="flex flex-col flex-1 gap-2 min-w-0">
              <div className="h-3.5 bg-gray-700 rounded-sm w-[45%] sm:w-[55%]"></div>
              <div className="h-2.5 bg-gray-800 rounded-sm w-[25%] sm:w-[35%]"></div>
            </div>
          </div>
          <div className="w-full sm:w-20 h-8 bg-gray-700 rounded-sm shrink-0"></div>
        </div>
      ))}
    </div>
  );
};

export const ModVersionHistory: React.FC<ModVersionHistoryProps> = ({
  mod,
  displayMod,
  activePlatform,
  setActivePlatform,
  isLoadingVersions,
  modVersions,
  onInstallVersion
}) => {
  const { t } = useTranslation();
  const isCfKeyMissing = activePlatform === 'curseforge' && !hasCurseForgeApiKey();

  const versionInstallLabels: Record<ModVersionInstallAction, string> = {
    install: t('instanceDetail.mods.versionHistory.actions.install', { defaultValue: '安装' }),
    upgrade: t('instanceDetail.mods.versionHistory.actions.upgrade', { defaultValue: '升级' }),
    downgrade: t('instanceDetail.mods.versionHistory.actions.downgrade', { defaultValue: '降级' }),
    reinstall: t('instanceDetail.mods.versionHistory.actions.reinstall', { defaultValue: '重装' })
  };

  const currentFileId = getPlatformFileId(displayMod, activePlatform) || getPlatformFileId(mod, activePlatform);
  const currentVersionIndex = modVersions.findIndex((version) => {
    if (currentFileId && version.id === currentFileId) return true;
    if (
      activePlatform === 'curseforge' &&
      typeof mod.curseforgeFingerprint === 'number' &&
      version.fileFingerprint === mod.curseforgeFingerprint
    ) {
      return true;
    }
    if (
      version.file_name &&
      mod.fileName &&
      version.file_name.toLowerCase() === mod.fileName.toLowerCase()
    ) {
      return true;
    }
    return false;
  });

  const getVersionInstallAction = (_version: OreProjectVersion, index: number): ModVersionInstallAction => {
    if (index === currentVersionIndex) return 'reinstall';
    if (currentVersionIndex < 0) return 'install';
    return index < currentVersionIndex ? 'upgrade' : 'downgrade';
  };

  const toggleOptions = HISTORY_PLATFORM_TABS.map((tab) => ({
    label: tab.label,
    value: tab.id
  }));

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: modVersions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 border-t border-white/5 pt-4 font-minecraft">
      <div className="flex flex-col items-center justify-center mb-4 shrink-0">
        <OreToggleButton
          options={toggleOptions}
          value={activePlatform}
          onChange={(id) => setActivePlatform(id as ModPlatformId)}
          focusKeyPrefix="active-platform"
          uiScale="adaptive"
          size="sm"
          className="[--ore-toggle-height:2rem] [--ore-toggle-min-width:6.5rem] [--ore-toggle-px:0.75rem] [--ore-toggle-font-size:0.8125rem]"
        />
      </div>
      {isLoadingVersions ? (
        <VersionListSkeleton />
      ) : isCfKeyMissing ? (
        <div className="text-center text-ore-text-muted py-8 font-minecraft text-sm border-[2px] border-dashed border-[var(--ore-downloadDetail-divider)] bg-transparent rounded-sm flex flex-col items-center justify-center gap-2 px-4" style={{ boxShadow: 'var(--ore-downloadDetail-sectionShadow)' }}>
          <span className="text-red-400/90">{t('download.apiKeyMissing', { defaultValue: '未配置 VITE_CURSEFORGE_API_KEY，CurseForge 接口不可用。' })}</span>
        </div>
      ) : modVersions.length > 0 ? (
        <OreOverlayScrollArea
          ref={parentRef}
          className="flex-1 w-full min-h-0"
          viewportClassName="h-full custom-scrollbar"
          style={{
            height: '100%',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const index = virtualRow.index;
              const v = modVersions[index];
              if (!v) return null;

              const action = getVersionInstallAction(v, index);
              const actionLabel = versionInstallLabels[action];
              const baseTarget = displayMod || mod;
              const platformProjectId = getPlatformProjectId(baseTarget, activePlatform) || v.project_id;
              const platformFileId = getPlatformFileId(baseTarget, activePlatform);
              const actionTarget: ModMeta = baseTarget.manifestEntry && platformProjectId
                ? {
                    ...baseTarget,
                    manifestEntry: {
                      ...baseTarget.manifestEntry,
                      source: {
                        ...baseTarget.manifestEntry.source,
                        platform: activePlatform,
                        projectId: platformProjectId,
                        fileId: platformFileId || baseTarget.manifestEntry.source.fileId
                      },
                      matchedPlatforms: {
                        ...(baseTarget.manifestEntry.matchedPlatforms || {}),
                        [activePlatform]: {
                          ...(baseTarget.manifestEntry.matchedPlatforms?.[activePlatform] || {}),
                          projectId: platformProjectId,
                          fileId: platformFileId
                        }
                      }
                    }
                  }
                : baseTarget;

              const isInstalled = action === 'reinstall';

              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    padding: '4px 6px',
                  }}
                >
                  <FocusItem key={v.id || index} focusKey={`mod-version-${index}`}>
                    {({ ref, focused }) => (
                      <div
                        ref={ref as any}
                        className={`
                          group relative flex items-center justify-between gap-3 overflow-hidden border-[2px]
                          border-[var(--ore-downloadDetail-divider)] px-4 py-3 rounded-[2px]
                          transition-[filter,outline] duration-100 cursor-pointer hover:brightness-[1.06]
                          ${isInstalled
                            ? 'bg-[var(--ore-downloadDetail-installedBg)]'
                            : 'bg-[var(--ore-downloadDetail-rowBg)]'}
                          ${focused ? 'z-20 outline outline-2 outline-offset-[3px] outline-white brightness-[1.06]' : ''}
                        `}
                        style={{
                          boxShadow: isInstalled
                            ? 'var(--ore-downloadDetail-installedShadow)'
                            : 'var(--ore-downloadDetail-rowShadow)'
                        }}
                      >
                        <div
                          className={`absolute inset-y-0 left-0 w-2 ${
                            isInstalled ? 'bg-[var(--ore-downloadDetail-installedAccent)]' : 'bg-[var(--ore-downloadDetail-idleAccent)]'
                          }`}
                        />

                        <div className="flex min-w-0 flex-1 flex-col pl-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-minecraft text-[0.9375rem] leading-5 text-[var(--ore-downloadDetail-rowText)]">
                              {v.name}
                            </span>
                            <span className="border-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-base)] px-2 py-0.5 font-mono text-[0.625rem] text-white">
                              {v.version_number}
                            </span>
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.625rem] font-minecraft uppercase tracking-[0.08em] text-[var(--ore-downloadDetail-rowMutedText)]">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 size={11} />
                              {formatDate(v.date_published)}
                            </span>
                            <span className="text-[var(--ore-downloadDetail-loaderMeta)]">
                              {v.loaders?.join(', ') || t('download.loader.universal', { defaultValue: 'Universal' })}
                            </span>
                            {v.game_versions && (
                              <span className="text-[var(--ore-downloadDetail-versionMeta)]">
                                {v.game_versions.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="ml-2 flex-shrink-0">
                          <OreButton
                            focusKey={`btn-install-${index}`}
                            variant={isInstalled ? 'secondary' : 'primary'}
                            size="auto"
                            onClick={() => onInstallVersion(actionTarget, v, action)}
                            className="h-10 w-full sm:w-28 gap-1.5 px-3 text-xs tracking-wider shrink-0"
                          >
                            {isInstalled ? (
                              <CheckCircle2 size={14} className="shrink-0" />
                            ) : (
                              <Download size={14} className="shrink-0" />
                            )}
                            {actionLabel}
                          </OreButton>
                        </div>
                      </div>
                    )}
                  </FocusItem>
                </div>
              );
            })}
          </div>
        </OreOverlayScrollArea>
      ) : (
        <div className="text-center text-ore-text-muted py-8 font-minecraft text-sm border-[2px] border-dashed border-[var(--ore-downloadDetail-divider)] bg-transparent rounded-sm flex items-center justify-center" style={{ boxShadow: 'var(--ore-downloadDetail-sectionShadow)' }}>
          {t('instanceDetail.mods.versionHistory.empty', { defaultValue: '暂无在 {{platform}} 上的版本记录', platform: activePlatform })}
        </div>
      )}
    </div>
  );
};
