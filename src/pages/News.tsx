import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NewsCard } from '../features/home/components/NewsCard';
import { NEWS_PAGE_COPY, getNewsFocusKeySegment, getNewsLocale, normalizeMinecraftNewsItems } from '../features/home/data/newsItems';
import { useLauncherStore } from '../store/useLauncherStore';
import { useNewsStore } from '../store/useNewsStore';
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { focusManager } from '../ui/focus/FocusManager';
import { useInputAction } from '../ui/focus/InputDriver';
import { NewspaperIcon } from '../ui/icons/NewspaperIcon';
import { OreButton } from '../ui/primitives/OreButton';

const INITIAL_VISIBLE_COUNT = 6;
const LOAD_MORE_STEP = 4;

const News: React.FC = () => {
  const { i18n } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const pendingFocusKeyRef = useRef<string | null>(null);
  const hasInitialFocusRef = useRef(false);
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const { rawItems, isLoading, isRefreshing, error, ensureSessionRefresh, refreshNews, markAllRead } = useNewsStore();

  const locale = getNewsLocale(i18n.language);
  const pageCopy = NEWS_PAGE_COPY[locale];
  const items = useMemo(() => normalizeMinecraftNewsItems(rawItems, locale), [locale, rawItems]);
  const [visibleCount, setVisibleCount] = useState(() => Math.min(INITIAL_VISIBLE_COUNT, items.length));

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
    if (hasInitialFocusRef.current || items.length === 0) return;

    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const firstKey = `news-official-${getNewsFocusKeySegment(items[0].id)}`;

    const tryFocusEntry = () => {
      if (doesFocusableExist(firstKey)) {
        focusManager.focus(firstKey);
        hasInitialFocusRef.current = true;
        return;
      }

      attempts += 1;
      if (attempts < 12) {
        timer = setTimeout(tryFocusEntry, 70);
      }
    };

    timer = setTimeout(tryFocusEntry, 80);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [items]);

  useEffect(() => {
    if (items.length > 0) {
      markAllRead();
    }
  }, [items, markAllRead]);

  useEffect(() => {
    const initialCount = Math.min(INITIAL_VISIBLE_COUNT, items.length);
    setVisibleCount((prev) => {
      if (prev === 0) return initialCount;
      return Math.min(Math.max(prev, initialCount), items.length);
    });
  }, [items.length]);

  useEffect(() => {
    if (items.length <= INITIAL_VISIBLE_COUNT) return;
    if (visibleCount >= items.length) return;

    const root = scrollRef.current;
    const target = loadMoreRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;

        setVisibleCount((prev) => Math.min(prev + LOAD_MORE_STEP, items.length));
      },
      {
        root,
        rootMargin: '280px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [items.length, visibleCount]);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;
  const resolvedError = error ? `${pageCopy.error}: ${error}` : null;
  const focusSequence = useMemo(
    () => [
      ...visibleItems.flatMap((item) => {
        const focusSegment = getNewsFocusKeySegment(item.id);
        return [`news-create-${focusSegment}`, `news-official-${focusSegment}`, `news-wiki-${focusSegment}`];
      }),
    ],
    [visibleItems]
  );

  useEffect(() => {
    const pendingFocusKey = pendingFocusKeyRef.current;
    if (!pendingFocusKey) return;

    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tryFocus = () => {
      if (doesFocusableExist(pendingFocusKey)) {
        focusManager.focus(pendingFocusKey);
        pendingFocusKeyRef.current = null;
        return;
      }

      attempts += 1;
      if (attempts < 10) {
        timer = setTimeout(tryFocus, 60);
      }
    };

    timer = setTimeout(tryFocus, 50);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [focusSequence, visibleCount]);

  const handleNearEndFocus = (index: number) => {
    if (!hasMore) return;
    if (index < visibleItems.length - 2) return;

    setVisibleCount((prev) => Math.min(prev + LOAD_MORE_STEP, items.length));
  };

  const moveLinearFocus = (focusKey: string, direction: string) => {
    const isForward = direction === 'right' || direction === 'down';
    const isBackward = direction === 'left' || direction === 'up';

    if (!isForward && !isBackward) {
      return true;
    }

    const currentIndex = focusSequence.indexOf(focusKey);
    if (currentIndex < 0) {
      return true;
    }

    const nextIndex = currentIndex + (isForward ? 1 : -1);
    if (nextIndex < 0) {
      return false;
    }

    const nextFocusKey = focusSequence[nextIndex];
    if (nextFocusKey) {
      focusManager.focus(nextFocusKey);
      return false;
    }

    if (isForward && hasMore) {
      const nextItem = items[visibleCount];
      if (nextItem) {
        pendingFocusKeyRef.current = `news-official-${getNewsFocusKeySegment(nextItem.id)}`;
        setVisibleCount((prev) => Math.min(prev + LOAD_MORE_STEP, items.length));
      }
      return false;
    }

    return false;
  };

  return (
    <FocusBoundary
      id="news-page"
      trapFocus
      className="flex h-full w-full overflow-hidden"
    >
      <div
        ref={scrollRef}
        className="h-full w-full overflow-y-auto custom-scrollbar px-5 pt-4 pb-6 sm:px-7 sm:pt-5 lg:px-8 lg:pt-5"
        style={{ scrollbarGutter: 'stable both-edges' }}
      >
        <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-2 inline-flex items-center gap-2 border border-white/10 bg-black/20 px-3 py-1.5 text-[0.68rem] font-minecraft tracking-[0.28em] text-ore-text-muted">
                <NewspaperIcon className="h-[0.95rem] w-[0.95rem] text-ore-green" />
                <span>{pageCopy.kicker}</span>
              </div>
              <h1 className="font-minecraft text-[2rem] text-white ore-text-shadow md:text-[2.5rem]">
                {pageCopy.title}
              </h1>
              <p className="mt-2 max-w-2xl font-minecraft text-sm leading-6 text-ore-text-muted md:text-[0.95rem]">
                {pageCopy.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <OreButton
                focusable={false}
                variant="primary"
                size="auto"
                className="!h-11 gap-2 !px-4 !text-white"
                onClick={() => void refreshNews({ background: rawItems.length > 0 })}
                autoScroll={false}
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                <span>{pageCopy.refresh}</span>
                <span className="ml-1 rounded bg-black/40 px-1.5 py-0.5 text-[0.65rem] text-white/70">X</span>
              </OreButton>

              <OreButton
                focusable={false}
                variant="secondary"
                size="auto"
                className="!h-11 gap-2 !px-4"
                onClick={() => setActiveTab('home')}
                autoScroll={false}
              >
                <ArrowLeft size={18} />
                <span>{pageCopy.back}</span>
                <span className="ml-1 rounded bg-black/20 px-1.5 py-0.5 text-[0.65rem] text-ore-text-muted">B</span>
              </OreButton>
            </div>
          </div>

          {resolvedError && (
            <div className="flex items-start gap-3 border-[3px] border-[#5d2c2c] bg-[#2d1a1a]/90 px-5 py-4 text-sm text-[#ffd2d2] shadow-[8px_8px_0_rgba(0,0,0,0.18)]">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#ff8a8a]" />
              <span className="font-minecraft leading-6">{resolvedError}</span>
            </div>
          )}

          {isLoading && visibleItems.length === 0 && (
            <div className="grid grid-cols-1 gap-5 min-[1000px]:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="min-h-[26rem] animate-pulse border-[3px] bg-[#313233] shadow-[8px_8px_0_rgba(0,0,0,0.24)]"
                  style={{
                    borderTopColor: '#5A5B5C',
                    borderLeftColor: '#5A5B5C',
                    borderRightColor: '#1E1E1F',
                    borderBottomColor: '#1E1E1F',
                  }}
                >
                  <div className="h-64 border-b-[3px] border-[#1E1E1F] bg-[#242526]" />
                  <div className="flex flex-col gap-4 p-5">
                    <div className="h-5 w-1/3 bg-white/10" />
                    <div className="h-7 w-4/5 bg-white/10" />
                    <div className="h-16 w-full bg-white/10" />
                    <div className="mt-8 h-11 w-full bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          )}

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
              <p className="max-w-xl font-minecraft text-base leading-7 text-ore-text-muted">
                {pageCopy.empty}
              </p>
            </div>
          )}

          {visibleItems.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-5 min-[1000px]:grid-cols-2">
                {visibleItems.map((item, index) => {
                  const focusSegment = getNewsFocusKeySegment(item.id);

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
                      displayIndex={index}
                      onCreateInstance={() => {
                        useLauncherStore.getState().setPendingNewsVersion(item.version);
                        setActiveTab('new-instance');
                      }}
                      onActionFocus={() => handleNearEndFocus(index)}
                      onCreateInstanceArrowPress={(direction) => moveLinearFocus(`news-create-${focusSegment}`, direction)}
                      onOfficialArrowPress={(direction) => moveLinearFocus(`news-official-${focusSegment}`, direction)}
                      onWikiArrowPress={(direction) => moveLinearFocus(`news-wiki-${focusSegment}`, direction)}
                    />
                  );
                })}
              </div>

              {hasMore && (
                <div
                  ref={loadMoreRef}
                  className="flex min-h-[4rem] items-center justify-center font-minecraft text-xs tracking-[0.28em] text-ore-text-muted"
                >
                  {isRefreshing ? pageCopy.refreshing : pageCopy.loadingMore}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </FocusBoundary>
  );
};

export default News;
