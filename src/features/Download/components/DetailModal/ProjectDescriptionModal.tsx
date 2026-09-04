import React, { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Languages, Loader2, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { setFocus, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { renderMarkdownSafe, renderMarkdownInlineSafe } from '../../logic/sanitizeDescription';


import type { ModrinthProject, OreProjectDetail } from '../../../InstanceDetail/logic/modrinthApi';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { openExternalLink } from '../../../../utils/openExternalLink';
import { useIsSponsor } from '../../../../hooks/useIsSponsor';
import { OreToggleButton } from '../../../../ui/primitives/OreToggleButton';
import { useInputAction } from '../../../../ui/focus/InputDriver';
import { useEvent } from '../../../../hooks/useEvent';
import { useSettingsStore } from '../../../../store/useSettingsStore';

interface ProjectDescriptionModalProps {
  isOpen: boolean;
  project: ModrinthProject;
  details: OreProjectDetail | null;
  onClose: () => void;
}

type TranslationState =
  | { status: 'loading' }
  | { status: 'translated'; text: string; source: string; target: string }
  | { status: 'error'; error: string };

interface TranslationResponse {
  translatedText: string;
  source: string;
  target: string;
}

type TranslationMode = 'translated_only' | 'bilingual';

export const ProjectDescriptionModal: React.FC<ProjectDescriptionModalProps> = ({
  isOpen,
  project,
  details,
  onClose,
}) => {
  const { t } = useTranslation();
  const isSponsor = useIsSponsor();
  const [translation, setTranslation] = useState<TranslationState | null>(null);
  const { tmtSecretId, tmtSecretKey } = useSettingsStore((state) => state.settings.general);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationMode, setTranslationMode] = useState<TranslationMode>('translated_only');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isGalleryCollapsed, setIsGalleryCollapsed] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Trigger action navigation (LT / RT bumpers & triggers)
  useInputAction('TAB_LEFT', useCallback(() => {
    if (isOpen) setTranslationMode('translated_only');
  }, [isOpen]));
  useInputAction('PAGE_LEFT', useCallback(() => {
    if (isOpen) setTranslationMode('translated_only');
  }, [isOpen]));
  useInputAction('TAB_RIGHT', useCallback(() => {
    if (isOpen) setTranslationMode('bilingual');
  }, [isOpen]));
  useInputAction('PAGE_RIGHT', useCallback(() => {
    if (isOpen) setTranslationMode('bilingual');
  }, [isOpen]));

  // Right Stick Scrolling handler
  useEvent('ore-controller-scroll', (payload) => {
    if (!isOpen || !viewportRef.current) return;
    viewportRef.current.scrollTop += payload.deltaY;
  });

  const handleScrollArrow = useCallback((direction: string) => {
    const viewport = viewportRef.current;
    if (!viewport) return true;

    const scrollAmount = 60;
    if (direction === 'up') {
      if (viewport.scrollTop > 0) {
        viewport.scrollTop = Math.max(0, viewport.scrollTop - scrollAmount);
        return false;
      }
      return true;
    } else if (direction === 'down') {
      const maxScroll = viewport.scrollHeight - viewport.clientHeight;
      if (viewport.scrollTop < maxScroll - 1) {
        viewport.scrollTop = Math.min(maxScroll, viewport.scrollTop + scrollAmount);
        return false;
      }
      return true;
    }
    return true;
  }, []);

  const rawDescription = details?.body || details?.description || project.description || '';
  const galleryUrls = details?.gallery_urls ?? project.gallery_urls ?? [];
  const hasGallery = galleryUrls.length > 0;

  // Reset states when modal is opened for a different project
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTranslation(null);
      setShowTranslation(false);
      setActiveImageIndex(0);
      setIsGalleryCollapsed(false);
    }
  }, [isOpen, project.id]);

  // Redirect focus away from gallery if it is collapsed, landing smoothly in the reading area
  useEffect(() => {
    if (isGalleryCollapsed) {
      const current = getCurrentFocusKey();
      if (current && current.startsWith('desc-gallery-')) {
        setFocus('desc-modal-scrollarea');
      }
    }
  }, [isGalleryCollapsed]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop > 16) {
      setIsGalleryCollapsed(true);
    } else if (target.scrollTop <= 2) {
      setIsGalleryCollapsed(false);
    }
  }, []);

  const handleContentClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;

    const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
    if (!anchor?.href) return;

    event.preventDefault();
    void openExternalLink(anchor.href);
  }, []);

  const handleTranslateDescription = useCallback(async () => {
    if (!rawDescription.trim()) return;

    if (translation?.status === 'translated') {
      setShowTranslation((prev) => !prev);
      return;
    }

    setTranslation({ status: 'loading' });
    setShowTranslation(true);

    try {
      const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      const htmlImageRegex = /<img[^>]*>/gi;
      const iframeRegex = /<iframe[\s\S]*?<\/iframe>/gi;

      const placeholders: string[] = [];
      let textToTranslate = rawDescription;

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

      // Replace iframes
      textToTranslate = textToTranslate.replace(iframeRegex, (match) => {
        const placeholder = `__IFRAME_PL_${placeholders.length}__`;
        placeholders.push(match);
        return placeholder;
      });

      const result = await invoke<TranslationResponse>('translate_changelog_tmt', {
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
        const ifrRegex = new RegExp(`__IFRAME_PL_${index}__`, 'gi');
        translatedText = translatedText
          .replace(mdRegex, original)
          .replace(htmlRegex, original)
          .replace(ifrRegex, original);
      });

      setTranslation({
        status: 'translated',
        text: translatedText,
        source: result.source,
        target: result.target,
      });
    } catch (error) {
      setTranslation({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      setShowTranslation(false);
    }
  }, [rawDescription, translation, tmtSecretId, tmtSecretKey]);

  const cleanLine = (line: string) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('### ')) return trimmed.replace(/^###\s+/, '');
    if (trimmed.startsWith('## ')) return trimmed.replace(/^##\s+/, '');
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return trimmed.replace(/^[-*]\s+/, '');
    return line;
  };

  const renderBilingualDescription = (originalBody: string, translatedBody: string) => {
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
            <div 
              className="font-minecraft text-[0.875rem] font-bold leading-[1.35] text-[#C6C8CB]/60 break-words tracking-[0.02em] markdown-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdownInlineSafe(cleanLine(trimmedOrig)) }}
            />
            <div 
              className="font-minecraft text-[0.875rem] font-bold leading-[1.35] text-white ore-text-shadow break-words mt-[0.125rem] tracking-[0.02em] markdown-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdownInlineSafe(cleanLine(trans || '')) }}
            />
          </div>
        );
        continue;
      }

      if (trimmedOrig.startsWith('## ')) {
        formattedLines.push(
          <div key={i} className="pt-[0.75rem] pb-[0.25rem] first:pt-0">
            <div 
              className="font-minecraft text-[1rem] font-bold leading-[1.35] text-[#6CC349]/60 break-words tracking-[0.02em] markdown-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdownInlineSafe(cleanLine(trimmedOrig)) }}
            />
            <div 
              className="font-minecraft text-[1rem] font-bold leading-[1.35] text-[#6CC349] ore-text-shadow break-words mt-[0.125rem] tracking-[0.02em] markdown-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdownInlineSafe(cleanLine(trans || '')) }}
            />
          </div>
        );
        continue;
      }

      if (trimmedOrig.startsWith('- ') || trimmedOrig.startsWith('* ')) {
        formattedLines.push(
          <div key={i} className="flex items-start gap-[0.5rem] font-minecraft text-[0.8125rem] leading-[1.55] pt-[0.25rem] markdown-content">
            <span className="mt-[0.0625rem] text-[#6CC349]">-</span>
            <div className="flex-1 min-w-0">
              <div 
                className="text-[#C6C8CB]/60 break-words font-medium"
                dangerouslySetInnerHTML={{ __html: renderMarkdownInlineSafe(cleanLine(trimmedOrig)) }}
              />
              <div 
                className="text-[#F2F2F2] break-words mt-[0.125rem] font-medium"
                dangerouslySetInnerHTML={{ __html: renderMarkdownInlineSafe(cleanLine(trans || '')) }}
              />
            </div>
          </div>
        );
        continue;
      }

      formattedLines.push(
        <div key={i} className="pt-[0.25rem] markdown-content">
          <div 
            className="whitespace-pre-wrap break-words font-minecraft text-[0.8125rem] leading-[1.55] text-[#C6C8CB]/60 font-medium"
            dangerouslySetInnerHTML={{ __html: renderMarkdownInlineSafe(orig || '') }}
          />
          <div 
            className="whitespace-pre-wrap break-words font-minecraft text-[0.8125rem] leading-[1.55] text-[#F2F2F2] mt-[0.125rem] font-medium"
            dangerouslySetInnerHTML={{ __html: renderMarkdownInlineSafe(trans || '') }}
          />
        </div>
      );
    }

    return <div className="space-y-[0.375rem]">{formattedLines}</div>;
  };

  const renderMonolingualDescription = (body: string) => {
    if (!body.trim()) {
      return (
        <p className="font-minecraft text-[0.8125rem] leading-[1.55] text-[#E6E8EB]">
          {t('download.empty.noDescription', { defaultValue: 'No description provided yet.' })}
        </p>
      );
    }

    const html = renderMarkdownSafe(body);

    return (
      <div 
        className="markdown-content font-minecraft text-[0.8125rem] leading-[1.55] text-[#E6E8EB]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  const renderDescriptionContent = () => {
    const textToShow =
      isSponsor && showTranslation && translation?.status === 'translated'
        ? translation.text
        : rawDescription;

    if (isSponsor && showTranslation && translation?.status === 'translated' && translationMode === 'bilingual') {
      return renderBilingualDescription(rawDescription, translation.text);
    }

    return renderMonolingualDescription(textToShow);
  };

  const nextImage = () => {
    if (galleryUrls.length === 0) return;
    setActiveImageIndex((prev) => (prev + 1) % galleryUrls.length);
  };

  const prevImage = () => {
    if (galleryUrls.length === 0) return;
    setActiveImageIndex((prev) => (prev - 1 + galleryUrls.length) % galleryUrls.length);
  };

  const translateLabel =
    showTranslation
      ? t('download.versionChangelog.showOriginal', { defaultValue: 'Show Original' })
      : translation?.status === 'translated'
        ? t('download.versionChangelog.showTranslation', { defaultValue: 'Show Translation' })
        : t('download.versionChangelog.translate', { defaultValue: 'Translate' });

  const defaultFocusKey = hasGallery
    ? 'desc-gallery-btn-prev'
    : 'desc-modal-btn-close';

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      hideCloseButton
      disableScrollArea
      title={project.title}
      className="h-[min(52rem,85vh)] w-[min(70rem,calc(100vw-2.5rem))]"
      contentClassName="p-3 sm:p-4 bg-[var(--ore-modal-bg)] flex flex-col flex-1 min-h-0 overflow-hidden"
      defaultFocusKey={defaultFocusKey}
      actions={
        <div className="flex w-full flex-wrap items-center justify-center gap-[0.75rem]">
          {rawDescription.trim() && isSponsor && (
            <OreButton
              focusKey="desc-modal-btn-translate"
              variant="secondary"
              size="md"
              className="flex-1 max-w-[16rem] gap-[0.5rem] !m-0"
              disabled={translation?.status === 'loading'}
              onClick={() => {
                void handleTranslateDescription();
              }}
            >
              {translation?.status === 'loading' ? (
                <Loader2 size={16} className="shrink-0 animate-spin" />
              ) : showTranslation ? (
                <RotateCcw size={16} className="shrink-0" />
              ) : (
                <Languages size={16} className="shrink-0" />
              )}
              {translation?.status === 'loading'
                ? t('download.versionChangelog.translating', { defaultValue: 'Translating' })
                : translateLabel}
            </OreButton>
          )}
          <OreButton
            focusKey="desc-modal-btn-close"
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
      <div className="flex flex-col flex-1 min-h-0 h-full w-full gap-2.5 overflow-hidden">
        
        {/* Screenshot Carousel */}
        {hasGallery && (
          <motion.div
            initial={{ height: 'auto', opacity: 1 }}
            animate={{
              height: isGalleryCollapsed ? 0 : 'auto',
              opacity: isGalleryCollapsed ? 0 : 1,
              marginBottom: isGalleryCollapsed ? 0 : 4,
              borderWidth: isGalleryCollapsed ? 0 : 2,
              padding: isGalleryCollapsed ? 0 : 6,
            }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="relative flex flex-col items-center border-[var(--ore-border-color)] bg-[var(--ore-downloadDetail-surface)] shrink-0 overflow-hidden"
            style={{
              boxShadow: isGalleryCollapsed ? 'none' : 'inset 0 2px 0 rgba(255, 255, 255, 0.1), inset 0 -3px 0 rgba(0, 0, 0, 0.35)',
            }}
          >
            {/* Main Image View */}
            <div className="relative w-full h-[min(20rem,28vh)] flex items-center justify-center overflow-hidden border-[2px] border-[var(--ore-border-color)] bg-[var(--ore-downloadDetail-base)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
              <img
                src={galleryUrls[activeImageIndex]}
                alt={`Screenshot ${activeImageIndex + 1}`}
                className="w-full h-full object-contain"
              />

              {/* Prev / Next controls */}
              <div className="absolute inset-y-0 left-2 flex items-center">
                <FocusItem focusKey="desc-gallery-btn-prev" onEnter={prevImage} focusable={!isGalleryCollapsed}>
                  {({ ref, focused }) => (
                    <button
                      ref={ref as React.RefObject<HTMLButtonElement>}
                      type="button"
                      onClick={prevImage}
                      className={`p-2 bg-[var(--ore-modal-bg)]/90 border-[2px] text-white transition-all cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ${
                        focused
                          ? 'border-white bg-[#48494A] scale-110 shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                          : 'border-[var(--ore-border-color)] hover:bg-[#48494A]'
                      }`}
                    >
                      <ChevronLeft size={18} />
                    </button>
                  )}
                </FocusItem>
              </div>

              <div className="absolute inset-y-0 right-2 flex items-center">
                <FocusItem focusKey="desc-gallery-btn-next" onEnter={nextImage} focusable={!isGalleryCollapsed}>
                  {({ ref, focused }) => (
                    <button
                      ref={ref as React.RefObject<HTMLButtonElement>}
                      type="button"
                      onClick={nextImage}
                      className={`p-2 bg-[var(--ore-modal-bg)]/90 border-[2px] text-white transition-all cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ${
                        focused
                          ? 'border-white bg-[#48494A] scale-110 shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                          : 'border-[var(--ore-border-color)] hover:bg-[#48494A]'
                      }`}
                    >
                      <ChevronRight size={18} />
                    </button>
                  )}
                </FocusItem>
              </div>
            </div>

            {/* Thumbnail Strip */}
            <div className="mt-2 flex gap-1.5 overflow-x-auto overflow-y-hidden w-full max-w-full py-1 custom-scrollbar justify-center">
              {galleryUrls.map((url, index) => (
                <FocusItem
                  key={index}
                  focusKey={`desc-gallery-thumb-${index}`}
                  onEnter={() => setActiveImageIndex(index)}
                  focusable={!isGalleryCollapsed}
                >
                  {({ ref, focused }) => (
                    <button
                      type="button"
                      ref={ref as React.RefObject<HTMLButtonElement>}
                      onClick={() => setActiveImageIndex(index)}
                      className={`h-[2.75rem] w-[4.5rem] shrink-0 border-[2px] p-0.5 cursor-pointer transition-all overflow-hidden bg-[var(--ore-downloadDetail-base)] ${
                        focused || activeImageIndex === index
                          ? 'border-[#B9FF8A] shadow-[0_0_8px_rgba(185,255,138,0.6),inset_0_0_4px_rgba(185,255,138,0.3)] scale-[1.04] z-10'
                          : 'border-[var(--ore-border-color)] opacity-65 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Thumbnail ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  )}
                </FocusItem>
              ))}
            </div>
          </motion.div>
        )}

        {/* Translation Error */}
        {isSponsor && translation?.status === 'error' && (
          <div className="border-[2px] border-red-500/80 bg-red-950/60 px-3.5 py-2 font-minecraft text-xs leading-relaxed text-red-100 mb-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            {t('download.versionChangelog.translateFailed', {
              defaultValue: 'Translation failed: {{message}}',
              message: translation.error,
            })}
          </div>
        )}

        {/* Translation Control Bar */}
        {isSponsor && translation?.status === 'translated' && showTranslation && (
          <div className="flex items-center justify-between border-[2px] border-[var(--ore-border-color)] bg-[var(--ore-downloadDetail-surface)] px-3 py-1.5 flex-shrink-0 gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <span className="font-minecraft text-xs text-white flex items-center gap-1.5 shrink-0">
              <Languages size={14} className="text-[#B9FF8A]" />
              <span className="ore-text-shadow tracking-wider uppercase">{t('download.versionChangelog.translationActive', { defaultValue: 'TRANSLATION PREVIEW' })}</span>
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
              focusKeyPrefix="desc-modal-toggle"
            />
          </div>
        )}

        {/* Description Text Area with OreOverlayScrollArea */}
        <FocusItem
          focusKey="desc-modal-scrollarea"
          onArrowPress={handleScrollArrow}
        >
          {({ ref: focusRef, focused }) => (
            <div
              ref={focusRef as React.RefObject<HTMLDivElement>}
              className={`relative border-[2px] bg-[var(--ore-downloadDetail-base)] shadow-[inset_0_3px_6px_rgba(0,0,0,0.45),inset_0_-1px_0_rgba(255,255,255,0.06)] flex-1 min-h-0 w-full overflow-hidden transition-all ${
                focused
                  ? 'border-white outline outline-[2px] outline-[var(--ore-focus-ringFallback)] outline-offset-[-2px] z-10'
                  : 'border-[var(--ore-border-color)]'
              }`}
            >
              {/* Translation Source Overlay Badge */}
              {isSponsor && showTranslation && translation?.status === 'translated' && (
                <div 
                  className="absolute top-2.5 right-3 z-30 pointer-events-none select-none border-[2px] border-[var(--ore-border-color)] bg-[#242526]/95 px-2 py-0.5 font-minecraft text-[0.6875rem] uppercase tracking-[0.08em] text-[#B9FF8A] flex items-center gap-1.5 shadow-md"
                  style={{ backdropFilter: 'blur(4px)' }}
                >
                  <Languages size={11} className="text-[#B9FF8A]" />
                  <span>{t('download.versionChangelog.machineTranslated', { defaultValue: 'Translated by TMT' })}</span>
                </div>
              )}

              <OreOverlayScrollArea
                ref={viewportRef}
                className="absolute inset-0 w-full h-full max-h-full"
                style={{ height: '100%', maxHeight: '100%' }}
                contentClassName="p-4 sm:p-5 font-minecraft"
                contentSafePaddingRight={18}
                onScroll={handleScroll}
                onClick={handleContentClick}
              >
                {renderDescriptionContent()}
              </OreOverlayScrollArea>
            </div>
          )}
        </FocusItem>
      </div>
    </OreModal>
  );
};
