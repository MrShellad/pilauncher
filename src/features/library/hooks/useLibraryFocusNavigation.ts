import { useEffect, useRef, useState } from 'react';
import {
  doesFocusableExist,
  getCurrentFocusKey,
  setFocus,
} from '@noriginmedia/norigin-spatial-navigation';

import { useInputAction } from '@/ui/focus/InputDriver';

import {
  LIBRARY_COLLECTION_FOCUS_PREFIX,
  LIBRARY_RESOURCE_FOCUS_PREFIX,
} from '../logic/libraryPageUtils';

interface UseLibraryFocusNavigationOptions {
  currentGlobalTab: string;
  hasBlockingOverlay: boolean;
  isCollectionSortMode: boolean;
  isCategoryView: boolean;
  parentCategoryId: string | null | undefined;
  visibleResourceCount: number;
  visibleCollectionCount: number;
  setSelectedGroupId: (groupId: string) => void;
  onOpenFocusedResourceContextMenu: () => void;
}

export const useLibraryFocusNavigation = ({
  currentGlobalTab,
  hasBlockingOverlay,
  isCollectionSortMode,
  isCategoryView,
  parentCategoryId,
  visibleResourceCount,
  visibleCollectionCount,
  setSelectedGroupId,
  onOpenFocusedResourceContextMenu,
}: UseLibraryFocusNavigationOptions) => {
  const didInitialControllerFocusRef = useRef(false);
  const rightAreaLastFocusRef = useRef<string | null>(null);
  const sidebarLastFocusRef = useRef<string | null>('library-tags-manage');
  const lastFocusKeyBeforeOverlayRef = useRef<string | null>(null);
  const [activeSection, setActiveSection] = useState<'sidebar' | 'content'>('content');

  const handleContentArrow = (index: number, direction: string) => {
    if (direction === 'up' && index === 0) {
      const target = ['library-search', 'library-sort'].find(doesFocusableExist);
      if (target) {
        setFocus(target);
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    if (!hasBlockingOverlay) return;
    const currentFocus = getCurrentFocusKey();
    if (currentFocus && currentFocus !== 'SN:ROOT') {
      lastFocusKeyBeforeOverlayRef.current = currentFocus;
    }
  }, [hasBlockingOverlay]);

  useInputAction('ACTION_X', () => {
    if (currentGlobalTab !== 'library' || hasBlockingOverlay || isCollectionSortMode) return;
    onOpenFocusedResourceContextMenu();
  });

  useInputAction('ACTION_Y', () => {
    if (currentGlobalTab !== 'library' || hasBlockingOverlay) return;

    const currentFocus = getCurrentFocusKey();
    if (activeSection === 'sidebar') {
      if (currentFocus && (currentFocus === 'library-tags-manage' || currentFocus.startsWith('library-tag-'))) {
        sidebarLastFocusRef.current = currentFocus;
      }
      setActiveSection('content');
      return;
    }

    if (currentFocus && currentFocus !== 'SN:ROOT') {
      rightAreaLastFocusRef.current = currentFocus;
    }
    setActiveSection('sidebar');
  });

  useInputAction('CANCEL', () => {
    if (currentGlobalTab !== 'library' || hasBlockingOverlay) return;
    if (parentCategoryId) {
      setSelectedGroupId(parentCategoryId);
    } else if (isCategoryView) {
      setSelectedGroupId('all');
    }
  });

  useEffect(() => {
    if (currentGlobalTab === 'library') return;
    setActiveSection('content');
    didInitialControllerFocusRef.current = false;
    lastFocusKeyBeforeOverlayRef.current = null;
  }, [currentGlobalTab]);

  useEffect(() => {
    if (currentGlobalTab !== 'library' || hasBlockingOverlay) return;

    if (activeSection === 'sidebar') {
      const target = sidebarLastFocusRef.current || 'library-tags-manage';
      const timer = setTimeout(() => {
        if (doesFocusableExist(target)) setFocus(target);
      }, 50);
      return () => clearTimeout(timer);
    }

    const previousTarget = rightAreaLastFocusRef.current;
    const fallbackTarget = isCategoryView
      ? `${LIBRARY_COLLECTION_FOCUS_PREFIX}0`
      : visibleResourceCount > 0
        ? `${LIBRARY_RESOURCE_FOCUS_PREFIX}0`
        : 'library-search';
    const target = previousTarget && doesFocusableExist(previousTarget)
      ? previousTarget
      : fallbackTarget;
    const timer = setTimeout(() => {
      if (doesFocusableExist(target)) setFocus(target);
    }, 50);
    return () => clearTimeout(timer);
  }, [
    activeSection,
    currentGlobalTab,
    hasBlockingOverlay,
    isCategoryView,
    visibleCollectionCount,
    visibleResourceCount,
  ]);

  useEffect(() => {
    if (currentGlobalTab !== 'library') {
      didInitialControllerFocusRef.current = false;
      return;
    }
    if (hasBlockingOverlay) return;

    const currentFocus = getCurrentFocusKey();
    if (currentFocus && currentFocus !== 'SN:ROOT' && doesFocusableExist(currentFocus)) {
      const isInSidebar = currentFocus === 'library-tags-manage' || currentFocus.startsWith('library-tag-');
      setActiveSection(isInSidebar ? 'sidebar' : 'content');
      didInitialControllerFocusRef.current = true;
      return;
    }

    const restoredTarget = lastFocusKeyBeforeOverlayRef.current;
    const preferredTarget = isCategoryView
      ? `${LIBRARY_COLLECTION_FOCUS_PREFIX}0`
      : visibleResourceCount > 0
        ? `${LIBRARY_RESOURCE_FOCUS_PREFIX}0`
        : 'library-search';
    const target = restoredTarget && doesFocusableExist(restoredTarget)
      ? restoredTarget
      : preferredTarget;
    lastFocusKeyBeforeOverlayRef.current = null;

    if (didInitialControllerFocusRef.current && !doesFocusableExist(target)) return;
    const timer = window.setTimeout(() => {
      const availableTarget = [target, 'library-search'].find(doesFocusableExist);
      if (availableTarget) {
        setFocus(availableTarget);
        didInitialControllerFocusRef.current = true;
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [
    currentGlobalTab,
    hasBlockingOverlay,
    isCategoryView,
    visibleCollectionCount,
    visibleResourceCount,
  ]);

  return { activeSection, handleContentArrow };
};
