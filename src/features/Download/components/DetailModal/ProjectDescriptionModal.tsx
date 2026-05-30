import React, { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Languages, Loader2, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { setFocus, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { marked } from 'marked';


import type { ModrinthProject, OreProjectDetail } from '../../../InstanceDetail/logic/modrinthApi';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { openExternalLink } from '../../../../utils/openExternalLink';
import { useIsSponsor } from '../../../../hooks/useIsSponsor';

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
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationMode, setTranslationMode] = useState<TranslationMode>('translated_only');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isGalleryCollapsed, setIsGalleryCollapsed] = useState(false);

  const rawDescription = details?.body || details?.description || project.description || '';
  const galleryUrls = details?.gallery_urls ?? project.gallery_urls ?? [];
  const hasGallery = galleryUrls.length > 0;

  const scrollAreaHeight = isGalleryCollapsed
    ? 'min(35rem, 58vh)'
    : 'min(16rem, 26vh)';

  // Reset states when modal is opened for a different project
  useEffect(() => {
    if (isOpen) {
      setTranslation(null);
      setShowTranslation(false);
      setActiveImageIndex(0);
      setIsGalleryCollapsed(false);
    }
  }, [isOpen, project.id]);

  // Redirect focus away from gallery if it is collapsed
  useEffect(() => {
    if (isGalleryCollapsed) {
      const current = getCurrentFocusKey();
      if (current && current.startsWith('desc-gallery-')) {
        setFocus('desc-modal-btn-close');
      }
    }
  }, [isGalleryCollapsed]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop > 10) {
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
      const result = await invoke<TranslationResponse>('translate_changelog_tmt', {
        text: rawDescription,
        source: 'auto',
        target: 'zh',
      });

      setTranslation({
        status: 'translated',
        text: result.translatedText,
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
  }, [rawDescription, translation]);

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
              className="font-minecraft text-[0.875rem] font-bold leading-[1.35] text-white/40 break-words tracking-[0.02em] markdown-content"
              dangerouslySetInnerHTML={{ __html: marked.parseInline(cleanLine(trimmedOrig)) as string }}
            />
            <div 
              className="font-minecraft text-[0.875rem] font-bold leading-[1.35] text-white break-words mt-[0.125rem] tracking-[0.02em] markdown-content"
              dangerouslySetInnerHTML={{ __html: marked.parseInline(cleanLine(trans || '')) as string }}
            />
          </div>
        );
        continue;
      }

      if (trimmedOrig.startsWith('## ')) {
        formattedLines.push(
          <div key={i} className="pt-[0.75rem] pb-[0.25rem] first:pt-0">
            <div 
              className="font-minecraft text-[1rem] font-bold leading-[1.35] text-[#6CC349]/40 break-words tracking-[0.02em] markdown-content"
              dangerouslySetInnerHTML={{ __html: marked.parseInline(cleanLine(trimmedOrig)) as string }}
            />
            <div 
              className="font-minecraft text-[1rem] font-bold leading-[1.35] text-[#6CC349] break-words mt-[0.125rem] tracking-[0.02em] markdown-content"
              dangerouslySetInnerHTML={{ __html: marked.parseInline(cleanLine(trans || '')) as string }}
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
                className="text-[#E6E8EB]/40 break-words font-medium"
                dangerouslySetInnerHTML={{ __html: marked.parseInline(cleanLine(trimmedOrig)) as string }}
              />
              <div 
                className="text-[#E6E8EB] break-words mt-[0.125rem] font-medium"
                dangerouslySetInnerHTML={{ __html: marked.parseInline(cleanLine(trans || '')) as string }}
              />
            </div>
          </div>
        );
        continue;
      }

      formattedLines.push(
        <div key={i} className="pt-[0.25rem] markdown-content">
          <div 
            className="whitespace-pre-wrap break-words font-minecraft text-[0.8125rem] leading-[1.55] text-[#E6E8EB]/40 font-medium"
            dangerouslySetInnerHTML={{ __html: marked.parseInline(orig || '') as string }}
          />
          <div 
            className="whitespace-pre-wrap break-words font-minecraft text-[0.8125rem] leading-[1.55] text-[#E6E8EB] mt-[0.125rem] font-medium"
            dangerouslySetInnerHTML={{ __html: marked.parseInline(trans || '') as string }}
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

    const html = marked.parse(body) as string;

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
      title={project.title}
      className="w-[min(54rem,calc(100vw-2rem))]"
      contentClassName="p-[1rem] bg-[var(--ore-modal-bg)] overflow-hidden flex flex-col min-h-0"
      defaultFocusKey={defaultFocusKey}
      actions={
        <div className="flex w-full items-center justify-center gap-[0.75rem]">
          {rawDescription.trim() && isSponsor && (
            <OreButton
              focusKey="desc-modal-btn-translate"
              variant="secondary"
              size="sm"
              className="gap-[0.5rem] !m-0"
              disabled={translation?.status === 'loading'}
              onClick={() => {
                void handleTranslateDescription();
              }}
            >
              {translation?.status === 'loading' ? (
                <Loader2 size={14} className="shrink-0 animate-spin" />
              ) : showTranslation ? (
                <RotateCcw size={14} className="shrink-0" />
              ) : (
                <Languages size={14} className="shrink-0" />
              )}
              {translation?.status === 'loading'
                ? t('download.versionChangelog.translating', { defaultValue: 'Translating' })
                : translateLabel}
            </OreButton>
          )}
          <OreButton
            focusKey="desc-modal-btn-close"
            variant="secondary"
            size="sm"
            className="!m-0"
            onClick={onClose}
          >
            {t('common.close', { defaultValue: 'Close' })}
          </OreButton>
        </div>
      }
    >
      <div className="flex flex-col flex-1 min-h-0" style={{ height: 'min(38rem, 65vh)' }}>
        
        {/* Screenshot Carousel */}
        {hasGallery && (
          <motion.div
            initial={{ height: 'auto', opacity: 1, marginBottom: '0.875rem' }}
            animate={{
              height: isGalleryCollapsed ? 0 : 'auto',
              opacity: isGalleryCollapsed ? 0 : 1,
              marginBottom: isGalleryCollapsed ? 0 : '0.875rem',
              borderWidth: isGalleryCollapsed ? 0 : '0.125rem',
              padding: isGalleryCollapsed ? 0 : '0.5rem',
            }}
            transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
            className="relative flex flex-col items-center border-[#1E1E1F] bg-[#1a1a1c] rounded-[2px] overflow-hidden"
          >
            {/* Main Image View */}
            <div className="relative w-full h-[min(18rem,25vh)] flex items-center justify-center overflow-hidden">
              <img
                src={galleryUrls[activeImageIndex]}
                alt={`Screenshot ${activeImageIndex + 1}`}
                className="max-w-full max-h-full object-contain shadow-lg"
              />

              {/* Prev / Next controls */}
              <div className="absolute inset-y-0 left-2 flex items-center">
                <FocusItem focusKey="desc-gallery-btn-prev" onEnter={prevImage} focusable={!isGalleryCollapsed}>
                  {({ ref, focused }) => (
                    <button
                      ref={ref as any}
                      type="button"
                      onClick={prevImage}
                      className={`p-1.5 rounded bg-black/60 border text-white transition-all cursor-pointer ${
                        focused ? 'border-[#B9FF8A] bg-black/85 scale-110' : 'border-white/20'
                      }`}
                    >
                      <ChevronLeft size={16} />
                    </button>
                  )}
                </FocusItem>
              </div>

              <div className="absolute inset-y-0 right-2 flex items-center">
                <FocusItem focusKey="desc-gallery-btn-next" onEnter={nextImage} focusable={!isGalleryCollapsed}>
                  {({ ref, focused }) => (
                    <button
                      ref={ref as any}
                      type="button"
                      onClick={nextImage}
                      className={`p-1.5 rounded bg-black/60 border text-white transition-all cursor-pointer ${
                        focused ? 'border-[#B9FF8A] bg-black/85 scale-110' : 'border-white/20'
                      }`}
                    >
                      <ChevronRight size={16} />
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
                    <img
                      ref={ref as any}
                      src={url}
                      alt={`Thumbnail ${index + 1}`}
                      onClick={() => setActiveImageIndex(index)}
                      className={`h-[2.5rem] w-auto shrink-0 border cursor-pointer transition-all object-cover ${
                        focused || activeImageIndex === index
                          ? 'border-[#B9FF8A] scale-[1.05]'
                          : 'border-white/10 opacity-60 hover:opacity-100'
                      }`}
                    />
                  )}
                </FocusItem>
              ))}
            </div>
          </motion.div>
        )}

        {/* Translation Error */}
        {isSponsor && translation?.status === 'error' && (
          <div className="border-[0.125rem] border-red-500/70 bg-red-950/40 px-[0.875rem] py-[0.625rem] font-minecraft text-[0.75rem] leading-[1.5] text-red-100 mb-[0.875rem]">
            {t('download.versionChangelog.translateFailed', {
              defaultValue: 'Translation failed: {{message}}',
              message: translation.error,
            })}
          </div>
        )}

        {/* Translation Control Bar */}
        {isSponsor && translation?.status === 'translated' && showTranslation && (
          <div className="flex items-center justify-between border-[0.125rem] border-[#6D6D6E] bg-[#2A2B2D] px-[0.75rem] py-[0.4rem] flex-shrink-0 mb-[0.875rem]">
            <span className="font-minecraft text-[0.7rem] text-[#E6E8EB] flex items-center gap-1.5">
              <Languages size={12} className="text-[#B9FF8A]" />
              <span>{t('download.versionChangelog.translationActive', { defaultValue: 'TRANSLATION PREVIEW' })}</span>
            </span>

            <div className="flex items-center gap-1 bg-[#1E1E1F] border border-[#6D6D6E] p-0.5">
              <button
                type="button"
                onClick={() => setTranslationMode('translated_only')}
                className={`px-3 py-0.5 font-minecraft text-[0.6875rem] tracking-[0.04em] uppercase transition-colors cursor-pointer select-none outline-none ${
                  translationMode === 'translated_only'
                    ? 'bg-[#B9FF8A] text-[#1E1E1F] font-bold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {t('download.versionChangelog.modeTranslatedOnly', { defaultValue: 'Translation' })}
              </button>
              <button
                type="button"
                onClick={() => setTranslationMode('bilingual')}
                className={`px-3 py-0.5 font-minecraft text-[0.6875rem] tracking-[0.04em] uppercase transition-colors cursor-pointer select-none outline-none ${
                  translationMode === 'bilingual'
                    ? 'bg-[#B9FF8A] text-[#1E1E1F] font-bold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {t('download.versionChangelog.modeBilingual', { defaultValue: 'Bilingual' })}
              </button>
            </div>
          </div>
        )}

        {/* Description Text Area with OreOverlayScrollArea */}
        <div className="relative border-[0.125rem] border-[#6D6D6E] bg-[#1E1E1F] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.08)] flex-1 min-h-0 flex flex-col">
          
          {/* Translation Source Overlay Badge */}
          {isSponsor && showTranslation && translation?.status === 'translated' && (
            <div 
              className="absolute top-2.5 right-3 z-30 pointer-events-none select-none border border-[#B9FF8A]/35 bg-[#313233]/90 px-2 py-0.5 font-minecraft text-[0.625rem] uppercase tracking-[0.08em] text-[#B9FF8A] flex items-center gap-1.5 shadow-md"
              style={{ backdropFilter: 'blur(4px)' }}
            >
              <Languages size={10} className="text-[#B9FF8A]" />
              <span>{t('download.versionChangelog.machineTranslated', { defaultValue: 'Translated by TMT' })}</span>
            </div>
          )}

          <div 
            style={{ 
              height: scrollAreaHeight,
              transition: 'height 0.35s cubic-bezier(0.25, 1, 0.5, 1)' 
            }} 
            className="w-full relative min-h-0 flex flex-col overflow-hidden"
          >
            <OreOverlayScrollArea
              className="h-full w-full"
              viewportClassName="p-[0.875rem]"
              contentSafePaddingRight={18}
              onScroll={handleScroll}
              onClick={handleContentClick}
            >
              {renderDescriptionContent()}
            </OreOverlayScrollArea>
          </div>

          <style dangerouslySetInnerHTML={{ __html: `
            .markdown-content h1 { font-size: 1.5rem; font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: white; }
            .markdown-content h2 { font-size: 1.25rem; font-weight: bold; margin-top: 0.875rem; margin-bottom: 0.5rem; color: #6CC349; }
            .markdown-content h3 { font-size: 1.1rem; font-weight: bold; margin-top: 0.75rem; margin-bottom: 0.375rem; color: white; }
            .markdown-content p { margin-bottom: 0.625rem; line-height: 1.5; color: #E6E8EB; }
            .markdown-content ul { margin-left: 1.25rem; margin-bottom: 0.625rem; list-style-type: disc; }
            .markdown-content ol { margin-left: 1.25rem; margin-bottom: 0.625rem; list-style-type: decimal; }
            .markdown-content li { margin-bottom: 0.25rem; color: #E6E8EB; }
            .markdown-content a { color: #B9FF8A; text-decoration: underline; cursor: pointer; }
            .markdown-content a:hover { color: white; }
            .markdown-content code { background-color: #2b2b2d; padding: 0.125rem 0.25rem; border-radius: 2px; font-family: monospace; font-size: 0.875rem; color: #e6e8eb; }
            .markdown-content pre { background-color: #1a1a1c; padding: 0.75rem; border-radius: 4px; overflow-x: auto; margin-bottom: 0.75rem; border: 1px solid #2b2b2d; }
            .markdown-content pre code { background-color: transparent; padding: 0; }
            .markdown-content img { max-width: 100%; height: auto; border-radius: 2px; margin-bottom: 0.75rem; }
            .markdown-content blockquote { border-left: 4px solid #6cc349; padding-left: 0.75rem; color: #a0a0a0; margin-bottom: 0.75rem; }
            .markdown-content table { width: 100%; border-collapse: collapse; margin-bottom: 0.75rem; }
            .markdown-content th, .markdown-content td { border: 1px solid #2b2b2d; padding: 0.5rem; text-align: left; }
            .markdown-content th { background-color: #1a1a1c; font-weight: bold; }
          ` }} />
        </div>
      </div>
    </OreModal>
  );
};
