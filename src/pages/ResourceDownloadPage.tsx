import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'motion/react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Blocks, Image as ImageIcon, Package, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  ContextualActionBar,
  getContextualActionBarFocusKey
} from '../features/Download/components/ContextualActionBar';
import { DownloadDetailModal } from '../features/Download/components/DownloadDetailModal';
import { FavoritePlaceholderModal } from '../features/Download/components/FavoritePlaceholderModal';
import { FilterBar } from '../features/Download/components/FilterBar';
import { InstanceSelectModal } from '../features/Download/components/DetailModal/InstanceSelectModal';
import { ResourceGrid, ResourceCardSkeleton } from '../features/Download/components/ResourceGrid';
import { ShimmerOverlay } from '../features/Download/components/ShimmerOverlay';
import { fetchCurseForgeVersions } from '../features/Download/logic/curseforgeApi';
import { useResourceDownload, type DownloadSource, type TabType } from '../features/Download/hooks/useResourceDownload';
import { useDownloadSelectionStore } from '../features/Download/stores/useDownloadSelectionStore';
import { useIconCacheStore } from '../features/Download/logic/iconCache';
import { fetchModrinthVersions, type ModrinthProject, type OreProjectVersion } from '../features/InstanceDetail/logic/modrinthApi';
import { getInstalledProjectIds, getInstalledVersionIds, modService } from '../features/InstanceDetail/logic/modService';
import { useDownloadStore } from '../store/useDownloadStore';
import { useLauncherStore } from '../store/useLauncherStore';
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { useInputAction } from '../ui/focus/InputDriver';
import { focusManager } from '../ui/focus/FocusManager';

const DOWNLOAD_ACTION_BAR_FOCUS_PREFIX = 'resource-download-actions';
const DOWNLOAD_GRID_FOCUS_PREFIX = 'download-grid-item-';

