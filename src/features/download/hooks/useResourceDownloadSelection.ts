import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { focusManager } from '@/ui/focus/FocusManager';
import { useInputAction } from '@/ui/focus/InputDriver';
import type { ModrinthProject, OreProjectVersion } from '@/features/resource-catalog';
import type { TabType } from './useResourceDownload';
import { getContextualActionBarFocusKey } from '../components/ContextualActionBar';
import { useIconCacheStore } from '../logic/iconCache';
import { useDownloadSelectionStore } from '../stores/useDownloadSelectionStore';

export const DOWNLOAD_ACTION_BAR_FOCUS_PREFIX = 'resource-download-actions';
const DOWNLOAD_GRID_FOCUS_PREFIX = 'download-grid-item-';

interface UseResourceDownloadSelectionOptions {
  activeTab: TabType;
  currentGlobalTab: string;
  isEnvLoaded: boolean;
  results: ModrinthProject[];
  mcVersion: string;
  loaderType: string;
}

export function useResourceDownloadSelection({
  activeTab,
  currentGlobalTab,
  isEnvLoaded,
  results,
  mcVersion,
  loaderType,
}: UseResourceDownloadSelectionOptions) {
  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);
  const [selectedProjectIdForTransition, setSelectedProjectIdForTransition] = useState<string>();
  const [isFavoriteModalOpen, setIsFavoriteModalOpen] = useState(false);
  const [isBatchInstanceModalOpen, setIsBatchInstanceModalOpen] = useState(false);
  const selectedProjectIds = useDownloadSelectionStore((state) => state.selectedProjectIds);
  const selectedProjectsById = useDownloadSelectionStore((state) => state.selectedProjects);
  const selectedCount = useDownloadSelectionStore((state) => state.selectedCount);
  const isSelectionMode = useDownloadSelectionStore((state) => state.isSelectionMode);
  const getProjectKey = useDownloadSelectionStore((state) => state.getProjectKey);
  const toggleProjectSelection = useDownloadSelectionStore((state) => state.toggleProject);
  const clearDownloadSelection = useDownloadSelectionStore((state) => state.clearSelection);
  const lastFocusBeforeModalRef = useRef('download-search-input');
  const lastListFocusBeforeActionBarRef = useRef('download-grid-item-0');
  const didInitialFocusRef = useRef(false);
  const selectionTabRef = useRef<TabType>(activeTab);
  const selectedProjectTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (selectedProjectTransitionTimerRef.current) {
        clearTimeout(selectedProjectTransitionTimerRef.current);
      }
    };
  }, []);

  const selectedProjects = useMemo(
    () => Object.values(selectedProjectsById),
    [selectedProjectsById]
  );

  const hasStrictVersionAndLoader = Boolean(
    mcVersion && mcVersion !== 'all' && loaderType && loaderType !== 'all'
  );
  const showBulkDownload = activeTab === 'mod' && hasStrictVersionAndLoader;
  const selectionEnabled = activeTab !== 'modpack';
  const favoriteResourceType: Extract<TabType, 'mod' | 'resourcepack' | 'shader'> =
    activeTab === 'resourcepack'
      ? 'resourcepack'
      : activeTab === 'shader'
      ? 'shader'
      : 'mod';

  const batchRepresentativeVersion = useMemo<OreProjectVersion | null>(() => {
    if (!showBulkDownload || selectedProjects.length === 0) return null;

    return {
      id: `batch-${mcVersion}-${loaderType}-${selectedProjects.length}`,
      name: `批量下载 ${selectedProjects.length} 个资源`,
      version_number: 'latest',
      date_published: new Date().toISOString(),
      loaders: [loaderType],
      game_versions: [mcVersion],
      file_name: `批量下载 ${selectedProjects.length} 个资源`,
      download_url: '',
      dependencies: []
    };
  }, [loaderType, mcVersion, selectedProjects.length, showBulkDownload]);

  const handleSelectProject = useCallback((project: ModrinthProject) => {
    const currentFocus = getCurrentFocusKey();
    if (currentFocus && currentFocus !== 'SN:ROOT') {
      lastFocusBeforeModalRef.current = currentFocus;
    }
    if (selectedProjectTransitionTimerRef.current) {
      clearTimeout(selectedProjectTransitionTimerRef.current);
      selectedProjectTransitionTimerRef.current = null;
    }
    setSelectedProjectIdForTransition(project.id || project.project_id);
    setSelectedProject(project);
    if (project.icon_url) {
      void useIconCacheStore.getState().refreshIcon(project.icon_url);
    }
  }, []);

  const handleToggleProjectSelection = useCallback((project: ModrinthProject) => {
    if (!selectionEnabled) return;
    toggleProjectSelection(project);
  }, [selectionEnabled, toggleProjectSelection]);

  const getFocusedResultProject = useCallback(() => {
    const currentFocus = getCurrentFocusKey();
    if (!currentFocus?.startsWith(DOWNLOAD_GRID_FOCUS_PREFIX)) return null;

    const index = Number(currentFocus.slice(DOWNLOAD_GRID_FOCUS_PREFIX.length));
    if (!Number.isInteger(index) || index < 0) return null;
    return results[index] ?? null;
  }, [results]);

  useInputAction('ACTION_X', () => {
    if (currentGlobalTab !== 'downloads') return;
    if (!selectionEnabled) return;
    if (selectedProject || isFavoriteModalOpen || isBatchInstanceModalOpen) return;

    const project = getFocusedResultProject();
    if (!project) return;

    const currentFocus = getCurrentFocusKey();
    if (currentFocus) lastListFocusBeforeActionBarRef.current = currentFocus;
    handleToggleProjectSelection(project);
  });

  useInputAction('MENU', () => {
    if (currentGlobalTab !== 'downloads') return;
    if (!selectionEnabled) return;
    if (!isSelectionMode || selectedProject || isFavoriteModalOpen || isBatchInstanceModalOpen) return;

    const currentFocus = getCurrentFocusKey();
    const isActionBarFocused = Boolean(currentFocus?.startsWith(DOWNLOAD_ACTION_BAR_FOCUS_PREFIX));

    if (isActionBarFocused) {
      const target = lastListFocusBeforeActionBarRef.current;
      if (target && doesFocusableExist(target)) {
        setFocus(target);
      } else if (doesFocusableExist('download-grid-item-0')) {
        setFocus('download-grid-item-0');
      }
      return;
    }

    if (currentFocus?.startsWith(DOWNLOAD_GRID_FOCUS_PREFIX)) {
      lastListFocusBeforeActionBarRef.current = currentFocus;
    }

    const actionFocusKey = getContextualActionBarFocusKey(
      DOWNLOAD_ACTION_BAR_FOCUS_PREFIX,
      showBulkDownload
    );
    if (doesFocusableExist(actionFocusKey)) {
      setFocus(actionFocusKey);
    }
  });

  const clearSelection = useCallback(() => {
    clearDownloadSelection();
    setIsFavoriteModalOpen(false);
    setIsBatchInstanceModalOpen(false);

    setTimeout(() => {
      const currentFocus = getCurrentFocusKey();
      const isInsideActionBar = currentFocus?.startsWith(DOWNLOAD_ACTION_BAR_FOCUS_PREFIX);
      if (!currentFocus || currentFocus === 'SN:ROOT' || isInsideActionBar) {
        const fallback = lastListFocusBeforeActionBarRef.current;
        if (fallback && doesFocusableExist(fallback)) {
          setFocus(fallback);
        } else if (doesFocusableExist('download-grid-item-0')) {
          setFocus('download-grid-item-0');
        }
      }
    }, 50);
  }, [clearDownloadSelection]);

  useEffect(() => {
    if (selectionTabRef.current === activeTab) return;
    selectionTabRef.current = activeTab;
    if (isSelectionMode) {
      queueMicrotask(clearSelection);
    }
  }, [activeTab, clearSelection, isSelectionMode]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (currentGlobalTab !== 'downloads') return;

      if (isSelectionMode && !selectedProject && !isFavoriteModalOpen && !isBatchInstanceModalOpen) {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [
    clearSelection,
    currentGlobalTab,
    isBatchInstanceModalOpen,
    isFavoriteModalOpen,
    isSelectionMode,
    selectedProject
  ]);

  useEffect(() => {
    if (!isEnvLoaded || selectedProject || didInitialFocusRef.current) return;
    didInitialFocusRef.current = true;
    setTimeout(() => setFocus('download-search-input'), 100);
  }, [isEnvLoaded, selectedProject]);

  useEffect(() => {
    if (currentGlobalTab !== 'downloads') return;
    if (selectedProject || isFavoriteModalOpen || isBatchInstanceModalOpen) return;

    const timer = setTimeout(() => {
      const currentFocus = getCurrentFocusKey();
      if (
        !currentFocus ||
        currentFocus === 'SN:ROOT' ||
        (!currentFocus.startsWith('download-') &&
          !currentFocus.startsWith('filter-') &&
          !currentFocus.startsWith(DOWNLOAD_ACTION_BAR_FOCUS_PREFIX))
      ) {
        focusManager.restoreFocus('resource-download-page', 'download-search-input');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [currentGlobalTab, selectedProject, isFavoriteModalOpen, isBatchInstanceModalOpen]);

  const closeSelectedProject = useCallback(() => {
    setSelectedProject(null);
    if (selectedProjectTransitionTimerRef.current) {
      clearTimeout(selectedProjectTransitionTimerRef.current);
    }
    selectedProjectTransitionTimerRef.current = setTimeout(() => {
      setSelectedProjectIdForTransition(undefined);
      selectedProjectTransitionTimerRef.current = null;
    }, 350);
    setTimeout(() => {
      const lastFocus = lastFocusBeforeModalRef.current;
      if (lastFocus && doesFocusableExist(lastFocus)) {
        setFocus(lastFocus);
        return;
      }
      if (doesFocusableExist('download-grid-item-0')) {
        setFocus('download-grid-item-0');
        return;
      }
      setFocus('download-search-input');
    }, 50);
  }, []);

  return {
    selectedProject,
    selectedProjectIdForTransition,
    selectedProjectIds,
    selectedProjects,
    selectedCount,
    isSelectionMode,
    selectionEnabled,
    showBulkDownload,
    favoriteResourceType,
    batchRepresentativeVersion,
    isFavoriteModalOpen,
    isBatchInstanceModalOpen,
    getProjectKey,
    handleSelectProject,
    handleToggleProjectSelection,
    clearSelection,
    closeSelectedProject,
    openFavoriteModal: () => setIsFavoriteModalOpen(true),
    closeFavoriteModal: () => setIsFavoriteModalOpen(false),
    openBatchInstanceModal: () => setIsBatchInstanceModalOpen(true),
    closeBatchInstanceModal: () => setIsBatchInstanceModalOpen(false),
  };
}
