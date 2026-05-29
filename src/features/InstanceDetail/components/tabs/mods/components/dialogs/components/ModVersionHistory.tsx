// src/features/InstanceDetail/components/tabs/mods/components/dialogs/components/ModVersionHistory.tsx
import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { OreToggleButton } from '../../../../../../../../ui/primitives/OreToggleButton';
import { OreButton } from '../../../../../../../../ui/primitives/OreButton';
import { FocusItem } from '../../../../../../../../ui/focus/FocusItem';
import { VirtuosoScroller } from '../../../../../../../../ui/primitives/OreOverlayScrollArea';
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
    <div className="border-[2px] border-[var(--ore-border-color)] rounded-sm overflow-hidden flex-1 flex flex-col min-h-0 animate-pulse bg-transparent">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className={`flex flex-col sm:flex-row justify-between sm:items-center py-3.5 px-3 sm:px-4 border-b-[2px] border-[var(--ore-border-color)] ${index === 4 ? 'border-b-0' : ''} gap-3 sm:gap-0 bg-[var(--ore-color-background-surface-panel)]`}
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

  return (
    <div className="flex-1 flex flex-col min-h-0 border-t border-white/5 pt-4 font-minecraft">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-3 gap-3 shrink-0">
        <h3 className="font-minecraft text-white text-sm sm:text-base tracking-wide">{t('instanceDetail.mods.versionHistory.title', { defaultValue: '版本历史 (当前实例)' })}</h3>
        <OreToggleButton
          options={toggleOptions}
          value={activePlatform}
          onChange={(id) => setActivePlatform(id as ModPlatformId)}
          focusKeyPrefix="active-platform"
          uiScale="adaptive"
          size="sm"
          className="[--ore-toggle-height:2rem] [--ore-toggle-min-width:5.5rem] [--ore-toggle-px:0.75rem] [--ore-toggle-font-size:0.8125rem]"
        />
      </div>
      {isLoadingVersions ? (
        <VersionListSkeleton />
      ) : modVersions.length > 0 ? (
        <div className="border-[2px] border-[var(--ore-border-color)] rounded-sm overflow-hidden flex-1 flex flex-col min-h-0 bg-transparent">
          <Virtuoso
            className="h-full"
            data={modVersions}
            components={{ Scroller: VirtuosoScroller }}
            itemContent={(index, v) => {
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

              return (
                <FocusItem key={v.id || index} focusKey={`mod-version-${index}`}>
                  {({ ref, focused }) => (
                    <div
                      ref={ref as any}
                      className={`flex flex-col sm:flex-row justify-between sm:items-center py-2.5 px-3 sm:px-4 border-b-[2px] border-[var(--ore-border-color)] ${index === modVersions.length - 1 ? 'border-b-0' : ''} outline-none transition-none cursor-pointer gap-3 sm:gap-0 ${
                        focused ? 'bg-[var(--ore-color-background-surface-hover)] z-10' : 'bg-[var(--ore-color-background-surface-panel)] hover:bg-[var(--ore-color-background-surface-hover)]/60'
                      }`}
                    >
                      <div className="flex items-center flex-1 min-w-0 pr-0 sm:pr-4">
                        <div
                          className={`hidden sm:block w-2 h-2 rounded-full mr-3 flex-shrink-0 ${
                            focused ? 'bg-white' : 'bg-ore-green/80'
                          }`}
                        ></div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className={`font-minecraft text-sm truncate ${focused ? 'text-white' : 'text-gray-200'}`}>
                            <span
                              className={`inline-block sm:hidden w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${
                                focused ? 'bg-white' : 'bg-ore-green/80'
                              }`}
                            ></span>
                            {v.name}
                          </span>
                          <span className="text-xs text-ore-text-muted mt-0.5 truncate">
                            {t('instanceDetail.mods.versionHistory.versionInfo', { defaultValue: '版本: {{versionNumber}} • {{date}} 发布', versionNumber: v.version_number, date: new Date(v.date_published).toLocaleDateString() })}
                          </span>
                        </div>
                      </div>
                      <OreButton
                        focusKey={`btn-install-${index}`}
                        variant={action === 'reinstall' ? 'secondary' : 'primary'}
                        size="auto"
                        onClick={() => onInstallVersion(actionTarget, v, action)}
                        className="w-full sm:w-20 shrink-0"
                      >
                        <Download size={13} className="mr-1.5" />
                        {actionLabel}
                      </OreButton>
                    </div>
                  )}
                </FocusItem>
              );
            }}
          />
        </div>
      ) : (
        <div className="text-center text-ore-text-muted py-8 font-minecraft text-sm border-[2px] border-dashed border-[var(--ore-border-color)] bg-transparent rounded-sm flex items-center justify-center">
          {t('instanceDetail.mods.versionHistory.empty', { defaultValue: '暂无在 {{platform}} 上的版本记录', platform: activePlatform })}
        </div>
      )}
    </div>
  );
};
