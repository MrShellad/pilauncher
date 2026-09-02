import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NewsCard } from '../features/home/components/NewsCard';
import { NewsFeaturedCard } from '../features/home/components/NewsFeaturedCard';
import { VersionChangelogView } from '../features/home/components/VersionChangelogView';
import { NEWS_PAGE_COPY, getNewsFocusKeySegment, getNewsLocale, normalizeMinecraftNewsItems } from '../features/home/data/newsItems';
import { useLauncherStore } from '../store/useLauncherStore';
import { useNewsStore } from '../store/useNewsStore';
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { focusManager } from '../ui/focus/FocusManager';
import { useInputAction } from '../ui/focus/InputDriver';
import { NewspaperIcon } from '../ui/icons/NewspaperIcon';
import { OreButton } from '../ui/primitives/OreButton';
import { OreOverlayScrollArea } from '../ui/primitives/OreOverlayScrollArea';
import { OreToggleButton } from '../ui/primitives/OreToggleButton';

const INITIAL_VISIBLE_COUNT = 7;
const LOAD_MORE_STEP = 6;

type NewsCategory = 'all' | 'release' | 'snapshot' | 'prerelease';

interface SelectedChangelogMeta {
  version: string;
  title: string;
  date?: string;
  tag?: string;
  wikiUrl?: string;
  coverImageUrl?: string;
}

