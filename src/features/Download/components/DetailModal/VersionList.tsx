import React from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { CheckCircle2, Clock3, Download, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { useInputAction } from '../../../../ui/focus/InputDriver';

import type { OreProjectVersion } from '../../../InstanceDetail/logic/modrinthApi';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { formatDate } from '../../../../utils/formatters';
import { VersionChangelogModal } from './VersionChangelogModal';

interface VersionListProps {
  versions: OreProjectVersion[];
  isLoadingVersions: boolean;
  activeVersion: string;
  activeLoader: string;
  displayVersions: OreProjectVersion[];
  installedVersionIds: string[];
  onDownload: (version: OreProjectVersion) => void;
  visibleCount: number;
  observerTarget: React.Ref<HTMLDivElement>;
}


const VersionRowSkeleton = () => {
  return (
    <div
      className="group relative flex items-center justify-between gap-3 overflow-hidden border-[2px] border-[var(--ore-downloadDetail-divider)] px-4 py-3 bg-[var(--ore-downloadDetail-rowBg)]/50 animate-pulse"
      style={{
        boxShadow: 'var(--ore-downloadDetail-rowShadow)',
      }}
    >
      <div className="absolute inset-y-0 left-0 w-2 bg-[var(--ore-downloadDetail-idleAccent)]/40" />

      <div className="flex min-w-0 flex-1 flex-col pl-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Version name placeholder */}
          <div className="h-[1.125rem] w-40 bg-[var(--ore-downloadDetail-rowText)]/20 rounded-sm" />
          {/* Version number badge placeholder */}
          <div className="h-[1.25rem] w-16 bg-[var(--ore-downloadDetail-rowText)]/15 border-[2px] border-[var(--ore-downloadDetail-divider)] rounded-sm" />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* Date placeholder */}
          <div className="h-[0.75rem] w-16 bg-[var(--ore-downloadDetail-rowMutedText)]/20 rounded-sm" />
          {/* Loader placeholder */}
          <div className="h-[0.75rem] w-12 bg-[var(--ore-downloadDetail-loaderMeta)]/20 rounded-sm" />
          {/* Game version placeholder */}
          <div className="h-[0.75rem] w-20 bg-[var(--ore-downloadDetail-versionMeta)]/20 rounded-sm" />
        </div>
      </div>

      <div className="ml-2 flex-shrink-0">
        {/* Button placeholder */}
        <div className="h-10 w-[13.5rem] bg-[var(--ore-downloadDetail-rowText)]/10 border-[2px] border-[var(--ore-downloadDetail-divider)] rounded-sm" />
      </div>
    </div>
  );
};

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
  const [selectedVersion, setSelectedVersion] = React.useState<OreProjectVersion | null>(null);
  const getVersionRowFocusKey = (idx: number) => `download-modal-version-row-${idx}`;
  const isVersionInstalled = (version: OreProjectVersion) =>
    installedVersionIds.includes(version.id) ||
    installedVersionIds.includes(version.version_number) ||
    installedVersionIds.includes(version.file_name);

  const handleVersionArrow = (idx: number) => (direction: string) => {
    if (direction === 'up' && idx === 0) {
      if (doesFocusableExist('download-modal-mc-dropdown-0')) {
        setFocus('download-modal-mc-dropdown-0');
      }
      return false;
    }

    return true;
  };

  useInputAction('ACTION_Y', () => {
    const focusKey = getCurrentFocusKey();
    if (focusKey) {
      const match = focusKey.match(/^download-modal-version-row-(\d+)$/);
      if (match) {
        const idx = parseInt(match[1], 10);
        const version = displayVersions[idx];
        if (version) {
          onDownload(version);
        }
      }
    }
  });

  const handleVersionEnter = (version: OreProjectVersion) => {
    setSelectedVersion(version);
  };

  return (
    <>
      <FocusBoundary id="download-modal-versions-list" className="flex min-h-full flex-col gap-2.5 p-3">
        {isLoadingVersions ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 5 }).map((_, idx) => (
              <VersionRowSkeleton key={idx} />
            ))}
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
              const isInstalled = isVersionInstalled(version);

              return (
                <FocusItem
                  key={version.id}
                  focusKey={getVersionRowFocusKey(idx)}
                  onEnter={() => handleVersionEnter(version)}
                  onArrowPress={handleVersionArrow(idx)}
              >
                {({ ref, focused }) => (
                  <motion.div
                    ref={ref as any}
                    onClick={() => handleVersionEnter(version)}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 30,
                      delay: idx * 0.02
                    }}
                    className={`
                      group relative flex items-center justify-between gap-3 overflow-hidden border-[2px]
                      border-[var(--ore-downloadDetail-divider)] px-4 py-3
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
                        <span className="truncate font-minecraft text-[0.9375rem] leading-5 text-[var(--ore-downloadDetail-rowText)]">{version.name}</span>
                        <span className="border-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-base)] px-2 py-0.5 font-mono text-[0.625rem] text-white">
                          {version.version_number}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.625rem] font-minecraft uppercase tracking-[0.08em] text-[var(--ore-downloadDetail-rowMutedText)]">
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
                        <OreButton
                          variant="secondary"
                          size="auto"
                          focusable={false}
                          className="h-10 w-[13.5rem] gap-2 px-4 text-xs tracking-wider"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDownload(version);
                          }}
                        >
                          <CheckCircle2 size={14} className="shrink-0" />
                          {t('download.status.alreadyInInstance', { defaultValue: 'Already in instance' })}
                        </OreButton>
                      ) : (
                        <OreButton
                          variant="primary"
                          size="auto"
                          focusable={false}
                          className="h-10 w-[13.5rem] gap-2 px-4 text-xs tracking-wider"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDownload(version);
                          }}
                        >
                          <Download size={14} className="shrink-0" />
                          {t('download.actions.downloadVersion', { defaultValue: 'Download Version' })}
                        </OreButton>
                      )}
                    </div>
                  </motion.div>
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

      <VersionChangelogModal
        isOpen={!!selectedVersion}
        version={selectedVersion}
        onClose={() => setSelectedVersion(null)}
        onDownload={(version) => {
          onDownload(version);
          setSelectedVersion(null);
        }}
        isInstalled={selectedVersion ? isVersionInstalled(selectedVersion) : false}
      />
    </>
  );
};
