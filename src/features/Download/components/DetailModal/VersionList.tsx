import React from 'react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { CheckCircle2, Clock3, Download, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { OreProjectVersion } from '../../../InstanceDetail/logic/modrinthApi';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { formatDate } from '../../../../utils/formatters';

interface VersionListProps {
  versions: OreProjectVersion[];
  isLoadingVersions: boolean;
  activeVersion: string;
  activeLoader: string;
  displayVersions: OreProjectVersion[];
  installedVersionIds: string[];
  onDownload: (version: OreProjectVersion) => void;
  visibleCount: number;
  observerTarget: React.RefObject<HTMLDivElement | null>;
}

export const VersionList: React.FC<VersionListProps> = ({
  versions,
  isLoadingVersions,
  activeVersion,
  activeLoader,
  displayVersions,
  installedVersionIds,
  onDownload,
  visibleCount,
  observerTarget
}) => {
  const { t } = useTranslation();
  const getVersionRowFocusKey = (idx: number) => `download-modal-version-row-${idx}`;

  const handleVersionArrow = (idx: number) => (direction: string) => {
    if (direction === 'up' && idx === 0) {
      if (doesFocusableExist('download-modal-mc-dropdown-0')) {
        setFocus('download-modal-mc-dropdown-0');
      }
      return false;
    }

    if (direction === 'left' || direction === 'right') {
      if (doesFocusableExist('download-modal-mc-dropdown-0')) {
        setFocus('download-modal-mc-dropdown-0');
      }
      return false;
    }

    return true;
  };

  const handleVersionEnter = (version: OreProjectVersion, isInstalled: boolean) => {
    if (!isInstalled) {
      onDownload(version);
    }
  };

  return (
    <FocusBoundary id="download-modal-versions-list" className="flex min-h-full flex-col gap-2.5 p-3">
      {isLoadingVersions ? (
        <div className="flex flex-col items-center justify-center py-16 text-ore-green">
          <Loader2 className="mb-4 animate-spin" size={32} />
          <span className="font-minecraft text-sm text-[var(--ore-downloadDetail-labelText)]">
            {t('download.status.loadingVersions', { defaultValue: 'Syncing version list...' })}
          </span>
        </div>
      ) : versions.length === 0 ? (
        <div
          className="border-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-surface)] px-6 py-10 text-center font-minecraft text-sm text-[var(--ore-downloadDetail-labelText)]"
          style={{ boxShadow: 'var(--ore-downloadDetail-sectionShadow)' }}
        >
          {t('download.empty.noFilesMatch', {
            defaultValue: 'No files matched {{version}} + {{loader}}.',
            version: activeVersion || t('download.filters.versionAll', { defaultValue: 'All Versions' }),
            loader: activeLoader || t('download.filters.loaderAll', { defaultValue: 'All Loaders' })
          })}
        </div>
      ) : (
        <>
          {displayVersions.map((version, idx) => {
            const isInstalled = installedVersionIds.includes(version.id) || installedVersionIds.includes(version.version_number);

            return (
              <FocusItem
                key={version.id}
                focusKey={getVersionRowFocusKey(idx)}
                onEnter={() => handleVersionEnter(version, isInstalled)}
                onArrowPress={handleVersionArrow(idx)}
              >
                {({ ref, focused }) => (
                  <div
                    ref={ref as any}
                    onClick={() => handleVersionEnter(version, isInstalled)}
                    className={`
                      group relative flex items-center justify-between gap-3 overflow-hidden border-[2px]
                      border-[var(--ore-downloadDetail-divider)] px-4 py-2.5 transition-none
                      ${isInstalled ? 'bg-[var(--ore-downloadDetail-installedBg)] cursor-default' : 'bg-[var(--ore-downloadDetail-rowBg)] cursor-pointer'}
                      ${focused ? 'z-20 outline outline-2 outline-offset-[3px] outline-white brightness-[1.03]' : ''}
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
                        <span className="truncate font-minecraft text-[15px] leading-5 text-black">{version.name}</span>
                        <span className="border-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-base)] px-2 py-0.5 font-mono text-[10px] text-white">
                          {version.version_number}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-minecraft uppercase tracking-[0.08em] text-[#313233]">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={11} />
                          {formatDate(version.date_published)}
                        </span>
                        <span className="text-[var(--ore-downloadDetail-loaderMeta)]">
                          {version.loaders.join(', ') || t('download.loader.universal', { defaultValue: 'Universal' })}
                        </span>
                        <span className="text-[var(--ore-downloadDetail-versionMeta)]">{version.game_versions.join(', ')}</span>
                      </div>
                    </div>

                    <div className="ml-2 flex-shrink-0">
                      {isInstalled ? (
                        <span className="ore-btn ore-btn-secondary pointer-events-none relative inline-flex !h-[3.25rem] min-w-[11.5rem] select-none items-center justify-center px-5 font-minecraft text-[0.875rem] font-bold tracking-[0.12em] !text-[#111214]">
                          <CheckCircle2 size={16} className="mr-2 shrink-0" />
                          {t('download.status.alreadyInInstance', { defaultValue: 'Already in instance' })}
                        </span>
                      ) : (
                        <span className="ore-btn ore-btn-primary ore-text-shadow pointer-events-none relative inline-flex !h-[3.25rem] min-w-[11.5rem] select-none items-center justify-center px-5 font-minecraft text-[0.875rem] font-black tracking-[0.12em] !text-[#0B0C0D]">
                          <Download size={16} className="mr-2 shrink-0" />
                          {t('download.actions.downloadVersion', { defaultValue: 'Download Version' })}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </FocusItem>
            );
          })}

          {visibleCount < versions.length && (
            <div ref={observerTarget} className="flex items-center justify-center py-5">
              <Loader2 className="animate-spin text-ore-green opacity-60" size={24} />
            </div>
          )}
        </>
      )}
    </FocusBoundary>
  );
};
