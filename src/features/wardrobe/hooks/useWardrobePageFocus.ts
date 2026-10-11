import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { doesFocusableExist, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';

import { focusManager } from '@/ui/focus/FocusManager';
import { useInputAction } from '@/ui/focus/InputDriver';
import type { WardrobeTab } from '../types';

interface UseWardrobePageFocusOptions {
  activeSection: WardrobeTab;
  setActiveSection: Dispatch<SetStateAction<WardrobeTab>>;
  skinMenuOpen: boolean;
  capeMenuOpen: boolean;
  onlineMenuOpen: boolean;
  closeSkinMenu: () => void;
  closeCapeMenu: () => void;
  closeOnlineMenu: () => void;
  handleBack: () => void;
  handleRefresh: () => void | Promise<void>;
  canRefresh: boolean;
  accountUuid?: string;
  profileCapeCount?: number;
  skinCardCount: number;
}

export function useWardrobePageFocus({
  activeSection,
  setActiveSection,
  skinMenuOpen,
  capeMenuOpen,
  onlineMenuOpen,
  closeSkinMenu,
  closeCapeMenu,
  closeOnlineMenu,
  handleBack,
  handleRefresh,
  canRefresh,
  accountUuid,
  profileCapeCount,
  skinCardCount,
}: UseWardrobePageFocusOptions) {
  const hasBlockingOverlay = skinMenuOpen || capeMenuOpen || onlineMenuOpen;
  const lastFocusKeyBeforeOverlayRef = useRef<string | null>(null);

  useEffect(() => {
    if (hasBlockingOverlay) {
      const currentFocus = getCurrentFocusKey();
      if (currentFocus && currentFocus !== 'SN:ROOT') {
        lastFocusKeyBeforeOverlayRef.current = currentFocus;
      }
    }
  }, [hasBlockingOverlay]);

  const resolveWardrobeFocusKey = useCallback(() => {
    const sectionCandidates =
      activeSection === 'online'
        ? ['wardrobe-online-search', 'wardrobe-section-1', 'wardrobe-upload-card']
        : activeSection === 'cape'
        ? ['wardrobe-cape-0', 'wardrobe-section-2', 'wardrobe-section-0', 'wardrobe-upload-card']
        : ['wardrobe-upload-card', 'wardrobe-skin-0', 'wardrobe-section-0', 'wardrobe-section-1'];

    return sectionCandidates.find((focusKey) => doesFocusableExist(focusKey)) ?? null;
  }, [activeSection]);

  useEffect(() => {
    if (hasBlockingOverlay) {
      return;
    }

    let attempts = 0;
    let timer: ReturnType<typeof window.setTimeout> | undefined;

    const ensureWardrobeFocus = () => {
      const currentFocusKey = getCurrentFocusKey();
      if (currentFocusKey && doesFocusableExist(currentFocusKey)) {
        return;
      }

      const restoredTarget = lastFocusKeyBeforeOverlayRef.current;
      const targetKey = restoredTarget && doesFocusableExist(restoredTarget)
        ? restoredTarget
        : resolveWardrobeFocusKey();

      lastFocusKeyBeforeOverlayRef.current = null;

      if (targetKey) {
        timer = window.setTimeout(() => {
          if (doesFocusableExist(targetKey)) {
            focusManager.focus(targetKey);
          }
        }, 0);
        return;
      }

      attempts += 1;
      if (attempts < 12) {
        timer = window.setTimeout(ensureWardrobeFocus, 60);
      }
    };

    timer = window.setTimeout(ensureWardrobeFocus, 30);

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [accountUuid, hasBlockingOverlay, profileCapeCount, resolveWardrobeFocusKey, skinCardCount]);

  useInputAction('CANCEL', () => {
    if (skinMenuOpen) {
      closeSkinMenu();
      return;
    }
    if (onlineMenuOpen) {
      closeOnlineMenu();
      return;
    }
    if (capeMenuOpen) {
      closeCapeMenu();
      return;
    }
    handleBack();
  });

  const selectPreviousSection = () => {
    if (!hasBlockingOverlay) {
      setActiveSection((previous) =>
        previous === 'cape' ? 'online' : previous === 'online' ? 'skin' : 'skin'
      );
    }
  };

  const selectNextSection = () => {
    if (!hasBlockingOverlay) {
      setActiveSection((previous) =>
        previous === 'skin' ? 'online' : previous === 'online' ? 'cape' : 'cape'
      );
    }
  };

  useInputAction('TAB_LEFT', selectPreviousSection);
  useInputAction('PAGE_LEFT', selectPreviousSection);
  useInputAction('TAB_RIGHT', selectNextSection);
  useInputAction('PAGE_RIGHT', selectNextSection);
  useInputAction('ACTION_X', () => {
    if (hasBlockingOverlay || !canRefresh) return;
    void handleRefresh();
  });
}
