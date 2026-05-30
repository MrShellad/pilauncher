import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Blocks, Image as ImageIcon, Loader2, Package, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  ContextualActionBar,
  getContextualActionBarFocusKey
} from '../features/Download/components/ContextualActionBar';
import { DownloadDetailModal } from '../features/Download/components/DownloadDetailModal';
import { FavoritePlaceholderModal } from '../features/Download/components/FavoritePlaceholderModal';
import { FilterBar } from '../features/Download/components/FilterBar';
import { InstanceSelectModal } from '../features/Download/components/DetailModal/InstanceSelectModal';
import { ResourceGrid } from '../features/Download/components/ResourceGrid';
import { fetchCurseForgeVersions } from '../features/Download/logic/curseforgeApi';
import { useResourceDownload, type DownloadSource, type TabType } from '../features/Download/hooks/useResourceDownload';
import { useDownloadSelectionStore } from '../features/Download/stores/useDownloadSelectionStore';
import { fetchModrinthVersions, type ModrinthProject, type OreProjectVersion } from '../features/InstanceDetail/logic/modrinthApi';
import { getInstalledProjectIds, getInstalledVersionIds, modService } from '../features/InstanceDetail/logic/modService';
import { useDownloadStore } from '../store/useDownloadStore';
import { useLauncherStore } from '../store/useLauncherStore';
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { useInputAction } from '../ui/focus/InputDriver';

const DOWNLOAD_ACTION_BAR_FOCUS_PREFIX = 'resource-download-actions';
const DOWNLOAD_GRID_FOCUS_PREFIX = 'download-grid-item-';

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
    loadMore
  } = useResourceDownload(instanceId);

  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);
  const [isFavoriteModalOpen, setIsFavoriteModalOpen] = useState(false);
  const [isBatchInstanceModalOpen, setIsBatchInstanceModalOpen] = useState(false);
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
  const selectionEnabled = activeTab !== 'shader';
  const favoriteResourceType = activeTab === 'resourcepack' ? 'resourcepack' : 'mod';

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

  const handleStartDownload = useCallback(async (
    version: OreProjectVersion,
    targetInstanceId: string,
    autoInstallDeps = false,
    projectOverride?: { projectId?: string; source?: DownloadSource }
  ) => {
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
          instanceId: targetInstanceId,
          subFolder
        }
      });

      try {
        await invoke('download_resource', {
          url: targetVersion.download_url,
          fileName: targetVersion.file_name,
          instanceId: targetInstanceId,
          subFolder
        });

        if (activeTab === 'mod') {
          const projectId = customProjectId || projectOverride?.projectId || targetVersion.project_id || selectedProject?.id || '';
          if (projectId) {
            await modService.updateModManifest(
              targetInstanceId,
              targetVersion.file_name,
              'launcherDownload',
              (projectOverride?.source || source) === 'curseforge' ? 'curseforge' : 'modrinth',
              projectId,
              targetVersion.id
            );
          }

          if (targetInstanceId === instanceId) {
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
      const currentInstalledMods = await modService.getCachedModManifest(targetInstanceId, true);
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

  if (!isEnvLoaded) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-white font-minecraft">
        <Loader2 size={44} className="animate-spin text-ore-green" />
        {t('download.status.loadingEnv', { defaultValue: 'Loading environment...' })}
      </div>
    );
  }

  return (
    <FocusBoundary id="resource-download-page" trapFocus={true} className="relative flex h-full w-full flex-col bg-transparent text-white">
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
          setCategory('');
          setQuery(author);
        }}
      />

      {selectionEnabled && (
        <ContextualActionBar
          selectedCount={selectedCount}
          showBulkDownload={showBulkDownload}
          onBulkDownload={() => setIsBatchInstanceModalOpen(true)}
          onAddFavorite={() => setIsFavoriteModalOpen(true)}
          onClear={clearSelection}
          focusKeyPrefix={DOWNLOAD_ACTION_BAR_FOCUS_PREFIX}
          favoriteLabel={activeTab === 'resourcepack' ? '收藏资源包' : '加入收藏'}
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
  );
};

export default ResourceDownloadPage;