const News: React.FC = () => {
  const { i18n } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const hasInitialFocusRef = useRef(false);
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const { rawItems, isLoading, isRefreshing, error, ensureSessionRefresh, refreshNews, markAllRead } = useNewsStore();

  const [activeCategory, setActiveCategory] = useState<NewsCategory>('all');
  const [selectedChangelog, setSelectedChangelog] = useState<SelectedChangelogMeta | null>(null);
  const locale = getNewsLocale(i18n.language);
  const pageCopy = NEWS_PAGE_COPY[locale];
  const items = useMemo(() => normalizeMinecraftNewsItems(rawItems, locale), [locale, rawItems]);

  const categories: { id: NewsCategory; label: string; count: number }[] = useMemo(() => {
    const releaseCount = items.filter(
      (item) => item.tag.includes('正式') || item.tag.toLowerCase().includes('release')
    ).length;
    const snapshotCount = items.filter(
      (item) => item.tag.includes('快照') || item.tag.toLowerCase().includes('snapshot')
    ).length;
    const prereleaseCount = items.filter(
      (item) =>
        item.tag.includes('预发布') ||
        item.tag.includes('候选') ||
        item.tag.includes('实验') ||
        item.tag.toLowerCase().includes('pre') ||
        item.tag.toLowerCase().includes('candidate') ||
        item.tag.toLowerCase().includes('experimental')
    ).length;

    return [
      { id: 'all', label: locale === 'zh' ? '全部资讯' : 'All Updates', count: items.length },
      { id: 'release', label: locale === 'zh' ? '正式版' : 'Releases', count: releaseCount },
      { id: 'snapshot', label: locale === 'zh' ? '快照版' : 'Snapshots', count: snapshotCount },
      { id: 'prerelease', label: locale === 'zh' ? '预发布/候选版' : 'Pre-Releases', count: prereleaseCount },
    ];
  }, [items, locale]);

  const filteredItems = useMemo(() => {
    if (activeCategory === 'all') return items;
    if (activeCategory === 'release') {
      return items.filter((item) => item.tag.includes('正式') || item.tag.toLowerCase().includes('release'));
    }
    if (activeCategory === 'snapshot') {
      return items.filter((item) => item.tag.includes('快照') || item.tag.toLowerCase().includes('snapshot'));
    }
    if (activeCategory === 'prerelease') {
      return items.filter(
        (item) =>
          item.tag.includes('预发布') ||
          item.tag.includes('候选') ||
          item.tag.includes('实验') ||
          item.tag.toLowerCase().includes('pre') ||
          item.tag.toLowerCase().includes('candidate') ||
          item.tag.toLowerCase().includes('experimental')
      );
    }
    return items;
  }, [items, activeCategory]);

  const [visibleCount, setVisibleCount] = useState(() => Math.min(INITIAL_VISIBLE_COUNT, filteredItems.length));

  useEffect(() => {
    void ensureSessionRefresh();
  }, [ensureSessionRefresh]);

  useInputAction('ACTION_X', () => {
    if (!isRefreshing) {
      void refreshNews({ background: rawItems.length > 0 });
    }
  });

  useInputAction('CANCEL', () => {
    setActiveTab('home');
  });

  useEffect(() => {
    if (hasInitialFocusRef.current || filteredItems.length === 0) return;

    let attempts = 0;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let isDisposed = false;
    const firstKey = `news-create-${getNewsFocusKeySegment(filteredItems[0].id)}`;

    const tryFocusEntry = () => {
      if (isDisposed) return;
      if (doesFocusableExist(firstKey)) {
        focusManager.focus(firstKey);
        hasInitialFocusRef.current = true;
        return;
      }

      attempts += 1;
      if (attempts < 12) {
        timerId = setTimeout(tryFocusEntry, 70);
      }
    };

    timerId = setTimeout(tryFocusEntry, 80);
    return () => {
      isDisposed = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [filteredItems]);

  useEffect(() => {
    if (items.length > 0) {
      markAllRead();
    }
  }, [items, markAllRead]);

  useEffect(() => {
    const initialCount = Math.min(INITIAL_VISIBLE_COUNT, filteredItems.length);
    setVisibleCount((prev) => {
      if (prev === 0) return initialCount;
      return Math.min(Math.max(prev, initialCount), filteredItems.length);
    });
  }, [filteredItems.length, activeCategory]);

  useEffect(() => {
    if (filteredItems.length <= INITIAL_VISIBLE_COUNT) return;
    if (visibleCount >= filteredItems.length) return;

    const root = scrollRef.current;
    const target = loadMoreRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;

        setVisibleCount((prev) => Math.min(prev + LOAD_MORE_STEP, filteredItems.length));
      },
      {
        root,
        rootMargin: '280px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredItems.length, visibleCount]);

  const visibleItems = filteredItems.slice(0, visibleCount);
  const featuredItem = visibleItems[0] || null;
  const gridItems = visibleItems.slice(1);
  const hasMore = visibleCount < filteredItems.length;
  const resolvedError = error ? `${pageCopy.error}: ${error}` : null;

  const handleNearEndFocus = (index: number) => {
    if (isLoading || isRefreshing) return;
    if (!hasMore) return;
    if (index < visibleItems.length - 2) return;

    setVisibleCount((prev) => Math.min(prev + LOAD_MORE_STEP, filteredItems.length));
  };

  // ✅ 二级页面模式：当选中某个版本时，直接展示沉浸式更新日志全景二级页面
  if (selectedChangelog) {
    return (
      <VersionChangelogView
        version={selectedChangelog.version}
        title={selectedChangelog.title}
        date={selectedChangelog.date}
        tag={selectedChangelog.tag}
        wikiUrl={selectedChangelog.wikiUrl}
        coverImageUrl={selectedChangelog.coverImageUrl}
        lang={locale}
        onBack={() => setSelectedChangelog(null)}
        onCreateInstance={() => {
          useLauncherStore.getState().setPendingNewsVersion(selectedChangelog.version);
          setActiveTab('new-instance');
        }}
      />
    );
  }

  return (
    <FocusBoundary
      id="news-page"
      trapFocus
      className="flex h-full w-full overflow-hidden font-minecraft select-none"
    >
      <OreOverlayScrollArea
        ref={scrollRef}
        className="h-full w-full"
        viewportClassName="px-5 py-6 sm:px-7 sm:py-8 lg:px-8 lg:py-8"
        contentSafePaddingRight={0}
      >
        <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-6">
          {/* ================= 1. 顶部 Header 栏 ================= */}
          <div className="flex flex-col gap-3.5 border-b border-white/10 pb-4">
            {/* 上层：页面标题与图标 */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#222324] text-[#6CC349] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
                <NewspaperIcon className="h-4.5 w-4.5 text-[#6CC349]" />
              </div>
              <h1 className="truncate text-xl sm:text-2xl font-bold tracking-wide text-white ore-text-shadow leading-none">
                {pageCopy.title}
              </h1>
            </div>

            {/* 下层：Tog 在左、Button 在右，同一行左右布局，严格统一等高中等尺寸 (md / h-10 / 40px) */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* 左侧：分类 Tog 切换器 (中等尺寸) */}
              <div className="flex items-center">
                <OreToggleButton
                  options={categories.map((cat) => ({
                    value: cat.id,
                    label: (
                      <span className="flex items-center gap-1.5 px-1 font-minecraft text-xs sm:text-sm font-bold">
                        <span>{cat.label}</span>
                        <span className="text-[11px] opacity-75">({cat.count})</span>
                      </span>
                    ),
                  }))}
                  value={activeCategory}
                  onChange={(val) => setActiveCategory(val as NewsCategory)}
                  size="md"
                  focusKeyPrefix="btn-news-cat"
                  className="w-auto"
                  buttonClassName="!px-4"
                />
              </div>

              {/* 右侧：操作按钮 (刷新 + 返回) (中等尺寸) */}
              <div className="flex items-center gap-2.5 self-start sm:self-auto">
                <OreButton
                  focusKey="btn-news-refresh"
                  variant="primary"
                  size="md"
                  className="!h-10 gap-2 !px-4 !text-white !m-0 font-bold text-xs sm:text-sm"
                  onClick={() => void refreshNews({ background: rawItems.length > 0 })}
                  autoScroll={false}
                >
                  <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                  <span>{pageCopy.refresh}</span>
                  <span className="ml-1 rounded bg-black/40 px-1.5 py-0.5 text-[0.65rem] text-white/70">X</span>
                </OreButton>

                <OreButton
                  focusKey="btn-news-back"
                  variant="secondary"
                  size="md"
                  className="!h-10 gap-2 !px-4 !m-0 font-bold text-xs sm:text-sm"
                  onClick={() => setActiveTab('home')}
                  autoScroll={false}
                >
                  <ArrowLeft size={15} />
                  <span>{pageCopy.back}</span>
                  <span className="ml-1 rounded bg-black/20 px-1.5 py-0.5 text-[0.65rem] text-ore-text-muted">B</span>
                </OreButton>
              </div>
            </div>
          </div>

          {/* ================= 2. 异常错误提示 ================= */}
          {resolvedError && (
            <div className="flex flex-col gap-3 border-[3px] border-[#5d2c2c] bg-[#2d1a1a]/90 px-5 py-4 text-sm text-[#ffd2d2] shadow-[8px_8px_0_rgba(0,0,0,0.18)] sm:flex-row sm:items-center sm:justify-between sm:gap-5">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#ff8a8a]" />
                <span className="leading-6">{resolvedError}</span>
              </div>
              <OreButton
                focusKey="btn-news-error-retry"
                variant="primary"
                size="auto"
                className="!h-9 !min-w-[6.25rem] self-start sm:self-auto !px-4 !text-white font-bold"
                onClick={() => void refreshNews({ background: rawItems.length > 0 })}
                autoScroll={false}
              >
                <span>{pageCopy.refresh || '重试'}</span>
              </OreButton>
            </div>
          )}

          {/* ================= 3. 骨架屏加载态 (Hero + 3 Grid 卡片骨架) ================= */}
          {isLoading && visibleItems.length === 0 && (
            <div className="flex flex-col gap-6">
              {/* Hero 骨架 */}
              <div
                className="flex min-h-[220px] flex-col md:flex-row overflow-hidden border-[3px] bg-[#313233] shadow-[8px_8px_0_rgba(0,0,0,0.24)]"
                style={{
                  borderTopColor: '#5A5B5C',
                  borderLeftColor: '#5A5B5C',
                  borderRightColor: '#1E1E1F',
                  borderBottomColor: '#1E1E1F',
                }}
              >
                <div className="h-56 md:h-auto md:w-1/2 lg:w-7/12 border-b-[3px] md:border-b-0 md:border-r-[3px] border-[#1E1E1F] bg-[#1E1E1F] animate-pulse" />
                <div className="flex flex-1 flex-col justify-between bg-[#2A2B2D] p-6 space-y-4">
                  <div className="space-y-3">
                    <div className="h-5 w-28 bg-white/10 rounded animate-pulse" />
                    <div className="h-8 w-3/4 bg-white/15 rounded animate-pulse" />
                    <div className="h-14 w-full bg-white/5 rounded animate-pulse" />
                  </div>
                  <div className="h-11 w-full bg-white/10 rounded animate-pulse" />
                </div>
              </div>

              {/* 网格骨架 */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex min-h-[22rem] flex-col overflow-hidden border-[3px] bg-[#313233] shadow-[8px_8px_0_rgba(0,0,0,0.24)]"
                    style={{
                      borderTopColor: '#5A5B5C',
                      borderLeftColor: '#5A5B5C',
                      borderRightColor: '#1E1E1F',
                      borderBottomColor: '#1E1E1F',
                    }}
                  >
                    <div className="h-[13rem] border-b-[3px] border-[#1E1E1F] bg-[#1E1E1F] animate-pulse" />
                    <div className="flex flex-1 flex-col justify-between p-4 bg-[#2A2B2D] gap-3">
                      <div className="h-10 bg-white/10 rounded animate-pulse" />
                      <div className="h-9 bg-white/15 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= 4. 空状态提示 ================= */}
          {!isLoading && visibleItems.length === 0 && (
            <div
              className="flex min-h-[16rem] items-center justify-center border-[3px] bg-[#313233] px-8 py-10 text-center shadow-[8px_8px_0_rgba(0,0,0,0.24)]"
              style={{
                borderTopColor: '#5A5B5C',
                borderLeftColor: '#5A5B5C',
                borderRightColor: '#1E1E1F',
                borderBottomColor: '#1E1E1F',
              }}
            >
              <p className="max-w-xl text-base leading-7 text-ore-text-muted">
                {pageCopy.empty}
              </p>
            </div>
          )}

          {/* ================= 5. 主内容流：Hero 头条大卡 + 次级资讯网格 ================= */}
          {visibleItems.length > 0 && (
            <>
              <div className="flex flex-col gap-6">
                {/* 5.1 首条 Hero 头条焦点大卡 */}
                {featuredItem && (
                  <NewsFeaturedCard
                    key={featuredItem.id}
                    date={featuredItem.date}
                    version={featuredItem.version}
                    tag={featuredItem.tag}
                    title={featuredItem.title}
                    summary={featuredItem.summary}
                    coverImageUrl={featuredItem.coverImageUrl}
                    officialUrl={featuredItem.officialUrl}
                    wikiUrl={featuredItem.wikiUrl}
                    officialLabel={pageCopy.official}
                    wikiLabel={pageCopy.wiki}
                    officialFocusKey={`news-official-${getNewsFocusKeySegment(featuredItem.id)}`}
                    wikiFocusKey={`news-wiki-${getNewsFocusKeySegment(featuredItem.id)}`}
                    createInstanceFocusKey={`news-create-${getNewsFocusKeySegment(featuredItem.id)}`}
                    onCreateInstance={() => {
                      useLauncherStore.getState().setPendingNewsVersion(featuredItem.version);
                      setActiveTab('new-instance');
                    }}
                    onActionFocus={() => handleNearEndFocus(0)}
                    onOpenChangelog={() =>
                      setSelectedChangelog({
                        version: featuredItem.version,
                        title: featuredItem.title,
                        date: featuredItem.date,
                        tag: featuredItem.tag,
                        wikiUrl: featuredItem.wikiUrl,
                        coverImageUrl: featuredItem.coverImageUrl,
                      })
                    }
                  />
                )}

                {/* 5.2 次级资讯 3 列响应式网格 */}
                {gridItems.length > 0 && (
                  <div
                    role="feed"
                    aria-label="历史版本与新闻资讯"
                    className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
                  >
                    {gridItems.map((item, index) => {
                      const focusSegment = getNewsFocusKeySegment(item.id);
                      const actualIndex = index + 1;

                      return (
                        <NewsCard
                          key={item.id}
                          date={item.date}
                          version={item.version}
                          tag={item.tag}
                          title={item.title}
                          summary={item.summary}
                          coverImageUrl={item.coverImageUrl}
                          officialUrl={item.officialUrl}
                          wikiUrl={item.wikiUrl}
                          officialLabel={pageCopy.official}
                          wikiLabel={pageCopy.wiki}
                          officialFocusKey={`news-official-${focusSegment}`}
                          wikiFocusKey={`news-wiki-${focusSegment}`}
                          createInstanceFocusKey={`news-create-${focusSegment}`}
                          displayIndex={actualIndex}
                          onCreateInstance={() => {
                            useLauncherStore.getState().setPendingNewsVersion(item.version);
                            setActiveTab('new-instance');
                          }}
                          onActionFocus={() => handleNearEndFocus(actualIndex)}
                          onOpenChangelog={() =>
                            setSelectedChangelog({
                              version: item.version,
                              title: item.title,
                              date: item.date,
                              tag: item.tag,
                              wikiUrl: item.wikiUrl,
                              coverImageUrl: item.coverImageUrl,
                            })
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 加载更多指示器 */}
              {hasMore && (
                <div
                  ref={loadMoreRef}
                  className="flex min-h-[4rem] items-center justify-center text-xs tracking-[0.28em] text-ore-text-muted"
                >
                  {isRefreshing ? pageCopy.refreshing : pageCopy.loadingMore}
                </div>
              )}
            </>
          )}
        </div>
      </OreOverlayScrollArea>
    </FocusBoundary>
  );
};

export default News;

