import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { CheckCircle2, Clock3, Download, Languages, Loader2, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useInputAction } from '../../../../ui/focus/InputDriver';

import type { OreProjectVersion } from '../../../InstanceDetail/logic/modrinthApi';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
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
  observerTarget: React.Ref<HTMLDivElement>;
}

type ChangelogTranslationState =
  | { status: 'loading' }
  | { status: 'translated'; text: string; source: string; target: string; chunks: number }
  | { status: 'error'; error: string };

interface ChangelogTranslationResponse {
  translatedText: string;
  source: string;
  target: string;
  chunks: number;
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
  const [selectedVersion, setSelectedVersion] = React.useState<OreProjectVersion | null>(null);
  const [translations, setTranslations] = React.useState<Record<string, ChangelogTranslationState>>({});
  const [showTranslatedChangelog, setShowTranslatedChangelog] = React.useState<Record<string, boolean>>({});
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
        if (version && !isVersionInstalled(version)) {
          onDownload(version);
        }
      }
    }
  });

  const handleVersionEnter = (version: OreProjectVersion) => {
    setSelectedVersion(version);
  };

  const handleTranslateChangelog = React.useCallback(async () => {
    if (!selectedVersion?.changelog?.trim()) return;

    const versionId = selectedVersion.id;
    const current = translations[versionId];
    if (current?.status === 'translated') {
      setShowTranslatedChangelog((prev) => ({
        ...prev,
        [versionId]: !prev[versionId],
      }));
      return;
    }

    setTranslations((prev) => ({
      ...prev,
      [versionId]: { status: 'loading' },
    }));
    setShowTranslatedChangelog((prev) => ({
      ...prev,
      [versionId]: true,
    }));

    try {
      const result = await invoke<ChangelogTranslationResponse>('translate_changelog_tmt', {
        text: selectedVersion.changelog,
        source: 'auto',
        target: 'zh',
      });

      setTranslations((prev) => ({
        ...prev,
        [versionId]: {
          status: 'translated',
          text: result.translatedText,
          source: result.source,
          target: result.target,
          chunks: result.chunks,
        },
      }));
    } catch (error) {
      setTranslations((prev) => ({
        ...prev,
        [versionId]: {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        },
      }));
      setShowTranslatedChangelog((prev) => ({
        ...prev,
        [versionId]: false,
      }));
    }
  }, [selectedVersion, translations]);

  const renderChangelog = (body?: string | null) => {
    if (!body?.trim()) {
      return (
        <p className="font-minecraft text-[0.8125rem] leading-[1.55] text-[#E6E8EB]">
          {t('download.empty.noChangelog', { defaultValue: 'No changelog available for this version.' })}
        </p>
      );
    }

    return (
      <div className="space-y-[0.375rem]">
        {body.split('\n').map((line, index) => {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('### ')) {
            return (
              <h3 key={index} className="pt-[0.625rem] font-minecraft text-[0.875rem] font-bold leading-[1.35] text-white first:pt-0">
                {trimmedLine.replace(/^###\s+/, '')}
              </h3>
            );
          }
          if (trimmedLine.startsWith('## ')) {
            return (
              <h2 key={index} className="pt-[0.75rem] font-minecraft text-[1rem] font-bold leading-[1.35] text-[#6CC349] first:pt-0">
                {trimmedLine.replace(/^##\s+/, '')}
              </h2>
            );
          }
          if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
            return (
              <div key={index} className="flex items-start gap-[0.5rem] font-minecraft text-[0.8125rem] leading-[1.55] text-[#E6E8EB]">
                <span className="mt-[0.0625rem] text-[#6CC349]">-</span>
                <span className="min-w-0 break-words">{trimmedLine.replace(/^[-*]\s+/, '')}</span>
              </div>
            );
          }
          if (!trimmedLine) {
            return <div key={index} className="h-[0.25rem]" />;
          }
          return (
            <p key={index} className="whitespace-pre-wrap break-words font-minecraft text-[0.8125rem] leading-[1.55] text-[#E6E8EB]">
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  const selectedTranslation = selectedVersion ? translations[selectedVersion.id] : undefined;
  const selectedHasChangelog = !!selectedVersion?.changelog?.trim();
  const selectedIsShowingTranslation =
    !!selectedVersion &&
    showTranslatedChangelog[selectedVersion.id] &&
    selectedTranslation?.status === 'translated';
  const selectedChangelogText =
    selectedIsShowingTranslation && selectedTranslation?.status === 'translated'
      ? selectedTranslation.text
      : selectedVersion?.changelog;
  const selectedCanTranslate =
    !!selectedVersion && selectedHasChangelog && selectedTranslation?.status !== 'loading';
  const selectedTranslateLabel =
    selectedIsShowingTranslation
      ? t('download.versionChangelog.showOriginal', { defaultValue: 'Show Original' })
      : selectedTranslation?.status === 'translated'
        ? t('download.versionChangelog.showTranslation', { defaultValue: 'Show Translation' })
        : t('download.versionChangelog.translate', { defaultValue: 'Translate' });
  const selectedDefaultFocusKey =
    selectedVersion && !isVersionInstalled(selectedVersion)
      ? 'download-version-changelog-download'
      : selectedHasChangelog
        ? 'download-version-changelog-translate'
        : 'download-version-changelog-close';

  return (
    <>
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
              const isInstalled = isVersionInstalled(version);

              return (
                <FocusItem
                  key={version.id}
                  focusKey={getVersionRowFocusKey(idx)}
                  onEnter={() => handleVersionEnter(version)}
                  onArrowPress={handleVersionArrow(idx)}
              >
                {({ ref, focused }) => (
                  <div
                    ref={ref as any}
                    onClick={() => handleVersionEnter(version)}
                    className={`
                      group relative flex items-center justify-between gap-3 overflow-hidden border-[2px]
                      border-[var(--ore-downloadDetail-divider)] px-4 py-2.5
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
                        <OreButton
                          variant="secondary"
                          size="auto"
                          focusable={false}
                          disabled
                          className="!h-[3.25rem] min-w-[11.5rem] gap-[0.5rem] !px-[1.25rem] text-[0.875rem] tracking-[0.12em]"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <CheckCircle2 size={16} className="shrink-0" />
                          {t('download.status.alreadyInInstance', { defaultValue: 'Already in instance' })}
                        </OreButton>
                      ) : (
                        <OreButton
                          variant="primary"
                          size="auto"
                          focusable={false}
                          className="!h-[3.25rem] min-w-[11.5rem] gap-[0.5rem] !px-[1.25rem] text-[0.875rem] tracking-[0.12em]"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDownload(version);
                          }}
                        >
                          <Download size={16} className="shrink-0" />
                          {t('download.actions.downloadVersion', { defaultValue: 'Download Version' })}
                        </OreButton>
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

      <OreModal
        isOpen={!!selectedVersion}
        onClose={() => setSelectedVersion(null)}
        title={t('download.versionChangelog.title', { defaultValue: 'Version Changelog' })}
        className="w-[min(42rem,calc(100vw-2rem))]"
        contentClassName="max-h-[70vh] overflow-y-auto custom-scrollbar p-[1rem] bg-[var(--ore-modal-bg)]"
        defaultFocusKey={selectedDefaultFocusKey}
        actions={
          <div className="flex w-full items-center justify-end gap-[0.75rem]">
            {selectedVersion && selectedHasChangelog && (
              <OreButton
                focusKey="download-version-changelog-translate"
                variant="secondary"
                size="sm"
                className="gap-[0.5rem]"
                disabled={!selectedCanTranslate}
                onClick={() => {
                  void handleTranslateChangelog();
                }}
              >
                {selectedTranslation?.status === 'loading' ? (
                  <Loader2 size={14} className="shrink-0 animate-spin" />
                ) : selectedIsShowingTranslation ? (
                  <RotateCcw size={14} className="shrink-0" />
                ) : (
                  <Languages size={14} className="shrink-0" />
                )}
                {selectedTranslation?.status === 'loading'
                  ? t('download.versionChangelog.translating', { defaultValue: 'Translating' })
                  : selectedTranslateLabel}
              </OreButton>
            )}
            {selectedVersion && !isVersionInstalled(selectedVersion) && (
              <OreButton
                focusKey="download-version-changelog-download"
                variant="primary"
                size="sm"
                className="gap-[0.5rem]"
                onClick={() => {
                  onDownload(selectedVersion);
                  setSelectedVersion(null);
                }}
              >
                <Download size={14} className="shrink-0" />
                {t('download.actions.downloadVersion', { defaultValue: 'Download Version' })}
              </OreButton>
            )}
            <OreButton
              focusKey="download-version-changelog-close"
              variant="secondary"
              size="sm"
              onClick={() => setSelectedVersion(null)}
            >
              {t('common.close', { defaultValue: 'Close' })}
            </OreButton>
          </div>
        }
      >
        {selectedVersion && (
          <div className="flex flex-col gap-[0.875rem]">
            <div
              className="border-[0.125rem] border-[#1E1E1F] bg-[#D0D1D4] px-[0.875rem] py-[0.75rem]"
              style={{ boxShadow: 'inset 0 -0.25rem 0 #8C8D90, inset 0.125rem 0.125rem 0 rgba(255,255,255,0.72)' }}
            >
              <div className="font-minecraft text-[1rem] font-bold leading-[1.35] text-[#111214]">{selectedVersion.name}</div>
              <div className="mt-[0.375rem] flex flex-wrap items-center gap-x-[0.75rem] gap-y-[0.375rem] font-minecraft text-[0.625rem] uppercase tracking-[0.08em] text-[#313233]">
                <span>{selectedVersion.version_number}</span>
                <span>{formatDate(selectedVersion.date_published)}</span>
                <span>{selectedVersion.loaders.join(', ') || t('download.loader.universal', { defaultValue: 'Universal' })}</span>
              </div>
            </div>

            {selectedTranslation?.status === 'error' && (
              <div className="border-[0.125rem] border-red-500/70 bg-red-950/40 px-[0.875rem] py-[0.625rem] font-minecraft text-[0.75rem] leading-[1.5] text-red-100">
                {t('download.versionChangelog.translateFailed', {
                  defaultValue: 'Translation failed: {{message}}',
                  message: selectedTranslation.error,
                })}
              </div>
            )}

            {selectedIsShowingTranslation && selectedTranslation?.status === 'translated' && (
              <div className="border-[0.125rem] border-[#6D6D6E] bg-[#313233] px-[0.875rem] py-[0.5rem] font-minecraft text-[0.6875rem] uppercase tracking-[0.08em] text-[#B9FF8A]">
                {t('download.versionChangelog.machineTranslated', {
                  defaultValue: 'Machine translated by TMT',
                })}
              </div>
            )}

            <div className="max-h-[24rem] overflow-y-auto custom-scrollbar border-[0.125rem] border-[#6D6D6E] bg-[#1E1E1F] p-[0.875rem] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.08)]">
              {renderChangelog(selectedChangelogText)}
            </div>
          </div>
        )}
      </OreModal>
    </>
  );
};
