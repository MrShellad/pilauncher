import React, { useMemo, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { doesFocusableExist, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';

import { NewsCard } from './NewsCard';
import { NEWS_PAGE_COPY, getNewsLocale, normalizeMinecraftNewsItems } from '../data/newsItems';
import { useLauncherStore } from '../../../store/useLauncherStore';
import { useNewsStore } from '../../../store/useNewsStore';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { focusManager } from '../../../ui/focus/FocusManager';

export const StartupNewsModal: React.FC = () => {
  const { i18n } = useTranslation();
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const { startupItem, isStartupModalOpen, dismissStartupModal } = useNewsStore();

  const locale = getNewsLocale(i18n.language);
  const pageCopy = NEWS_PAGE_COPY[locale];
  const normalizedItem = useMemo(
    () => (startupItem ? normalizeMinecraftNewsItems([startupItem], locale)[0] : null),
    [locale, startupItem]
  );

  const modalId = useId();
  const boundaryId = `news-modal-boundary-${modalId.replace(/:/g, '')}`;
  const previousFocusKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (isStartupModalOpen) {
      previousFocusKeyRef.current = getCurrentFocusKey();
    }

    return () => {
      if (isStartupModalOpen && previousFocusKeyRef.current) {
        const keyToRestore = previousFocusKeyRef.current;
        setTimeout(() => {
          if (doesFocusableExist(keyToRestore)) {
            focusManager.focus(keyToRestore);
          }
        }, 120);
      }
    };
  }, [isStartupModalOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isStartupModalOpen) return;
      e.stopPropagation();
      dismissStartupModal();
    };

    let timer: ReturnType<typeof setTimeout> | null = null;

    if (isStartupModalOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEsc, { capture: true });

      let attempts = 0;
      const maxAttempts = 14;
      const tryFocus = () => {
        if (doesFocusableExist('startup-news-create')) {
          focusManager.focus('startup-news-create');
        } else if (doesFocusableExist('startup-news-official')) {
          focusManager.focus('startup-news-official');
        } else {
          attempts += 1;
          if (attempts < maxAttempts) {
            timer = setTimeout(tryFocus, 70);
          }
        }
      };
      timer = setTimeout(tryFocus, 80);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      if (timer) clearTimeout(timer);
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEsc, { capture: true });
    };
  }, [isStartupModalOpen, dismissStartupModal]);

  if (!normalizedItem) {
    return null;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isStartupModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              dismissStartupModal();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-none"
          />

          <FocusBoundary
            id={boundaryId}
            trapFocus={isStartupModalOpen}
            onEscape={dismissStartupModal}
            defaultFocusKey="startup-news-create"
            className="relative z-10 w-full max-w-[640px] outline-none"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="w-full"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <NewsCard
                date={normalizedItem.date}
                version={normalizedItem.version}
                tag={normalizedItem.tag}
                title={normalizedItem.title}
                summary={normalizedItem.summary}
                coverImageUrl={normalizedItem.coverImageUrl}
                officialUrl={normalizedItem.officialUrl}
                wikiUrl={normalizedItem.wikiUrl}
                officialLabel={pageCopy.official}
                wikiLabel={pageCopy.wiki}
                officialFocusKey="startup-news-official"
                wikiFocusKey="startup-news-wiki"
                createInstanceFocusKey="startup-news-create"
                displayIndex={0}
                onCreateInstance={() => {
                  useLauncherStore.getState().setPendingNewsVersion(normalizedItem.version);
                  dismissStartupModal();
                  setActiveTab('new-instance');
                }}
                onClose={dismissStartupModal}
              />
            </motion.div>
          </FocusBoundary>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
