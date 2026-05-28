import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, ExternalLink, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OreButton } from '../../../ui/primitives/OreButton';
import { openExternalLink } from '../../../utils/openExternalLink';

interface NewsCardProps {
  date: string;
  version: string;
  tag: string;
  title: string;
  summary: string;
  coverImageUrl: string;
  officialUrl: string;
  wikiUrl: string;
  officialLabel: string;
  wikiLabel: string;
  officialFocusKey: string;
  wikiFocusKey: string;
  displayIndex: number;
  onCreateInstance?: () => void;
  createInstanceLabel?: string;
  createInstanceFocusKey?: string;
  onActionFocus?: () => void;
  onCreateInstanceArrowPress?: (direction: string) => boolean | void;
  onOfficialArrowPress?: (direction: string) => boolean | void;
  onWikiArrowPress?: (direction: string) => boolean | void;
  onClose?: () => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  date,
  version,
  tag,
  title,
  summary,
  coverImageUrl,
  officialUrl,
  wikiUrl,
  officialLabel,
  wikiLabel,
  officialFocusKey,
  wikiFocusKey,
  displayIndex,
  onCreateInstance,
  createInstanceLabel,
  createInstanceFocusKey,
  onActionFocus,
  onCreateInstanceArrowPress,
  onOfficialArrowPress,
  onWikiArrowPress,
  onClose,
}) => {
  const { t } = useTranslation();
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
  }, []);

  const resolvedCreateInstanceLabel = createInstanceLabel || t('home.createInstance', { defaultValue: '创建对应实例' });

  return (
    <motion.article
      initial={isMountedRef.current ? false : { opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.28,
        ease: 'easeOut',
        delay: Math.min(displayIndex, 5) * 0.05,
      }}
      className="group flex min-h-[26rem] flex-col overflow-hidden border-[3px] bg-[#313233] shadow-[8px_8px_0_rgba(0,0,0,0.24)]"
      style={{
        '--home-news-action-h': '2.75rem',
        '--home-news-action-font': 'clamp(0.875rem, 1.05vw, 1.375rem)',
        '--home-news-action-icon': 'clamp(1rem, 1.25vw, 1.75rem)',
        borderTopColor: '#5A5B5C',
        borderLeftColor: '#5A5B5C',
        borderRightColor: '#1E1E1F',
        borderBottomColor: '#1E1E1F',
      } as React.CSSProperties}
    >
      <div className="relative h-[15.5rem] overflow-hidden border-b-[3px] border-[#1E1E1F] bg-[#1E1E1F] lg:h-[16rem]">
        <div
          className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.06]"
          style={{
            backgroundColor: '#1E1E1F',
            backgroundImage: coverImageUrl
              ? `url("${coverImageUrl}")`
              : 'linear-gradient(135deg, #1E1E1F 0%, #2A2B2D 50%, #5B8731 100%)',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
            willChange: 'transform',
            transform: 'translateZ(0)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              'radial-gradient(circle at top right, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 18%, transparent 42%)',
              'linear-gradient(to top, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.24) 34%, rgba(0,0,0,0.08) 60%, rgba(0,0,0,0.02) 100%)',
            ].join(', '),
            transform: 'translateZ(0)',
          }}
        />

        <div className="absolute left-4 top-4 border border-white/20 bg-black/55 px-3 py-1 text-xs font-minecraft tracking-[0.2em] text-white">
          {date}
        </div>
        <div className={`absolute ${onClose ? 'right-14' : 'right-4'} top-4 border border-[#6fd08c]/40 bg-[#1f3a28]/85 px-3 py-1 text-xs font-minecraft tracking-[0.2em] text-[#9be7b0] transition-all`}>
          {tag}
        </div>

        {onClose && (
          <button
            type="button"
            className="absolute right-4 top-4 z-50 flex items-center justify-center w-8 h-8 text-white/70 hover:text-white bg-black/45 hover:bg-black/70 border border-white/10 hover:border-white/30 rounded transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        )}

        <div className="absolute bottom-4 left-4 right-4">
          <div className="mb-2 text-[0.72rem] font-minecraft tracking-[0.3em] text-white/70">
            {version}
          </div>
          <h3
            className="font-minecraft text-[1.55rem] leading-tight text-white ore-text-shadow"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {title}
          </h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 bg-[#2a2b2d] p-5">
        <p className="min-h-[4.75rem] font-minecraft text-sm leading-6 text-ore-text-muted">
          {summary}
        </p>

        <div className="mt-auto flex flex-col gap-3">
          {onCreateInstance && (
            <OreButton
              focusKey={createInstanceFocusKey}
              variant="primary"
              size="auto"
              className="w-full !h-[var(--home-news-action-h)] gap-[clamp(0.5rem,0.75vw,1rem)] !text-[length:var(--home-news-action-font)] !text-white [&_svg]:!text-white ore-text-shadow"
              onClick={onCreateInstance}
              onFocus={onActionFocus}
              onArrowPress={onCreateInstanceArrowPress}
              autoScroll
            >
              <Plus size="var(--home-news-action-icon)" />
              <span>{resolvedCreateInstanceLabel}</span>
            </OreButton>
          )}
          <div className="flex gap-3">
            <OreButton
              focusKey={officialFocusKey}
              variant="secondary"
              size="auto"
              className="flex-1 !min-w-0 !h-[var(--home-news-action-h)] gap-[clamp(0.5rem,0.75vw,1rem)] !text-[length:var(--home-news-action-font)] !text-[#111214] [&_svg]:!text-[#111214]"
              onClick={() => void openExternalLink(officialUrl)}
              onFocus={onActionFocus}
              onArrowPress={onOfficialArrowPress}
              autoScroll
            >
              <ExternalLink size="var(--home-news-action-icon)" />
              <span>{officialLabel}</span>
            </OreButton>

            <OreButton
              focusKey={wikiFocusKey}
              variant="secondary"
              size="auto"
              className="flex-1 !min-w-0 !h-[var(--home-news-action-h)] gap-[clamp(0.5rem,0.75vw,1rem)] !text-[length:var(--home-news-action-font)] !text-[#111214] [&_svg]:!text-[#111214]"
              onClick={() => void openExternalLink(wikiUrl)}
              onFocus={onActionFocus}
              onArrowPress={onWikiArrowPress}
              autoScroll
            >
              <BookOpen size="var(--home-news-action-icon)" />
              <span>{wikiLabel}</span>
            </OreButton>
          </div>
        </div>
      </div>
    </motion.article>
  );
};
