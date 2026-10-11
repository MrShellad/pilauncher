import React from 'react';
import { Download, Languages, Loader2, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { OreProjectVersion } from '@/features/resource-catalog';
import { useIsSponsor } from '../../../../hooks/useIsSponsor';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { useVersionChangelogTranslation } from '../../hooks/useVersionChangelogTranslation';
import { VersionChangelogContent } from './VersionChangelogContent';

interface VersionChangelogModalProps {
  isOpen: boolean;
  version: OreProjectVersion | null;
  onClose: () => void;
  onDownload: (version: OreProjectVersion) => void;
  isInstalled: boolean;
}

export const VersionChangelogModal: React.FC<VersionChangelogModalProps> = ({
  isOpen,
  version,
  onClose,
  onDownload,
  isInstalled,
}) => {
  const { t } = useTranslation();
  const isSponsor = useIsSponsor();
  const {
    handleTranslateChangelog,
    selectedCanTranslate,
    selectedChangelogText,
    selectedHasChangelog,
    selectedIsShowingTranslation,
    selectedTranslation,
    setTranslationMode,
    translationMode,
  } = useVersionChangelogTranslation({ isOpen, isSponsor, version });

  const selectedTranslateLabel = selectedIsShowingTranslation
    ? t('download.versionChangelog.showOriginal', { defaultValue: 'Show Original' })
    : selectedTranslation?.status === 'translated'
      ? t('download.versionChangelog.showTranslation', { defaultValue: 'Show Translation' })
      : t('download.versionChangelog.translate', { defaultValue: 'Translate' });

  const selectedDefaultFocusKey = version
    ? 'download-version-changelog-download'
    : selectedHasChangelog && isSponsor
      ? 'download-version-changelog-translate'
      : 'download-version-changelog-close';

  return (
    <OreModal
      isOpen={isOpen && !!version}
      onClose={onClose}
      hideCloseButton
      disableScrollArea
      title={t('download.versionChangelog.title', { defaultValue: 'Version Changelog' })}
      className="w-[min(54rem,calc(100vw-2rem))]"
      contentClassName="p-[1rem] bg-[var(--ore-modal-bg)] overflow-hidden flex flex-col min-h-0"
      defaultFocusKey={selectedDefaultFocusKey}
      actions={
        <div className="flex w-full flex-wrap items-center justify-center gap-[0.75rem]">
          {version && selectedHasChangelog && isSponsor && (
            <OreButton
              focusKey="download-version-changelog-translate"
              variant="secondary"
              size="md"
              className="flex-1 max-w-[16rem] gap-[0.5rem] !m-0"
              disabled={!selectedCanTranslate}
              onClick={() => {
                void handleTranslateChangelog();
              }}
            >
              {selectedTranslation?.status === 'loading' ? (
                <Loader2 size={16} className="shrink-0 animate-spin" />
              ) : selectedIsShowingTranslation ? (
                <RotateCcw size={16} className="shrink-0" />
              ) : (
                <Languages size={16} className="shrink-0" />
              )}
              {selectedTranslation?.status === 'loading'
                ? t('download.versionChangelog.translating', { defaultValue: 'Translating' })
                : selectedTranslateLabel}
            </OreButton>
          )}
          {version && (
            <OreButton
              focusKey="download-version-changelog-download"
              variant={isInstalled ? 'secondary' : 'primary'}
              size="md"
              className="flex-1 max-w-[16rem] gap-[0.5rem] !m-0"
              onClick={() => {
                onDownload(version);
              }}
            >
              {isInstalled ? <RotateCcw size={16} className="shrink-0" /> : <Download size={16} className="shrink-0" />}
              {isInstalled
                ? t('download.actions.reinstall', { defaultValue: '重新下载' })
                : t('download.actions.downloadVersion', { defaultValue: 'Download Version' })}
            </OreButton>
          )}
          <OreButton
            focusKey="download-version-changelog-close"
            variant="secondary"
            size="md"
            className="flex-1 max-w-[16rem] !m-0"
            onClick={onClose}
          >
            {t('common.close', { defaultValue: 'Close' })}
          </OreButton>
        </div>
      }
    >
      {version && (
        <VersionChangelogContent
          isOpen={isOpen}
          isSponsor={isSponsor}
          selectedChangelogText={selectedChangelogText}
          selectedIsShowingTranslation={selectedIsShowingTranslation}
          selectedTranslation={selectedTranslation}
          translationMode={translationMode}
          version={version}
          onTranslationModeChange={setTranslationMode}
        />
      )}
    </OreModal>
  );
};
