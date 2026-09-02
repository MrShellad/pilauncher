import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { BookOpen, ExternalLink, Plus, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OreButton } from '../../../ui/primitives/OreButton';
import { openExternalLink } from '../../../utils/openExternalLink';

interface NewsFeaturedCardProps {
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
  createInstanceFocusKey: string;
  onCreateInstance?: () => void;
  createInstanceLabel?: string;
  onActionFocus?: () => void;
  onOpenChangelog?: () => void;
}

export const NewsFeaturedCard: React.FC<NewsFeaturedCardProps> = ({
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
  createInstanceFocusKey,
  onCreateInstance,
  createInstanceLabel,
  onActionFocus,
  onOpenChangelog,
}) => {
  const { t } = useTranslation();
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
  }, []);

  const resolvedCreateInstanceLabel =
    createInstanceLabel || t('home.createInstance', { defaultValue: '立即创建对应实例' });

  return (
    <motion.article
      initial={isMountedRef.current ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="group relative flex w-full flex-col overflow-hidden border-[3px] bg-[#313233] shadow-[8px_8px_0_rgba(0,0,0,0.24)] md:flex-row font-minecraft select-none"
      style={{
        borderTopColor: '#5A5B5C',
        borderLeftColor: '#5A5B5C',
        borderRightColor: '#1E1E1F',
        borderBottomColor: '#1E1E1F',
      }}
    >
      {/* ================= 左侧：大画幅宽屏封面展示区 ================= */}
      <div className="relative h-56 sm:h-64 md:h-auto md:w-1/2 lg:w-7/12 min-h-[220px] overflow-hidden border-b-[3px] border-[#1E1E1F] bg-[#1E1E1F] md:border-b-0 md:border-r-[3px]">
        <div
          className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-105 group-focus-within:scale-105"
          style={{
            backgroundColor: '#1E1E1F',
            backgroundImage: coverImageUrl
              ? `url("${coverImageUrl}")`
              : 'linear-gradient(135deg, #1E1E1F 0%, #2A2B2D 50%, #5B8731 100%)',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
            filter: 'brightness(1.08) contrast(1.03)',
            transform: 'translateZ(0)',
          }}
        />

        {/* 光影遮罩 (轻量明亮) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              'radial-gradient(circle at top right, rgba(255,255,255,0.2) 0%, transparent 60%)',
              'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 35%)',
            ].join(', '),
          }}
        />

        {/* 顶部标签栏 */}
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <div className="flex items-center gap-1.5 border border-white/20 bg-black/60 px-3 py-1 text-xs font-minecraft tracking-[0.15em] text-white backdrop-blur-[2px]">
            <Sparkles size={13} className="text-[#FFE866]" />
            <span className="font-bold text-[#FFE866]">最新焦点</span>
            <span className="text-white/40">·</span>
            <span className="text-white">{date}</span>
          </div>

          <div className="border border-white/20 bg-[#3C8527] px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            {tag}
          </div>
        </div>

        {/* 移动端/小屏封面底部标题预览 */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 md:hidden">
          <h2 className="text-xl sm:text-2xl font-bold leading-tight text-white ore-text-shadow">
            {title}
          </h2>
        </div>
      </div>

      {/* ================= 右侧：标题、详细说明与操作按钮区 ================= */}
      <div className="flex flex-1 flex-col justify-between bg-[#2A2B2D] p-5 sm:p-6 lg:p-7 space-y-4">
        <div className="space-y-3">
          {/* 版本角标 */}
          <div className="hidden md:flex items-center gap-2">
            <span className="border border-white/10 bg-black/30 px-2.5 py-0.5 text-xs text-[#6CC349] font-bold tracking-wider">
              {version}
            </span>
            <span className="text-xs text-[#8C8D90] tracking-wider">{date}</span>
          </div>

          {/* 大标题 */}
          <h2 className="hidden md:block font-minecraft text-2xl lg:text-3xl font-bold leading-snug text-white ore-text-shadow">
            {title}
          </h2>

          {/* 摘要与改动概述 */}
          <p className="font-minecraft text-xs sm:text-sm leading-relaxed text-[#D0D1D4] line-clamp-4">
            {summary}
          </p>
        </div>

        {/* 底部操作区 */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {onCreateInstance && (
            <OreButton
              focusKey={createInstanceFocusKey}
              variant="primary"
              size="md"
              className="flex-1 !h-11 !text-white font-minecraft text-sm font-bold shadow-md gap-2"
              onClick={onCreateInstance}
              onFocus={onActionFocus}
              autoScroll
            >
              <Plus size={16} className="shrink-0" />
              <span className="truncate">{resolvedCreateInstanceLabel}</span>
            </OreButton>
          )}

          <div className="flex items-center gap-2.5">
            <OreButton
              focusKey={officialFocusKey}
              variant="secondary"
              size="md"
              className="flex-1 sm:flex-initial !h-11 !px-4 text-xs font-bold gap-1.5"
              onClick={() => void openExternalLink(officialUrl)}
              onFocus={onActionFocus}
              autoScroll
            >
              <ExternalLink size={14} className="shrink-0" />
              <span>{officialLabel}</span>
            </OreButton>

            <OreButton
              focusKey={wikiFocusKey}
              variant="secondary"
              size="md"
              className="flex-1 sm:flex-initial !h-11 !px-4 text-xs font-bold gap-1.5"
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
              <BookOpen size={14} className="shrink-0" />
              <span>{wikiLabel}</span>
            </OreButton>
          </div>
        </div>
      </div>
    </motion.article>
  );
};

export default NewsFeaturedCard;
