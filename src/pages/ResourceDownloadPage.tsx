// /src/pages/ResourceDownloadPage.tsx
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useLauncherStore } from '../store/useLauncherStore';
import { Blocks, Package, Image as ImageIcon, type LucideIcon } from 'lucide-react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { FocusBoundary } from '../ui/focus/FocusBoundary'; 

import { useResourceDownload, type TabType } from '../features/Download/hooks/useResourceDownload';
import { FilterBar } from '../features/Download/components/FilterBar';
import { ResourceGrid } from '../features/Download/components/ResourceGrid';
import { DownloadDetailModal } from '../features/Download/components/DownloadDetailModal';

// ✅ 引入获取版本详情的 API 和 本地 Mod 服务
import { fetchModrinthVersions, type ModrinthProject, type OreProjectVersion } from '../features/InstanceDetail/logic/modrinthApi';
import { modService } from '../features/InstanceDetail/logic/modService';

// ✅ 引入全局下载 Store
import { useDownloadStore } from '../store/useDownloadStore';

const TABS: { id: TabType; label: string; icon: LucideIcon }[] = [
  { id: 'mod', label: '模组 (Mods)', icon: Blocks },
  { id: 'resourcepack', label: '资源包', icon: Package },
  { id: 'shader', label: '光影', icon: ImageIcon },
];

const ResourceDownloadPage: React.FC = () => {
  const instanceId = useLauncherStore(state => state.selectedInstanceId);
  const setActiveTabGlobal = useLauncherStore(state => state.setActiveTab);
  
  const {
    activeTab, setActiveTab,
    query, setQuery, mcVersion, setMcVersion, loaderType, setLoaderType,
    category, setCategory, sort, setSort, source, setSource,
    results, hasMore, isLoading, isEnvLoaded, installedMods, instanceConfig,
    handleSearchClick, handleResetClick, loadMore
  } = useResourceDownload(instanceId);

  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);
  const lastFocusBeforeModalRef = React.useRef<string>('download-search-input');
  const didInitialFocusRef = React.useRef(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !selectedProject) setActiveTabGlobal('instances');
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedProject, setActiveTabGlobal]);

  useEffect(() => {
    if (!isEnvLoaded || !!selectedProject || didInitialFocusRef.current) return;
    didInitialFocusRef.current = true;
    setTimeout(() => setFocus('download-search-input'), 100);
  }, [isEnvLoaded, selectedProject]);

  // ==========================================
  // ✅ 核心：真实派发下载任务给 Rust 并唤醒 UI (支持自动补全前置)
  // ==========================================
  const handleStartDownload = async (version: OreProjectVersion, targetInstanceId: string, autoInstallDeps: boolean = false) => {
    const subFolderMap: Record<TabType, string> = {
      'mod': 'mods',
      'resourcepack': 'resourcepacks',
      'shader': 'shaderpacks',
      'modpack': 'modpacks',
    };
    const subFolder = subFolderMap[activeTab];

    // 1. 提取封装单体下载逻辑
    const executeDownload = (targetVersion: OreProjectVersion) => {
      useDownloadStore.getState().addOrUpdateTask({
        id: targetVersion.file_name, 
        taskType: 'resource',
        title: targetVersion.file_name,
        stage: 'DOWNLOADING_MOD',
        current: 0,
        total: 100, 
        message: '正在建立连接...'
      });

      invoke('download_resource', {
        url: targetVersion.download_url,
        fileName: targetVersion.file_name,
        instanceId: targetInstanceId,
        subFolder: subFolder
      }).catch(e => {
        console.error(`下载 ${targetVersion.file_name} 抛出异常:`, e);
        useDownloadStore.getState().addOrUpdateTask({
          id: targetVersion.file_name,
          message: `下载失败: ${e}`
        });
      });
    };

    // 2. 派发主文件下载
    executeDownload(version);

    // 3. 处理自动补全前置逻辑
    if (autoInstallDeps && version.dependencies) {
      const requiredDeps = version.dependencies.filter(d => d.dependency_type === 'required' && d.project_id);
      
      if (requiredDeps.length > 0) {
        try {
          // 获取目标实例真实已安装的 Mod（防止重复下载）
          const currentInstalledMods = await modService.getMods(targetInstanceId);
          const installedIds = currentInstalledMods.map(m => m.modId).filter(Boolean);
          const missingDeps = requiredDeps.filter(d => !installedIds.includes(d.project_id!));
          
          // 获取目标实例的环境，优先采用当前下载的主 Mod 的版本和 Loader ，保证前置环境和主体绝对一致
          const targetGameVersion = version.game_versions && version.game_versions.length > 0 
            ? version.game_versions[0] 
            : (instanceConfig?.game_version || instanceConfig?.gameVersion || mcVersion);
          
          const targetLoader = version.loaders && version.loaders.length > 0
            ? version.loaders[0]
            : (instanceConfig?.loader_type || instanceConfig?.loaderType || loaderType);

          for (const dep of missingDeps) {
            // 请求 Modrinth 获取兼容的前置版本
            const depVersions = await fetchModrinthVersions(
              dep.project_id!,
              targetGameVersion && targetGameVersion !== 'all' ? targetGameVersion : undefined,
              targetLoader && targetLoader !== 'all' ? targetLoader : undefined
            );

            // 如果找到兼容版本，触发并发下载
            if (depVersions && depVersions.length > 0) {
              const bestDep = depVersions[0];
              executeDownload(bestDep);
            }
          }
        } catch (error) {
          console.error('处理前置依赖下载时发生异常:', error);
        }
      }
    }
  };

  if (!isEnvLoaded) return <div className="flex h-full items-center justify-center text-white font-minecraft">加载环境...</div>;

  return (
    <FocusBoundary id="resource-download-page" className="w-full h-full flex flex-col bg-transparent text-white relative">
      <FilterBar 
        activeTab={activeTab}
        tabs={TABS}
        onTabChange={setActiveTab}
        query={query} setQuery={setQuery} source={source} setSource={setSource}
        mcVersion={mcVersion} setMcVersion={setMcVersion} loaderType={loaderType} setLoaderType={setLoaderType}
        category={category} setCategory={setCategory} sort={sort} setSort={setSort}
        onSearch={handleSearchClick} onReset={handleResetClick}
      />

      <ResourceGrid 
        results={results} installedMods={installedMods} isLoading={isLoading && results.length === 0} 
        hasMore={hasMore} onLoadMore={loadMore} onSelectProject={(project) => {
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
        installedVersionIds={installedMods.map(m => m.modId || '').filter(Boolean)}
        searchMcVersion={mcVersion}
        searchLoader={loaderType}
        activeTab={activeTab}
      />
    </FocusBoundary>
  );
};

export default ResourceDownloadPage;