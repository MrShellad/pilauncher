// src/features/Download/components/ResourceGrid.tsx
import React, { useEffect, useRef } from 'react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Blocks, CheckCircle2, Clock3, Download, Heart, Monitor, Tags, Loader2 } from 'lucide-react';

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { ControlHint } from '../../../ui/components/ControlHint';
import type { ModMeta } from '../../InstanceDetail/logic/modService';
import type { ModrinthProject } from '../../InstanceDetail/logic/modrinthApi';

interface ResourceGridProps {
  results: ModrinthProject[];
  installedMods: ModMeta[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onSelectProject: (project: ModrinthProject) => void;
}

interface ResourceCardProps {
  project: ModrinthProject;
  index: number;
  isInstalled: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onSelectProject: (project: ModrinthProject) => void;
  isNearBottom: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

const KNOWN_LOADERS = ['fabric', 'forge', 'neoforge', 'quilt', 'liteloader'];

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' ');

const formatNumber = (value?: number) => {
  if (!value) return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
};

const timeAgo = (dateStr?: string) => {
  if (!dateStr) return '未知时间';

  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));

  if (days === 0) return '今天更新';
  if (days < 30) return `${days} 天前`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前`;

  return `${Math.floor(months / 12)} 年前`;
};

const centerFocusedCard = (element: HTMLElement | null, scrollHost: HTMLDivElement | null) => {
  if (!element || !scrollHost) return;

  const hostRect = scrollHost.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const elementCenter = elementRect.top + elementRect.height / 2;
  const hostCenter = hostRect.top + hostRect.height / 2;
  const nextScrollTop = scrollHost.scrollTop + (elementCenter - hostCenter);
  const maxScrollTop = Math.max(0, scrollHost.scrollHeight - scrollHost.clientHeight);
  const clampedScrollTop = Math.min(Math.max(0, nextScrollTop), maxScrollTop);

  if (Math.abs(clampedScrollTop - scrollHost.scrollTop) < 8) return;

  scrollHost.scrollTo({
    top: clampedScrollTop,
    behavior: 'smooth'
  });
};

const filterFallbackTargets = [
  'filter-mc-version',
  'filter-loader',
  'filter-category',
  'filter-sort'
] as const;

const ResourceCard = React.memo(({
  project,
  index,
  isInstalled,
  hasMore,
  onLoadMore,
  onSelectProject,
  isNearBottom,
  scrollContainerRef
}: ResourceCardProps) => {
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const rawProject = project as ModrinthProject & { display_categories?: string[]; followers?: number };
  const categories = rawProject.categories || rawProject.display_categories || [];
  const loaders = categories.filter((category) => KNOWN_LOADERS.includes(category.toLowerCase())).slice(0, 2);
  const features = categories.filter((category) => !KNOWN_LOADERS.includes(category.toLowerCase())).slice(0, 3);
  const followerCount = rawProject.followers || rawProject.follows || 0;
  const supportsClient = project.client_side !== 'unsupported' && !!project.client_side;
  const focusKey = `download-grid-item-${index}`;

  return (
    <FocusItem
      focusKey={focusKey}
      autoScroll={false}
      onEnter={() => onSelectProject(project)}
      onArrowPress={(direction) => {
        if (direction !== 'up') return true;
        if (index > 3) return true;

        const preferredTarget = filterFallbackTargets[Math.min(index, filterFallbackTargets.length - 1)];
        const target = [
          preferredTarget,
          'download-btn-search',
          'download-search-input',
          'filter-source-toggle'
        ].find((key) => doesFocusableExist(key));
        if (target) setFocus(target);
        return false;
      }}
      onFocus={() => {
        centerFocusedCard(cardRef.current, scrollContainerRef.current);
        if (isNearBottom && hasMore) onLoadMore();
      }}
    >
      {({ ref, focused }) => {
        const focusRef = ref as React.MutableRefObject<HTMLButtonElement | null>;
        const setCardNode = (node: HTMLButtonElement | null) => {
          cardRef.current = node;
          focusRef.current = node;
        };

        return (
          <button
            ref={setCardNode}
            type="button"
            onClick={() => onSelectProject(project)}
            tabIndex={-1}
            aria-label={`查看 ${project.title}`}
            className={`
              group relative flex min-h-[160px] w-full overflow-hidden border-[2px] border-[#1E1E1F] text-left outline-none transition-none
              ${focused
                ? 'z-20 bg-[#E6E8EB] brightness-[1.02] outline outline-2 outline-offset-[3px] outline-white drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]'
                : 'bg-[#D0D1D4] hover:bg-[#E6E8EB]'}
            `}
            style={{
              contain: 'layout paint',
              boxShadow: isInstalled
                ? 'inset 0 -4px #1D4D13, inset 2px 2px rgba(255,255,255,0.7), inset -2px -6px rgba(255,255,255,0.3)'
                : 'inset 0 -4px #58585A, inset 2px 2px rgba(255,255,255,0.7), inset -2px -6px rgba(255,255,255,0.38)'
            }}
          >
            <div className={`absolute inset-y-0 left-0 w-1.5 ${isInstalled ? 'bg-[#6CC349]' : 'bg-[#48494A]'}`} />
            <div className="absolute inset-x-0 top-0 h-[4px] bg-white/25" />

            {isInstalled && (
              <div className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 border-[2px] border-[#1E1E1F] bg-[#6CC349] px-1.5 py-0.5 text-[9px] font-minecraft uppercase tracking-[0.16em] text-black shadow-[inset_0_-2px_0_#3C8527]">
                <CheckCircle2 size={10} />
                已安装
              </div>
            )}

            <div className="flex w-full gap-3 p-3 pr-4">
              
              {/* 左侧：Logo 与作者区 */}
              <div className="flex w-20 shrink-0 flex-col gap-1.5">
                <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden border-[2px] border-[#1E1E1F] bg-[#48494A] shadow-[inset_0_-4px_0_#313233,inset_2px_2px_0_rgba(255,255,255,0.15)]">
                  {project.icon_url ? (
                    <img src={project.icon_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <Blocks className="h-10 w-10 text-white/75" />
                  )}
                </div>

                <div className="border-[2px] border-[#1E1E1F] bg-[#48494A] px-1 py-1 text-center shadow-[inset_0_2px_0_rgba(255,255,255,0.08)]">
                  <div className="font-minecraft text-[9px] uppercase tracking-[0.18em] text-[#B1B2B5]">Author</div>
                  <div className="truncate pt-0.5 text-[11px] font-bold text-white">{project.author || 'Unknown'}</div>
                </div>
              </div>

              {/* 右侧：描述区 */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="pr-16">
                  {/* 标题 */}
                  <div className="font-minecraft text-lg font-bold leading-tight text-black truncate">{project.title}</div>
                  
                  {/* 描述限定 2 行 */}
                  <p className="mt-1.5 line-clamp-2 text-xs leading-[18px] text-[#313233]">
                    {project.description?.trim() || '该资源暂无简介，进入详情页后可查看详细信息。'}
                  </p>
                </div>

                {/* ✅ 标签区：增加 mb-2.5 和 shrink-0，严防与底部模块挤压重合 */}
                <div className="mt-2 mb-2.5 flex flex-wrap gap-1.5 h-[22px] overflow-hidden shrink-0">
                  {supportsClient && (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap border-[2px] border-[#1E1E1F] bg-[#313233] px-1.5 py-0.5 text-[9px] font-minecraft uppercase tracking-[0.14em] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.12)]">
                      <Monitor size={10} />
                      客户端
                    </span>
                  )}

                  {loaders.map((loader) => (
                    <span
                      key={loader}
                      className="inline-flex items-center gap-1 whitespace-nowrap border-[2px] border-[#1E1E1F] bg-[#FFE866] px-1.5 py-0.5 text-[9px] font-minecraft uppercase tracking-[0.14em] text-black shadow-[inset_0_-2px_0_#C9B12D]"
                    >
                      {capitalize(loader)}
                    </span>
                  ))}

                  {features.map((feature) => (
                    <span
                      key={feature}
                      className="inline-flex items-center gap-1 whitespace-nowrap border-[2px] border-[#1E1E1F] bg-[#8CB3FF] px-1.5 py-0.5 text-[9px] font-minecraft uppercase tracking-[0.14em] text-black shadow-[inset_0_-2px_0_#5C82CA]"
                    >
                      <Tags size={9} />
                      {capitalize(feature)}
                    </span>
                  ))}
                </div>

                {/* ✅ 底部：数据区字号和图标增大，间距调优，并增加 shrink-0 防挤压 */}
                <div className="mt-auto shrink-0 flex items-center justify-between gap-2 border-[2px] border-[#1E1E1F] bg-[#48494A] px-2.5 py-1.5 shadow-[inset_0_2px_0_rgba(255,255,255,0.08)]">
                  <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs font-minecraft uppercase tracking-[0.08em] text-[#E6E8EB]">
                    <span className="inline-flex items-center gap-1.5">
                      <Download size={12} />
                      {formatNumber(project.downloads)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Heart size={12} />
                      {formatNumber(followerCount)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[#FFE866]">
                      <Clock3 size={12} />
                      {timeAgo(project.date_modified)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <ControlHint label="A" variant="face" tone="green" />
                    <span className="font-minecraft text-[10px] uppercase tracking-[0.16em] text-[#E6E8EB]">详情</span>
                  </div>
                </div>
              </div>
            </div>
          </button>
        );
      }}
    </FocusItem>
  );
});

ResourceCard.displayName = 'ResourceCard';

export const ResourceGrid: React.FC<ResourceGridProps> = ({
  results,
  installedMods,
  isLoading,
  hasMore,
  onLoadMore,
  onSelectProject
}) => {
  const observerTarget = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollHost = scrollContainerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { root: scrollHost, threshold: 0.1 }
    );

    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [onLoadMore]);

  const checkIsInstalled = (project: ModrinthProject) => (
    installedMods.some((mod) =>
      mod.modId === project.id || (mod.fileName || '').toLowerCase().includes((project.slug || '').toLowerCase())
    )
  );

  return (
    <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
      <FocusBoundary
        id="download-results-grid"
        defaultFocusKey="download-grid-item-0"
        className="min-h-full"
      >
        <div className="min-h-full px-4 pb-5 pt-4">
          {isLoading ? (
            <div className="flex h-full min-h-[360px] items-center justify-center">
              <Loader2 size={44} className="animate-spin text-ore-green" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 pb-6 lg:grid-cols-2 2xl:grid-cols-3">
              {results.map((project, index) => (
                <ResourceCard
                  key={`${project.id}-${index}`}
                  project={project}
                  index={index}
                  isInstalled={checkIsInstalled(project)}
                  hasMore={hasMore}
                  onLoadMore={onLoadMore}
                  onSelectProject={onSelectProject}
                  isNearBottom={index >= results.length - 6}
                  scrollContainerRef={scrollContainerRef}
                />
              ))}

              {results.length > 0 && hasMore && (
                <div ref={observerTarget} className="col-span-full flex h-16 items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-ore-green opacity-60" />
                </div>
              )}
            </div>
          )}
        </div>
      </FocusBoundary>
    </div>
  );
};
