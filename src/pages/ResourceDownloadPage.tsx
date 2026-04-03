import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Blocks, Image as ImageIcon, Package, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { DownloadDetailModal } from '../features/Download/components/DownloadDetailModal';
import { FilterBar } from '../features/Download/components/FilterBar';
import { ResourceGrid } from '../features/Download/components/ResourceGrid';
import { fetchCurseForgeVersions } from '../features/Download/logic/curseforgeApi';
import { useResourceDownload, type TabType } from '../features/Download/hooks/useResourceDownload';
import { fetchModrinthVersions, type ModrinthProject, type OreProjectVersion } from '../features/InstanceDetail/logic/modrinthApi';
import { modService } from '../features/InstanceDetail/logic/modService';
import { useDownloadStore } from '../store/useDownloadStore';
import { useLauncherStore } from '../store/useLauncherStore';
import { FocusBoundary } from '../ui/focus/FocusBoundary';

const ResourceDownloadPage: React.FC = () => {
  const { t } = useTranslation();
  const instanceId = useLauncherStore((state) => state.selectedInstanceId);
  const setActiveTabGlobal = useLauncherStore((state) => state.setActiveTab);

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
    instanceConfig,
    mcVersionOptions,
    categoryOptions,
    isCurseForgeAvailable,
    handleSearchClick,
    handleResetClick,
    loadMore
  } = useResourceDownload(instanceId);

  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);
  const lastFocusBeforeModalRef = React.useRef<string>('download-search-input');
  const didInitialFocusRef = React.useRef(false);
  const pendingDepIdsRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !selectedProject) {
        setActiveTabGlobal('instances');
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedProject, setActiveTabGlobal]);

  useEffect(() => {
    if (!isEnvLoaded || selectedProject || didInitialFocusRef.current) return;
    didInitialFocusRef.current = true;
    setTimeout(() => setFocus('download-search-input'), 100);
  }, [isEnvLoaded, selectedProject]);

  const handleStartDownload = async (
    version: OreProjectVersion,
    targetInstanceId: string,
    autoInstallDeps = false
  ) => {
    const subFolderMap: Record<TabType, string> = {
      mod: 'mods',
      resourcepack: 'resourcepacks',
      shader: 'shaderpacks',
      modpack: 'modpacks'
    };

    const subFolder = subFolderMap[activeTab];

    const executeDownload = (targetVersion: OreProjectVersion) => {
      useDownloadStore.getState().addOrUpdateTask({
        id: targetVersion.file_name,
        taskType: 'resource',
        title: targetVersion.file_name,
        stage: 'DOWNLOADING_MOD',
        current: 0,
        total: 100,
        message: t('download.progress.connecting', { defaultValue: 'Connecting...' })
      });

      invoke('download_resource', {
        url: targetVersion.download_url,
        fileName: targetVersion.file_name,
        instanceId: targetInstanceId,
        subFolder
      }).catch((error) => {
        console.error(`下载 ${targetVersion.file_name} 失败:`, error);
        useDownloadStore.getState().addOrUpdateTask({
          id: targetVersion.file_name,
          message: t('download.progress.failed', {
            defaultValue: 'Download failed: {{error}}',
            error: String(error)
          })
        });
      });
    };

    executeDownload(version);

    if (!autoInstallDeps || !version.dependencies?.length) return;

    try {
      const currentInstalledMods = await modService.getMods(targetInstanceId);
      const installedIds = currentInstalledMods.map((mod) => mod.modId).filter(Boolean);
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
            executeDownload(depVersions[0]);
          } else {
            pendingDepIdsRef.current.delete(dependency.project_id!);
          }
        } catch (err) {
          pendingDepIdsRef.current.delete(dependency.project_id!);
          console.error(`处理前置依赖 ${dependency.project_id} 失败:`, err);
        }
      }
    } catch (error) {
      console.error('处理前置依赖下载总流程失败:', error);
    }
  };

  if (!isEnvLoaded) {
    return (
      <div className="flex h-full items-center justify-center text-white font-minecraft">
        {t('download.status.loadingEnv', { defaultValue: 'Loading environment...' })}
      </div>
    );
  }

  return (
    <FocusBoundary id="resource-download-page" className="relative flex h-full w-full flex-col bg-transparent text-white">
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
        isLoading={isLoading && results.length === 0}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        categoryOptions={categoryOptions}
        onLoadMore={loadMore}
        onSelectProject={(project) => {
          const currentFocus = getCurrentFocusKey();
          if (currentFocus && currentFocus !== 'SN:ROOT') {
            lastFocusBeforeModalRef.current = currentFocus;
          }
          setSelectedProject(project);
        }}
      />

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
        installedVersionIds={installedMods.map((mod) => mod.modId || '').filter(Boolean)}
        searchMcVersion={mcVersion}
        searchLoader={loaderType}
        activeTab={activeTab}
        source={source}
      />
    </FocusBoundary>
  );
};

export default ResourceDownloadPage;