const ResourceDownloadPageSkeleton = () => {
  return (
    <div className="relative flex h-full w-full flex-col bg-transparent text-white">
      {/* 1. FilterBar Skeleton */}
      <div className="flex-shrink-0 border-b-[0.125rem] border-[#1E1E1F] bg-[#313233] px-4 pt-4 pb-[1rem] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.08)]">
        <div className="mx-auto flex w-full max-w-[93.75rem] flex-col gap-3">
          <div className="flex h-10 items-center justify-center gap-2">
            <div className="relative overflow-hidden h-10 w-32 bg-[#48494A]/30 border-[0.125rem] border-[#141516]">
              <ShimmerOverlay />
            </div>
            <div className="relative overflow-hidden h-10 w-32 bg-[#48494A]/30 border-[0.125rem] border-[#141516]">
              <ShimmerOverlay />
            </div>
            <div className="relative overflow-hidden h-10 w-32 bg-[#48494A]/30 border-[0.125rem] border-[#141516]">
              <ShimmerOverlay />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-x-2 gap-y-2 md:grid-cols-2 lg:grid-cols-12">
            <div className="relative overflow-hidden h-10 lg:col-span-3 bg-[#48494A]/25 border-[0.125rem] border-[#141516]">
              <ShimmerOverlay />
            </div>
            <div className="relative overflow-hidden h-10 lg:col-span-6 bg-[#48494A]/25 border-[0.125rem] border-[#141516]">
              <ShimmerOverlay />
            </div>
            <div className="relative overflow-hidden h-10 lg:col-span-3 bg-[#48494A]/25 border-[0.125rem] border-[#141516]">
              <ShimmerOverlay />
            </div>
            
            <div className="relative overflow-hidden h-10 lg:col-span-3 bg-[#48494A]/25 border-[0.125rem] border-[#141516]">
              <ShimmerOverlay />
            </div>
            <div className="relative overflow-hidden h-10 lg:col-span-3 bg-[#48494A]/25 border-[0.125rem] border-[#141516]">
              <ShimmerOverlay />
            </div>
            <div className="relative overflow-hidden h-10 lg:col-span-3 bg-[#48494A]/25 border-[0.125rem] border-[#141516]">
              <ShimmerOverlay />
            </div>
            <div className="relative overflow-hidden h-10 lg:col-span-3 bg-[#48494A]/25 border-[0.125rem] border-[#141516]">
              <ShimmerOverlay />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Grid Skeleton */}
      <div className="h-full min-h-0 flex-1 overflow-hidden px-4 pt-6">
        <div className="grid grid-cols-1 min-[1921px]:grid-cols-2 gap-[0.75rem] pb-[1.5rem]">
          {Array.from({ length: 6 }).map((_, i) => (
            <ResourceCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
};

const ResourceDownloadPage: React.FC = () => {
  const { t } = useTranslation();
  const instanceId = useLauncherStore((state) => state.selectedInstanceId);
  const currentGlobalTab = useLauncherStore((state) => state.activeTab);

  const tabs: { id: TabType; label: string; icon: LucideIcon }[] = [
    { id: 'mod', label: t('download.tabs.mod', { defaultValue: 'Mods' }), icon: Blocks },
    { id: 'resourcepack', label: t('download.tabs.resourcepack', { defaultValue: 'Resource Packs' }), icon: Package },
    { id: 'shader', label: t('download.tabs.shader', { defaultValue: 'Shaders' }), icon: ImageIcon }
  ];

  const {
    activeTab,
    setActiveTab,
    query,
    setQuery,
    mcVersion,
    setMcVersion,
    loaderType,
    setLoaderType,
    category,
    setCategory,
    sort,
    setSort,
    source,
    setSource,
    results,
    offset,
    hasMore,
    isLoading,
    isLoadingMore,
    isEnvLoaded,
    installedMods,
    installedModIndex,
    refreshInstalledMods,
    instanceConfig,
    mcVersionOptions,
    categoryOptions,
    isCurseForgeAvailable,
    handleSearchClick,
    handleResetClick,
    loadMore,
    restoreState,
    loadMoreFailed,
    retryLoadMore
  } = useResourceDownload(instanceId);

  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);
  const [selectedProjectIdForTransition, setSelectedProjectIdForTransition] = useState<string | undefined>(undefined);

  const [hasInitialLoaded, setHasInitialLoaded] = useState(() => isEnvLoaded && !isLoading);

  useEffect(() => {
    if (isEnvLoaded && !isLoading) {
      setHasInitialLoaded(true);
    }
  }, [isEnvLoaded, isLoading]);

  useEffect(() => {
    if (selectedProject) {
      setSelectedProjectIdForTransition(selectedProject.id || (selectedProject as any).project_id);
    } else {
      const timer = setTimeout(() => {
        setSelectedProjectIdForTransition(undefined);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [selectedProject]);

  const [isFavoriteModalOpen, setIsFavoriteModalOpen] = useState(false);
  const [isBatchInstanceModalOpen, setIsBatchInstanceModalOpen] = useState(false);
  const [resultsScrollTop, setResultsScrollTop] = useState(0);

  interface DownloadHistoryItem {
    query: string;
    category: string;
    results: ModrinthProject[];
    offset: number;
    hasMore: boolean;
    scrollTop: number;
  }

  const [historyStack, setHistoryStack] = useState<DownloadHistoryItem[]>([]);
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab);

  if (activeTab !== prevActiveTab) {
    setPrevActiveTab(activeTab);
    setHistoryStack([]);
  }

  const handleBackFromAuthor = useCallback(() => {
    if (historyStack.length === 0) return;

    const prevStack = [...historyStack];
    const lastState = prevStack.pop()!;
    setHistoryStack(prevStack);

    restoreState(
      lastState.query,
      lastState.category,
      lastState.results,
      lastState.offset,
      lastState.hasMore
    );

    setTimeout(() => {
      const scrollHost = document.getElementById('resource-download-results');
      if (scrollHost) {
        scrollHost.scrollTop = lastState.scrollTop;
      }
    }, 50);
  }, [historyStack, restoreState]);

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        e.stopPropagation();
        handleBackFromAuthor();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleBackFromAuthor]);
  const selectedProjectIds = useDownloadSelectionStore((state) => state.selectedProjectIds);
  const selectedProjectsById = useDownloadSelectionStore((state) => state.selectedProjects);
  const selectedCount = useDownloadSelectionStore((state) => state.selectedCount);
  const isSelectionMode = useDownloadSelectionStore((state) => state.isSelectionMode);
  const getProjectKey = useDownloadSelectionStore((state) => state.getProjectKey);
  const toggleProjectSelection = useDownloadSelectionStore((state) => state.toggleProject);
  const clearDownloadSelection = useDownloadSelectionStore((state) => state.clearSelection);
  const lastFocusBeforeModalRef = React.useRef<string>('download-search-input');
  const lastListFocusBeforeActionBarRef = React.useRef<string>('download-grid-item-0');
  const didInitialFocusRef = React.useRef(false);
  const selectionTabRef = React.useRef<TabType>(activeTab);
  const pendingDepIdsRef = React.useRef<Set<string>>(new Set());
  const installedVersionIds = useMemo(() => getInstalledVersionIds(installedMods), [installedMods]);

  const selectedProjects = useMemo(
    () => Object.values(selectedProjectsById),
    [selectedProjectsById]
  );

  const hasStrictVersionAndLoader = Boolean(
    mcVersion && mcVersion !== 'all' && loaderType && loaderType !== 'all'
  );
  const showBulkDownload = activeTab === 'mod' && hasStrictVersionAndLoader;
  const selectionEnabled = activeTab !== 'modpack';
  const favoriteResourceType =
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

    const actionFocusKey = getContextualActionBarFocusKey(DOWNLOAD_ACTION_BAR_FOCUS_PREFIX, showBulkDownload);
    if (doesFocusableExist(actionFocusKey)) {
      setFocus(actionFocusKey);
    }
  });

  const clearSelection = useCallback(() => {
    clearDownloadSelection();
    setIsFavoriteModalOpen(false);
    setIsBatchInstanceModalOpen(false);

    // 核心修复：当取消选择时，如果当前聚焦在操作栏或丢失焦点，自动将焦点引回之前在列表里最后聚焦的那张卡片上
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
        return;
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

  // Restore focus to downloads tab components when returning to the downloads page tab
  useEffect(() => {
    if (currentGlobalTab !== 'downloads') return;
    if (selectedProject || isFavoriteModalOpen || isBatchInstanceModalOpen) return;

    const timer = setTimeout(() => {
      const currentFocus = getCurrentFocusKey();
      // If focus is lost, at root, or not on downloads page, restore it using FocusManager
      if (
        !currentFocus ||
        currentFocus === 'SN:ROOT' ||
        (!currentFocus.startsWith('download-') &&
          !currentFocus.startsWith('filter-') &&
          !currentFocus.startsWith('resource-download-actions'))
      ) {
        focusManager.restoreFocus('resource-download-page', 'download-search-input');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [currentGlobalTab, selectedProject, isFavoriteModalOpen, isBatchInstanceModalOpen]);

  const handleStartDownload = useCallback(async (
    version: OreProjectVersion,
    targetInstanceId: string | string[],
    autoInstallDeps = false,
    projectOverride?: { projectId?: string; source?: DownloadSource }
  ) => {
    const singleInstanceId = Array.isArray(targetInstanceId) ? targetInstanceId[0] : targetInstanceId;
    const subFolderMap: Record<TabType, string> = {
      mod: 'mods',
      resourcepack: 'resourcepacks',
      shader: 'shaderpacks',
      modpack: 'modpacks'
    };

    const subFolder = subFolderMap[activeTab];

    const executeDownload = async (targetVersion: OreProjectVersion, customProjectId?: string) => {
      useDownloadStore.getState().addOrUpdateTask({
        id: targetVersion.file_name,
        taskType: 'resource',
        title: targetVersion.file_name,
        stage: 'DOWNLOADING_MOD',
        current: 0,
        total: 100,
        message: t('download.progress.connecting', { defaultValue: 'Connecting...' }),
        retryAction: 'download_resource',
        retryPayload: {
          url: targetVersion.download_url,
          fileName: targetVersion.file_name,
          instanceId: singleInstanceId,
          subFolder
        }
      });

      try {
        await invoke('download_resource', {
          url: targetVersion.download_url,
          fileName: targetVersion.file_name,
          instanceId: singleInstanceId,
          subFolder
        });

        if (activeTab === 'mod') {
          const projectId = customProjectId || projectOverride?.projectId || targetVersion.project_id || selectedProject?.id || '';
          if (projectId) {
            await modService.updateModManifest(
              singleInstanceId,
              targetVersion.file_name,
              'launcherDownload',
              (projectOverride?.source || source) === 'curseforge' ? 'curseforge' : 'modrinth',
              projectId,
              targetVersion.id
            );
          }

          if (singleInstanceId === instanceId) {
            await refreshInstalledMods();
          }
        }
      } catch (error) {
        console.error(`下载 ${targetVersion.file_name} 失败:`, error);
        useDownloadStore.getState().addOrUpdateTask({
          id: targetVersion.file_name,
          stage: 'ERROR',
          message: t('download.progress.failed', {
            defaultValue: 'Download failed: {{error}}',
            error: String(error)
          })
        });
      }
    };

    await executeDownload(version);

    if (!autoInstallDeps || !version.dependencies?.length) return;

    try {
      const currentInstalledMods = await modService.getCachedModManifest(singleInstanceId, true);
      const installedIds = getInstalledProjectIds(currentInstalledMods);
      const missingDeps = version.dependencies.filter(
        (dependency) => 
          dependency.dependency_type === 'required' && 
          dependency.project_id && 
          !installedIds.includes(dependency.project_id) &&
          !pendingDepIdsRef.current.has(dependency.project_id)
      );

      if (missingDeps.length === 0) return;

      const targetGameVersion = version.game_versions[0]
        || instanceConfig?.game_version
        || instanceConfig?.gameVersion
        || mcVersion;

      const targetLoader = version.loaders[0]
        || instanceConfig?.loader_type
        || instanceConfig?.loaderType
        || loaderType;

      const fetchVersions = source === 'curseforge' ? fetchCurseForgeVersions : fetchModrinthVersions;

      for (const dependency of missingDeps) {
        pendingDepIdsRef.current.add(dependency.project_id!);
        try {
          const depVersions = await fetchVersions(
            dependency.project_id!,
            targetGameVersion && targetGameVersion !== 'all' ? targetGameVersion : undefined,
            targetLoader && targetLoader !== 'all' ? targetLoader : undefined
          );

          if (depVersions.length > 0) {
            await executeDownload(depVersions[0], dependency.project_id!);
          }
        } catch (err) {
          console.error(`处理前置依赖 ${dependency.project_id} 失败:`, err);
        }

        pendingDepIdsRef.current.delete(dependency.project_id!);
      }
    } catch (error) {
      console.error('处理前置依赖下载总流程失败:', error);
    }
  }, [
    activeTab,
    instanceConfig,
    instanceId,
    loaderType,
    mcVersion,
    refreshInstalledMods,
    selectedProject,
    source,
    t
  ]);

  const fetchLatestProjectVersion = useCallback(async (project: ModrinthProject) => {
    const projectId = project.id || project.project_id || '';
    if (!projectId) return null;

    const projectSource = project.source || source;
    const fetchVersions = projectSource === 'curseforge' ? fetchCurseForgeVersions : fetchModrinthVersions;
    const versions = await fetchVersions(projectId, mcVersion, loaderType);
    return versions[0] ? { version: versions[0], projectId, projectSource } : null;
  }, [loaderType, mcVersion, source]);

  const handleBatchDownloadConfirm = useCallback(async (instanceIds: string[]) => {
    const targets = [...selectedProjects];
    setIsBatchInstanceModalOpen(false);

    const resolvedVersions = await Promise.allSettled(
      targets.map((project) => fetchLatestProjectVersion(project))
    );

    const downloadable = resolvedVersions
      .map((result) => result.status === 'fulfilled' ? result.value : null)
      .filter((result): result is { version: OreProjectVersion; projectId: string; projectSource: DownloadSource } => Boolean(result));

    await Promise.allSettled(
      downloadable.flatMap(({ version, projectId, projectSource }) =>
        instanceIds.map((targetInstanceId) =>
          handleStartDownload(version, targetInstanceId, false, { projectId, source: projectSource })
        )
      )
    );

    clearSelection();
  }, [clearSelection, fetchLatestProjectVersion, handleStartDownload, selectedProjects]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent">
      {/* Main content wrapper, always mounted to prevent layout jumps and allow smooth reveal */}
      <motion.div
        key="page-content"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="h-full w-full"
      >
        <FocusBoundary id="resource-download-page" trapFocus={true} className="relative flex h-full w-full flex-col bg-transparent text-white">
          <h1 className="sr-only">{t('download.title', '资源下载')}</h1>
          <FilterBar
            activeTab={activeTab}
            tabs={tabs}
            onTabChange={setActiveTab}
            query={query}
            setQuery={setQuery}
            source={source}
            setSource={setSource}
            mcVersion={mcVersion}
            setMcVersion={setMcVersion}
            loaderType={loaderType}
            setLoaderType={setLoaderType}
            category={category}
            setCategory={setCategory}
            sort={sort}
            setSort={setSort}
            mcVersionOptions={mcVersionOptions}
            categoryOptions={categoryOptions}
            isCurseForgeAvailable={isCurseForgeAvailable}
            onSearch={handleSearchClick}
            onReset={handleResetClick}
          />

          <ResourceGrid
            key={`${source}-${activeTab}`}
            results={results}
            installedMods={installedMods}
            installedModIndex={installedModIndex}
            isLoading={isLoading && results.length === 0}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            categoryOptions={categoryOptions}
            onLoadMore={loadMore}
            onSelectProject={handleSelectProject}
            selectedProjectIds={selectionEnabled ? selectedProjectIds : undefined}
            isSelectionMode={selectionEnabled && isSelectionMode}
            onToggleProjectSelection={selectionEnabled ? handleToggleProjectSelection : undefined}
            getProjectKey={getProjectKey}
            onClickAuthor={(author) => {
              setHistoryStack((prev) => [
                ...prev,
                {
                  query,
                  category,
                  results,
                  offset,
                  hasMore,
                  scrollTop: resultsScrollTop
                }
              ]);
              setCategory('');
              setQuery(author, true);
            }}
            selectedProjectId={selectedProjectIdForTransition}
            scrollContainerId="resource-download-results"
            onScrollTopChange={setResultsScrollTop}
            loadMoreFailed={loadMoreFailed}
            onRetryLoadMore={retryLoadMore}
          />

          {selectionEnabled && (
            <ContextualActionBar
              selectedCount={selectedCount}
              showBulkDownload={showBulkDownload}
              onBulkDownload={() => setIsBatchInstanceModalOpen(true)}
              onAddFavorite={() => setIsFavoriteModalOpen(true)}
              onClear={clearSelection}
              focusKeyPrefix={DOWNLOAD_ACTION_BAR_FOCUS_PREFIX}
              favoriteLabel={
                activeTab === 'resourcepack'
                  ? '收藏资源包'
                  : activeTab === 'shader'
                  ? '收藏光影'
                  : '加入收藏'
              }
            />
          )}

          <DownloadDetailModal
            project={selectedProject}
            instanceConfig={instanceConfig}
            onClose={() => {
              setSelectedProject(null);
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
            }}
            onDownload={handleStartDownload}
            installedVersionIds={installedVersionIds}
            searchMcVersion={mcVersion}
            searchLoader={loaderType}
            activeTab={activeTab}
            source={source}
          />

          <FavoritePlaceholderModal
            isOpen={isFavoriteModalOpen}
            projects={selectedProjects}
            onClose={() => setIsFavoriteModalOpen(false)}
            resourceType={favoriteResourceType}
            defaultGameVersion={mcVersion && mcVersion !== 'all' ? mcVersion : ''}
            defaultLoader={loaderType && loaderType !== 'all' ? loaderType : ''}
            mcVersionOptions={mcVersionOptions}
            onCreated={clearSelection}
          />

          <InstanceSelectModal
            isOpen={isBatchInstanceModalOpen}
            version={batchRepresentativeVersion}
            onClose={() => setIsBatchInstanceModalOpen(false)}
            onConfirm={(instanceIds) => {
              void handleBatchDownloadConfirm(instanceIds);
            }}
            ignoreLoader={activeTab !== 'mod'}
            source={source}
          />
        </FocusBoundary>
      </motion.div>

      {/* Full-Page Loading Skeleton Overlay (wipes away from left to right) */}
      <AnimatePresence>
        {!hasInitialLoaded && (
          <motion.div
            key="page-skeleton-overlay"
            initial={{ opacity: 1, ["--wipe" as any]: "-120%" }}
            exit={{ 
              ["--wipe" as any]: "120%",
              pointerEvents: "none"
            }}
            transition={{ 
              ["--wipe" as any]: { duration: 0.7, ease: "easeInOut" }
            }}
            style={{
              maskImage: 'linear-gradient(to right, transparent var(--wipe), black calc(var(--wipe) + 100%))',
              WebkitMaskImage: 'linear-gradient(to right, transparent var(--wipe), black calc(var(--wipe) + 100%))'
            }}
            className="absolute inset-0 z-50 bg-[#313233]"
          >
            <ResourceDownloadPageSkeleton />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResourceDownloadPage;
