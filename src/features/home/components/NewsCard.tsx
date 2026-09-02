import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
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
  onClose?: () => void;
  onOpenChangelog?: () => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  date,
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
  onClose,
  onOpenChangelog,
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
      className="group flex min-h-[22rem] flex-col overflow-hidden border-[3px] bg-[#313233] shadow-[8px_8px_0_rgba(0,0,0,0.24)] select-none font-minecraft"
      style={{
        '--home-news-action-h': '2.4rem',
        '--home-news-action-font': '0.8125rem',
        '--home-news-action-icon': '1rem',
        borderTopColor: '#5A5B5C',
        borderLeftColor: '#5A5B5C',
        borderRightColor: '#1E1E1F',
        borderBottomColor: '#1E1E1F',
      } as React.CSSProperties}
    >
      <div className="relative h-[13rem] sm:h-[14rem] overflow-hidden border-b-[3px] border-[#1E1E1F] bg-[#1E1E1F]">
        <div
          className="absolute inset-0 transition-all duration-500 ease-out group-hover:scale-[1.05] group-hover:translate-y-[-2px] group-focus-within:scale-[1.05] group-focus-within:translate-y-[-2px]"
          style={{
            backgroundColor: '#1E1E1F',
            backgroundImage: coverImageUrl
              ? `url("${coverImageUrl}")`
              : 'linear-gradient(135deg, #1E1E1F 0%, #2A2B2D 50%, #5B8731 100%)',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
            filter: 'brightness(1.08) contrast(1.03)',
            willChange: 'transform',
            transform: 'translateZ(0)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              'radial-gradient(circle at top right, rgba(255,255,255,0.18) 0%, transparent 50%)',
              'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 35%)',
            ].join(', '),
            transform: 'translateZ(0)',
          }}
        />

        <div className="absolute left-3.5 top-3.5 border border-white/20 bg-black/60 px-2.5 py-1 text-xs font-minecraft tracking-[0.15em] text-white flex items-center gap-1.5 backdrop-blur-[2px]">
          <span>{date}</span>
          <span className="text-white/40 font-bold">·</span>
          <span className="text-[#9be7b0] font-bold">{tag}</span>
        </div>

        {onClose && (
          <button
            type="button"
            className="absolute right-3.5 top-3.5 z-50 flex items-center justify-center w-7 h-7 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 border border-white/20 rounded-none transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-3 pt-6">
          <h3
            className="font-minecraft text-lg sm:text-xl font-bold leading-tight text-white ore-text-shadow line-clamp-2"
          >
            {title}
          </h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-3 bg-[#2A2B2D] p-4 sm:p-4.5">
        <p className="font-minecraft text-xs leading-5 text-ore-text-muted line-clamp-2">
          {summary}
        </p>

        <div className="mt-auto flex flex-col gap-2 pt-1">
          {onCreateInstance && (
            <OreButton
              focusKey={createInstanceFocusKey}
              variant="primary"
              size="auto"
              className="w-full !m-0 !h-[var(--home-news-action-h)] gap-1.5 !text-[length:var(--home-news-action-font)] !text-white [&_svg]:!text-white font-bold shadow-md"
              onClick={onCreateInstance}
              onFocus={onActionFocus}
              autoScroll
            >
              <Plus size={14} className="shrink-0" />
              <span className="truncate whitespace-nowrap">{resolvedCreateInstanceLabel}</span>
            </OreButton>
          )}

          <div className="flex gap-2">
            <OreButton
              focusKey={officialFocusKey}
              variant="secondary"
              size="auto"
              className="flex-1 !min-w-0 !m-0 !h-[var(--home-news-action-h)] gap-1 !text-[length:var(--home-news-action-font)] !text-[#111214] [&_svg]:!text-[#111214] font-bold text-xs"
              onClick={() => void openExternalLink(officialUrl)}
              onFocus={onActionFocus}
              autoScroll
            >
              <ExternalLink size={13} />
              <span className="truncate whitespace-nowrap">{officialLabel}</span>
            </OreButton>

            <OreButton
              focusKey={wikiFocusKey}
              variant="secondary"
              size="auto"
              className="flex-1 !min-w-0 !m-0 !h-[var(--home-news-action-h)] gap-1 !text-[length:var(--home-news-action-font)] !text-[#111214] [&_svg]:!text-[#111214] font-bold text-xs"
              onClick={() => {
                if (onOpenChangelog) {
                  onOpenChangelog();
                } else {
                  void openExternalLink(wikiUrl);
                }
              }}
              onFocus={onActionFocus}
              autoScroll
            >
              <BookOpen size={13} />
              <span className="truncate whitespace-nowrap">{wikiLabel}</span>
            </OreButton>
          </div>
        </div>
      </div>
    </motion.article>
  );
};
