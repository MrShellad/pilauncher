import React, { useCallback, useRef } from 'react';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { OreProjectVersion } from '@/features/resource-catalog';
import { useEvent } from '../../../../hooks/useEvent';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { OreToggleButton } from '../../../../ui/primitives/OreToggleButton';
import { formatDate } from '../../../../utils/formatters';
import type {
  ChangelogTranslationState,
  TranslationMode,
} from '../../hooks/useVersionChangelogTranslation';
import { VersionChangelogBody } from './VersionChangelogBody';

interface VersionChangelogContentProps {
  isOpen: boolean;
  isSponsor: boolean;
  selectedChangelogText?: string | null;
  selectedIsShowingTranslation: boolean;
  selectedTranslation?: ChangelogTranslationState;
  translationMode: TranslationMode;
  version: OreProjectVersion;
  onTranslationModeChange: (mode: TranslationMode) => void;
}

export const VersionChangelogContent: React.FC<VersionChangelogContentProps> = ({
  isOpen,
  isSponsor,
  selectedChangelogText,
  selectedIsShowingTranslation,
  selectedTranslation,
  translationMode,
  version,
  onTranslationModeChange,
}) => {
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement>(null);

  useEvent('ore-controller-scroll', (payload) => {
    if (!isOpen || !viewportRef.current) return;
    viewportRef.current.scrollTop += payload.deltaY;
  });

  const handleScrollArrow = useCallback((direction: string) => {
    const viewport = viewportRef.current;
    if (!viewport) return true;

    const scrollAmount = 40;
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
      return true;
    }

    return true;
  }, []);

  return (
    <div className="flex flex-col gap-[0.875rem]">
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

      {isSponsor && selectedTranslation?.status === 'error' && (
        <div className="border-[0.125rem] border-red-500/70 bg-red-950/40 px-[0.875rem] py-[0.625rem] font-minecraft text-[0.75rem] leading-[1.5] text-red-100">
          {t('download.versionChangelog.translateFailed', {
            defaultValue: 'Translation failed: {{message}}',
            message: selectedTranslation.error,
          })}
        </div>
      )}

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
            onChange={(value) => onTranslationModeChange(value as TranslationMode)}
            size="sm"
            className="w-[15rem]"
            focusKeyPrefix="download-version-changelog-toggle"
          />
        </div>
      )}

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
              <VersionChangelogBody
                body={selectedChangelogText}
                isShowingTranslation={selectedIsShowingTranslation}
                noChangelogText={t('download.versionChangelog.noChangelog', {
                  defaultValue: 'No changelog available for this version.',
                })}
                originalBody={version.changelog || ''}
                translation={selectedTranslation}
                translationMode={translationMode}
              />
            </OreOverlayScrollArea>
          </div>
        )}
      </FocusItem>
    </div>
  );
};
