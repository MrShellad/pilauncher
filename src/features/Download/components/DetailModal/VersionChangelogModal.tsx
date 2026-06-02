import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreToggleButton } from '../../../../ui/primitives/OreToggleButton';
import { useInputAction } from '../../../../ui/focus/InputDriver';
import { useSettingsStore } from '../../../../store/useSettingsStore';

import { invoke } from '@tauri-apps/api/core';
import { CheckCircle2, Download, Languages, Loader2, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { OreProjectVersion } from '../../../InstanceDetail/logic/modrinthApi';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { useIsSponsor } from '../../../../hooks/useIsSponsor';
import { formatDate } from '../../../../utils/formatters';

interface VersionChangelogModalProps {
  isOpen: boolean;
  version: OreProjectVersion | null;
  onClose: () => void;
  onDownload: (version: OreProjectVersion) => void;
  isInstalled: boolean;
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

type TranslationMode = 'translated_only' | 'bilingual';

export const VersionChangelogModal: React.FC<VersionChangelogModalProps> = ({
  isOpen,
  version,
  onClose,
  onDownload,
  isInstalled,
}) => {
  const { t } = useTranslation();
  const isSponsor = useIsSponsor();
  const { tmtSecretId, tmtSecretKey } = useSettingsStore((state) => state.settings.general);

  const [translations, setTranslations] = useState<Record<string, ChangelogTranslationState>>({});
  const [showTranslatedChangelog, setShowTranslatedChangelog] = useState<Record<string, boolean>>({});
  const [translationMode, setTranslationMode] = useState<TranslationMode>('translated_only');
  const viewportRef = useRef<HTMLDivElement>(null);

  // Trigger action navigation (LT / RT bumpers & triggers)
  useInputAction('TAB_LEFT', useCallback(() => {
    if (isOpen && version) setTranslationMode('translated_only');
  }, [isOpen, version]));
  useInputAction('PAGE_LEFT', useCallback(() => {
    if (isOpen && version) setTranslationMode('translated_only');
  }, [isOpen, version]));
  useInputAction('TAB_RIGHT', useCallback(() => {
    if (isOpen && version) setTranslationMode('bilingual');
  }, [isOpen, version]));
  useInputAction('PAGE_RIGHT', useCallback(() => {
    if (isOpen && version) setTranslationMode('bilingual');
  }, [isOpen, version]));

  // Right Stick Scrolling handler
  useEffect(() => {
    const handleControllerScroll = (e: CustomEvent<{ deltaY: number }>) => {
      if (!isOpen || !viewportRef.current) return;
      viewportRef.current.scrollTop += e.detail.deltaY;
    };
    window.addEventListener('ore-controller-scroll', handleControllerScroll as EventListener);
    return () => {
      window.removeEventListener('ore-controller-scroll', handleControllerScroll as EventListener);
    };
  }, [isOpen]);

  const handleScrollArrow = useCallback((direction: string) => {
    const viewport = viewportRef.current;
    if (!viewport) return true;

    const scrollAmount = 40;
    if (direction === 'up') {
      if (viewport.scrollTop > 0) {
        viewport.scrollTop = Math.max(0, viewport.scrollTop - scrollAmount);
        return false; // Consume event (do not move focus)
      }
      return true; // Let focus escape up
    } else if (direction === 'down') {
      const maxScroll = viewport.scrollHeight - viewport.clientHeight;
      if (viewport.scrollTop < maxScroll - 1) {
        viewport.scrollTop = Math.min(maxScroll, viewport.scrollTop + scrollAmount);
        return false; // Consume event (do not move focus)
      }
      return true; // Let focus escape down
    }
    return true;
  }, []);

  const versionId = version?.id;

  const handleTranslateChangelog = useCallback(async () => {
    if (!version?.changelog?.trim() || !versionId) return;

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
      const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      const htmlImageRegex = /<img[^>]*>/gi;

      const placeholders: string[] = [];
      let textToTranslate = version.changelog;

      // Replace HTML images
      textToTranslate = textToTranslate.replace(htmlImageRegex, (match) => {
        const placeholder = `__HTML_IMG_PL_${placeholders.length}__`;
        placeholders.push(match);
        return placeholder;
      });

      // Replace Markdown images
      textToTranslate = textToTranslate.replace(markdownImageRegex, (match) => {
        const placeholder = `__MD_IMG_PL_${placeholders.length}__`;
        placeholders.push(match);
        return placeholder;
      });

      const result = await invoke<ChangelogTranslationResponse>('translate_changelog_tmt', {
        text: textToTranslate,
        source: 'auto',
        target: 'zh',
        secretId: tmtSecretId || null,
        secretKey: tmtSecretKey || null,
      });

      let translatedText = result.translatedText;
      placeholders.forEach((original, index) => {
        const mdRegex = new RegExp(`__MD_IMG_PL_${index}__`, 'gi');
        const htmlRegex = new RegExp(`__HTML_IMG_PL_${index}__`, 'gi');
        translatedText = translatedText.replace(mdRegex, original).replace(htmlRegex, original);
      });

      setTranslations((prev) => ({
        ...prev,
        [versionId]: {
          status: 'translated',
          text: translatedText,
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
  }, [version, versionId, translations, tmtSecretId, tmtSecretKey]);


  const cleanLine = (line: string) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('### ')) return trimmed.replace(/^###\s+/, '');
    if (trimmed.startsWith('## ')) return trimmed.replace(/^##\s+/, '');
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return trimmed.replace(/^[-*]\s+/, '');
    return line;
  };

  const renderBilingualChangelog = (originalBody: string, translatedBody: string) => {
    const originalLines = originalBody.split('\n');
    const translatedLines = translatedBody.split('\n');
    const maxLines = Math.max(originalLines.length, translatedLines.length);

    const formattedLines: React.ReactNode[] = [];

    for (let i = 0; i < maxLines; i++) {
      const orig = originalLines[i];
      const trans = translatedLines[i];

      if (orig === undefined && trans === undefined) continue;

      const trimmedOrig = orig?.trim() || '';

      if (!trimmedOrig && !trans?.trim()) {
        formattedLines.push(<div key={i} className="h-[0.25rem]" />);
        continue;
      }

      if (trimmedOrig.startsWith('### ')) {
        formattedLines.push(
          <div key={i} className="pt-[0.625rem] pb-[0.25rem] first:pt-0">
            <div className="font-minecraft text-[0.875rem] font-bold leading-[1.35] text-white/40 break-words tracking-[0.02em]">
              {cleanLine(trimmedOrig)}
            </div>
            <div className="font-minecraft text-[0.875rem] font-bold leading-[1.35] text-white break-words mt-[0.125rem] tracking-[0.02em]">
              {cleanLine(trans || '')}
            </div>
          </div>
        );
        continue;
      }

      if (trimmedOrig.startsWith('## ')) {
        formattedLines.push(
          <div key={i} className="pt-[0.75rem] pb-[0.25rem] first:pt-0">
            <div className="font-minecraft text-[1rem] font-bold leading-[1.35] text-[#6CC349]/40 break-words tracking-[0.02em]">
              {cleanLine(trimmedOrig)}
            </div>
            <div className="font-minecraft text-[1rem] font-bold leading-[1.35] text-[#6CC349] break-words mt-[0.125rem] tracking-[0.02em]">
              {cleanLine(trans || '')}
            </div>
          </div>
        );
        continue;
      }

      if (trimmedOrig.startsWith('- ') || trimmedOrig.startsWith('* ')) {
        formattedLines.push(
          <div key={i} className="flex items-start gap-[0.5rem] font-minecraft text-[0.8125rem] leading-[1.55] pt-[0.25rem]">
            <span className="mt-[0.0625rem] text-[#6CC349]">-</span>
            <div className="flex-1 min-w-0">
              <div className="text-[#E6E8EB]/40 break-words font-medium">
                {cleanLine(trimmedOrig)}
              </div>
              <div className="text-[#E6E8EB] break-words mt-[0.125rem] font-medium">
                {cleanLine(trans || '')}
              </div>
            </div>
          </div>
        );
        continue;
      }

      formattedLines.push(
        <div key={i} className="pt-[0.25rem]">
          <div className="whitespace-pre-wrap break-words font-minecraft text-[0.8125rem] leading-[1.55] text-[#E6E8EB]/40 font-medium">
            {orig || ''}
          </div>
          <div className="whitespace-pre-wrap break-words font-minecraft text-[0.8125rem] leading-[1.55] text-[#E6E8EB] mt-[0.125rem] font-medium">
            {trans || ''}
          </div>
        </div>
      );
    }

    return <div className="space-y-[0.375rem]">{formattedLines}</div>;
  };

  const renderMonolingualChangelog = (body: string) => {
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

  const renderChangelog = (body?: string | null) => {
    if (!body?.trim()) {
      return (
        <p className="font-minecraft text-[0.8125rem] leading-[1.55] text-[#E6E8EB]">
          {t('download.versionChangelog.noChangelog', { defaultValue: 'No changelog available for this version.' })}
        </p>
      );
    }

    if (selectedIsShowingTranslation && selectedTranslation?.status === 'translated' && translationMode === 'bilingual') {
      return renderBilingualChangelog(version?.changelog || '', selectedTranslation.text);
    }

    return renderMonolingualChangelog(body);
  };

  const selectedTranslation = versionId ? translations[versionId] : undefined;
  const selectedHasChangelog = !!version?.changelog?.trim();
  const selectedIsShowingTranslation =
    !!versionId &&
    !!showTranslatedChangelog[versionId] &&
    selectedTranslation?.status === 'translated';
  const selectedChangelogText =
    isSponsor && selectedIsShowingTranslation && selectedTranslation?.status === 'translated'
      ? selectedTranslation.text
      : version?.changelog;
  const selectedCanTranslate =
    !!versionId && selectedHasChangelog && selectedTranslation?.status !== 'loading';
  const selectedTranslateLabel =
    selectedIsShowingTranslation
      ? t('download.versionChangelog.showOriginal', { defaultValue: 'Show Original' })
      : selectedTranslation?.status === 'translated'
        ? t('download.versionChangelog.showTranslation', { defaultValue: 'Show Translation' })
        : t('download.versionChangelog.translate', { defaultValue: 'Translate' });

  const selectedDefaultFocusKey =
    version
      ? 'download-version-changelog-download'
      : selectedHasChangelog && isSponsor
        ? 'download-version-changelog-translate'
        : 'download-version-changelog-close';

  return (
    <OreModal
      isOpen={isOpen && !!version}
      onClose={onClose}
      hideCloseButton
      title={t('download.versionChangelog.title', { defaultValue: 'Version Changelog' })}
      className="w-[min(54rem,calc(100vw-2rem))]"
      contentClassName="p-[1rem] bg-[var(--ore-modal-bg)] overflow-hidden flex flex-col min-h-0"
      defaultFocusKey={selectedDefaultFocusKey}
      actions={
        <div className="flex w-full flex-wrap items-center justify-center gap-[0.75rem]"> {/* Centered buttons */}
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
              {isInstalled ? <CheckCircle2 size={16} className="shrink-0" /> : <Download size={16} className="shrink-0" />}
              {isInstalled
                ? t('download.status.alreadyInInstance', { defaultValue: 'Already in instance' })
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
        <div className="flex flex-col gap-[0.875rem]">
          {/* Metadata Area */}
          <div
            className="border-[0.125rem] border-[#1E1E1F] bg-[var(--ore-downloadDetail-rowBg)] px-[0.875rem] py-[0.75rem]"
            style={{ boxShadow: 'var(--ore-downloadDetail-rowShadow)' }}
          >
            <div className="font-minecraft text-[1rem] font-bold leading-[1.35] text-[var(--ore-downloadDetail-rowText)]">{version.name}</div>
            <div className="mt-[0.375rem] flex flex-wrap items-center gap-x-[0.75rem] gap-y-[0.375rem] font-minecraft text-[0.625rem] uppercase tracking-[0.08em] text-[var(--ore-downloadDetail-rowMutedText)]">
              <span>{version.version_number}</span>
              <span>{formatDate(version.date_published)}</span>
              <span>{version.loaders.join(', ') || t('download.loader.universal', { defaultValue: 'Universal' })}</span>
            </div>
          </div>

          {/* Translation Error */}
          {isSponsor && selectedTranslation?.status === 'error' && (
            <div className="border-[0.125rem] border-red-500/70 bg-red-950/40 px-[0.875rem] py-[0.625rem] font-minecraft text-[0.75rem] leading-[1.5] text-red-100">
              {t('download.versionChangelog.translateFailed', {
                defaultValue: 'Translation failed: {{message}}',
                message: selectedTranslation.error,
              })}
            </div>
          )}

          {/* Translation Control Bar */}
          {isSponsor && selectedTranslation?.status === 'translated' && selectedIsShowingTranslation && (
            <div className="flex items-center justify-between border-[0.125rem] border-[#6D6D6E] bg-[#2A2B2D] px-[0.75rem] py-[0.4rem] gap-[1rem]">
              <span className="font-minecraft text-[0.7rem] text-[#E6E8EB] flex items-center gap-1.5 shrink-0">
                <Languages size={12} className="text-[#B9FF8A]" />
                <span>{t('download.versionChangelog.translationActive', { defaultValue: 'TRANSLATION PREVIEW' })}</span>
              </span>

              <OreToggleButton
                options={[
                  {
                    label: t('download.versionChangelog.modeTranslatedOnly', { defaultValue: 'Translation' }),
                    value: 'translated_only',
                  },
                  {
                    label: t('download.versionChangelog.modeBilingual', { defaultValue: 'Bilingual' }),
                    value: 'bilingual',
                  },
                ]}
                value={translationMode}
                onChange={(val) => setTranslationMode(val as TranslationMode)}
                size="sm"
                className="w-[15rem]"
                focusKeyPrefix="download-version-changelog-toggle"
              />
            </div>
          )}

          {/* Changelog Display Box using OreOverlayScrollArea */}
          <FocusItem
            focusKey="download-version-changelog-scrollarea"
            onArrowPress={handleScrollArrow}
          >
            {({ ref: focusRef, focused }) => (
              <div
                ref={focusRef as React.RefObject<HTMLDivElement>}
                className={`relative border-[0.125rem] bg-[#1E1E1F] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.08)] transition-all ${
                  focused
                    ? 'border-white outline outline-[2px] outline-[var(--ore-focus-ringFallback)] outline-offset-[-2px] z-10'
                    : 'border-[#6D6D6E]'
                }`}
              >
                {/* Translation Source Overlay Badge */}
                {isSponsor && selectedIsShowingTranslation && selectedTranslation?.status === 'translated' && (
                  <div 
                    className="absolute top-2.5 right-3 z-30 pointer-events-none select-none border border-[#B9FF8A]/35 bg-[#313233]/90 px-2 py-0.5 font-minecraft text-[0.625rem] uppercase tracking-[0.08em] text-[#B9FF8A] flex items-center gap-1.5 shadow-md transition-all duration-300"
                    style={{ backdropFilter: 'blur(4px)' }}
                  >
                    <Languages size={10} className="text-[#B9FF8A]" />
                    <span>{t('download.versionChangelog.machineTranslated', { defaultValue: 'Translated by TMT' })}</span>
                  </div>
                )}

                <OreOverlayScrollArea
                  ref={viewportRef}
                  className="h-[min(26rem,45vh)] w-full"
                  viewportClassName="p-[0.875rem]"
                  contentSafePaddingRight={18}
                >
                  {renderChangelog(selectedChangelogText)}
                </OreOverlayScrollArea>
              </div>
            )}
          </FocusItem>
        </div>
      )}
    </OreModal>
  );
};
