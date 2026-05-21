import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, CalendarClock, ExternalLink, Tag, X } from 'lucide-react';

import { useArticlePushStore } from '../../../store/useArticlePushStore';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreOverlayScrollArea } from '../../../ui/primitives/OreOverlayScrollArea';
import { openExternalLink } from '../../../utils/openExternalLink';
import {
  formatArticlePushDateTime,
  normalizeArticlePushHtml,
  resolveArticlePushAssetUrl,
  resolveArticlePushExternalUrl,
} from '../data/articlePush';

const STARTUP_DELAY_MS = 2200;
const POLL_INTERVAL_MS = 10 * 60 * 1000;

export const StartupArticlePushModal: React.FC = () => {
  const { i18n } = useTranslation();
  const latestPush = useArticlePushStore((state) => state.latestPush);
  const isOpen = useArticlePushStore((state) => state.isStartupModalOpen);
  const ensureSessionRefresh = useArticlePushStore((state) => state.ensureSessionRefresh);
  const refreshLatestPush = useArticlePushStore((state) => state.refreshLatestPush);
  const dismissStartupModal = useArticlePushStore((state) => state.dismissStartupModal);
  const coverRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const [coverHalfOffset, setCoverHalfOffset] = useState(0);

  const isZh = i18n.language.toLowerCase().startsWith('zh');
  const copy = isZh
    ? {
        later: '稍后查看',
        openLink: '打开链接',
        publishedAt: '发布时间',
        noContent: '暂无详细内容',
      }
    : {
        later: 'Later',
        openLink: 'Open Link',
        publishedAt: 'Published',
        noContent: 'No details available',
      };

  useEffect(() => {
    const startupTimer = window.setTimeout(() => {
      void ensureSessionRefresh();
    }, STARTUP_DELAY_MS);

    const interval = window.setInterval(() => {
      void refreshLatestPush({ openIfNew: true });
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearTimeout(startupTimer);
      window.clearInterval(interval);
    };
  }, [ensureSessionRefresh, refreshLatestPush]);

  const coverUrl = useMemo(
    () => resolveArticlePushAssetUrl(latestPush?.cover),
    [latestPush?.cover]
  );
  const relatedLink = useMemo(
    () => resolveArticlePushExternalUrl(latestPush?.relatedLink),
    [latestPush?.relatedLink]
  );
  const contentHtml = useMemo(
    () => normalizeArticlePushHtml(latestPush?.content || ''),
    [latestPush?.content]
  );
  const publishTime = formatArticlePushDateTime(latestPush?.createdAt);
  const cardStyle = useMemo(
    () => ({
      '--article-push-cover-half': `${coverHalfOffset}px`,
      '--article-push-title-lift': `${Math.max(0, coverHalfOffset - 32)}px`,
    }) as React.CSSProperties,
    [coverHalfOffset]
  );

  const handleContentClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;

    const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
    if (!anchor?.href) return;

    event.preventDefault();
    void openExternalLink(anchor.href);
  };

  const handleOpenRelatedLink = () => {
    dismissStartupModal();
    void openExternalLink(relatedLink);
  };

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismissStartupModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dismissStartupModal, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsContentExpanded(false);
      return;
    }

    setIsContentExpanded(false);
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [isOpen, latestPush?.id]);

  useEffect(() => {
    if (!isOpen) return;

    const cover = coverRef.current;
    if (!cover) return;

    const updateCoverMetrics = () => {
      setCoverHalfOffset(Math.round(cover.getBoundingClientRect().height / 2));
    };

    updateCoverMetrics();
    window.addEventListener('resize', updateCoverMetrics);

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', updateCoverMetrics);
      };
    }

    const resizeObserver = new ResizeObserver(updateCoverMetrics);
    resizeObserver.observe(cover);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateCoverMetrics);
    };
  }, [coverUrl, isOpen, latestPush?.id]);

  const handleContentScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const canScroll = target.scrollHeight > target.clientHeight + 2;
    if (canScroll && target.scrollTop > 2) {
      setIsContentExpanded(true);
    }
  }, []);

  if (!latestPush) {
    return null;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="article-push-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              dismissStartupModal();
            }
          }}
        >
          <motion.article
            className={`article-push-card ${isContentExpanded ? 'is-content-expanded' : ''}`}
            style={cardStyle}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="article-push-card__close"
              onClick={dismissStartupModal}
              aria-label="Close"
            >
              <X size="1.25rem" />
            </button>

            <div ref={coverRef} className="article-push-card__cover">
              {coverUrl ? (
                <img src={coverUrl} alt="" loading="lazy" />
              ) : null}
              <div className="article-push-card__cover-shade" />
              <div className="article-push-card__cover-meta">
                {latestPush.category ? (
                  <span className="article-push-card__badge">
                    <Tag size="0.875rem" />
                    {latestPush.category}
                  </span>
                ) : null}
                {publishTime ? (
                  <span className="article-push-card__badge article-push-card__badge--time">
                    <CalendarClock size="0.875rem" />
                    {copy.publishedAt}: {publishTime}
                  </span>
                ) : null}
              </div>
              <h3 className="article-push-card__title">{latestPush.title}</h3>
            </div>

            <div className="article-push-card__body">
              {contentHtml ? (
                <OreOverlayScrollArea
                  ref={contentRef}
                  className="article-push-card__content-scroll"
                  viewportClassName="article-push-card__content-viewport"
                  contentClassName="article-push-card__content"
                  contentSafePaddingRight={24}
                  safeInsetTop={12}
                  safeInsetBottom={12}
                  safeInsetRight={10}
                  onClick={handleContentClick}
                  onScroll={handleContentScroll}
                >
                  <div className="article-push-card__rich-content" dangerouslySetInnerHTML={{ __html: contentHtml }} />
                </OreOverlayScrollArea>
              ) : (
                <p className="article-push-card__empty">{copy.noContent}</p>
              )}
            </div>

            <div className="article-push-card__actions">
              <OreButton
                focusKey="article-push-later"
                variant="secondary"
                size="auto"
                className="!h-[3rem] !min-w-[9.5rem] gap-[0.5rem] !px-[1rem] !text-[#111214]"
                onClick={dismissStartupModal}
              >
                <BellRing size="1rem" />
                {copy.later}
              </OreButton>
              {relatedLink ? (
                <OreButton
                  focusKey="article-push-open-link"
                  variant="primary"
                  size="auto"
                  className="!h-[3rem] !min-w-[11rem] gap-[0.5rem] !px-[1.125rem] !text-white"
                  onClick={handleOpenRelatedLink}
                >
                  <ExternalLink size="1rem" />
                  {copy.openLink}
                </OreButton>
              ) : null}
            </div>
          </motion.article>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};
