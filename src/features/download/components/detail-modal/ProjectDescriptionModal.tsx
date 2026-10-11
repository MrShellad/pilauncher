import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Languages, Loader2, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ModrinthProject, OreProjectDetail } from '@/features/resource-catalog';
import { useEvent } from '../../../../hooks/useEvent';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { OreToggleButton } from '../../../../ui/primitives/OreToggleButton';
import { openExternalLink } from '../../../../utils/openExternalLink';
import {
  useProjectDescriptionTranslation,
  type TranslationMode,
} from '../../hooks/useProjectDescriptionTranslation';
import { ProjectDescriptionContent } from './ProjectDescriptionContent';
import { ProjectDescriptionGallery } from './ProjectDescriptionGallery';

interface ProjectDescriptionModalProps {
  isOpen: boolean;
  project: ModrinthProject;
  details: OreProjectDetail | null;
  onClose: () => void;
}

export const ProjectDescriptionModal: React.FC<ProjectDescriptionModalProps> = ({
  isOpen,
  project,
  details,
  onClose,
}) => {
  const { t } = useTranslation();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isGalleryCollapsed, setIsGalleryCollapsed] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rawDescription = details?.body || details?.description || project.description || '';
  const galleryUrls = details?.gallery_urls ?? project.gallery_urls ?? [];
  const hasGallery = galleryUrls.length > 0;
  const {
    isSponsor,
    translation,
    showTranslation,
    translationMode,
    setTranslationMode,
    handleTranslateDescription,
  } = useProjectDescriptionTranslation({
    isOpen,
    projectId: project.id,
    rawDescription,
  });

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
    }

    if (direction === 'down') {
      const maxScroll = viewport.scrollHeight - viewport.clientHeight;
      if (viewport.scrollTop < maxScroll - 1) {
        viewport.scrollTop = Math.min(maxScroll, viewport.scrollTop + scrollAmount);
        return false;
      }
    }
    return true;
  }, []);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveImageIndex(0);
      setIsGalleryCollapsed(false);
    }
  }, [isOpen, project.id]);

  useEffect(() => {
    if (isGalleryCollapsed) {
      const current = getCurrentFocusKey();
      if (current?.startsWith('desc-gallery-')) {
        setFocus('desc-modal-scrollarea');
      }
    }
  }, [isGalleryCollapsed]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
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

  const nextImage = () => {
    if (galleryUrls.length === 0) return;
    setActiveImageIndex((previous) => (previous + 1) % galleryUrls.length);
  };

  const previousImage = () => {
    if (galleryUrls.length === 0) return;
    setActiveImageIndex((previous) => (previous - 1 + galleryUrls.length) % galleryUrls.length);
  };

  const translateLabel = showTranslation
    ? t('download.versionChangelog.showOriginal', { defaultValue: 'Show Original' })
    : translation?.status === 'translated'
      ? t('download.versionChangelog.showTranslation', { defaultValue: 'Show Translation' })
      : t('download.versionChangelog.translate', { defaultValue: 'Translate' });
  const defaultFocusKey = hasGallery ? 'desc-gallery-btn-prev' : 'desc-modal-btn-close';
  const translatedBody = isSponsor && showTranslation && translation?.status === 'translated'
    ? translation.text
    : undefined;

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
      actions={(
        <div className="flex w-full flex-wrap items-center justify-center gap-[0.75rem]">
          {rawDescription.trim() && isSponsor && (
            <OreButton
              focusKey="desc-modal-btn-translate"
              variant="secondary"
              size="md"
              className="flex-1 max-w-[16rem] gap-[0.5rem] !m-0"
              disabled={translation?.status === 'loading'}
              onClick={() => void handleTranslateDescription()}
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
      )}
    >
      <div className="flex flex-col flex-1 min-h-0 h-full w-full gap-2.5 overflow-hidden">
        {hasGallery && (
          <ProjectDescriptionGallery
            galleryUrls={galleryUrls}
            activeImageIndex={activeImageIndex}
            isCollapsed={isGalleryCollapsed}
            onPrevious={previousImage}
            onNext={nextImage}
            onSelect={setActiveImageIndex}
          />
        )}

        {isSponsor && translation?.status === 'error' && (
          <div className="border-[2px] border-red-500/80 bg-red-950/60 px-3.5 py-2 font-minecraft text-xs leading-relaxed text-red-100 mb-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            {t('download.versionChangelog.translateFailed', {
              defaultValue: 'Translation failed: {{message}}',
              message: translation.error,
            })}
          </div>
        )}

        {isSponsor && translation?.status === 'translated' && showTranslation && (
          <div className="flex items-center justify-between border-[2px] border-[var(--ore-border-color)] bg-[var(--ore-downloadDetail-surface)] px-3 py-1.5 flex-shrink-0 gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <span className="font-minecraft text-xs text-white flex items-center gap-1.5 shrink-0">
              <Languages size={14} className="text-[#B9FF8A]" />
              <span className="ore-text-shadow tracking-wider uppercase">
                {t('download.versionChangelog.translationActive', { defaultValue: 'TRANSLATION PREVIEW' })}
              </span>
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
              onChange={(value) => setTranslationMode(value as TranslationMode)}
              size="sm"
              className="w-[15rem]"
              focusKeyPrefix="desc-modal-toggle"
            />
          </div>
        )}

        <FocusItem focusKey="desc-modal-scrollarea" onArrowPress={handleScrollArrow}>
          {({ ref: focusRef, focused }) => (
            <div
              ref={focusRef as React.RefObject<HTMLDivElement>}
              className={`relative border-[2px] bg-[var(--ore-downloadDetail-base)] shadow-[inset_0_3px_6px_rgba(0,0,0,0.45),inset_0_-1px_0_rgba(255,255,255,0.06)] flex-1 min-h-0 w-full overflow-hidden transition-all ${
                focused
                  ? 'border-white outline outline-[2px] outline-[var(--ore-focus-ringFallback)] outline-offset-[-2px] z-10'
                  : 'border-[var(--ore-border-color)]'
              }`}
            >
              {translatedBody && (
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
                <ProjectDescriptionContent
                  originalBody={rawDescription}
                  translatedBody={translatedBody}
                  bilingual={translationMode === 'bilingual'}
                  emptyDescription={t('download.empty.noDescription', {
                    defaultValue: 'No description provided yet.',
                  })}
                />
              </OreOverlayScrollArea>
            </div>
          )}
        </FocusItem>
      </div>
    </OreModal>
  );
};
