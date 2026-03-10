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
import type { ModrinthProject, OreProjectVersion } from '../features/InstanceDetail/logic/modrinthApi';

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
  // ✅ 核心：真实派发下载任务给 Rust 并唤醒 UI
  // ==========================================
  const handleStartDownload = async (version: OreProjectVersion, targetInstanceId: string) => {
    const subFolderMap: Record<TabType, string> = {
      'mod': 'mods',
      'resourcepack': 'resourcepacks',
      'shader': 'shaderpacks',
      'modpack': 'modpacks',
      
    };
    const subFolder = subFolderMap[activeTab];

    // 1. 提前把任务塞进 Store，让 UI 瞬间弹出来，提供极速响应感
    useDownloadStore.getState().addOrUpdateTask({
      id: version.file_name, // 用文件名做唯一任务 ID
      taskType: 'resource',
      title: version.file_name,
      stage: 'DOWNLOADING_MOD',
      current: 0,
      total: 100, // 随便给个非0值防止算进度时除以0导致 NaN
      message: '正在建立连接...'
    });

    try {
      // 2. 正式调用后端的下载指令（由于耗时，这里是异步，但 UI 已经显示进去了）
      await invoke('download_resource', {
        url: version.download_url,
        fileName: version.file_name,
        instanceId: targetInstanceId,
        subFolder: subFolder
      });

    } catch (e) {
      console.error("下载请求抛出异常:", e);
      // 如果报错，推一条失败日志进去，DownloadManager 里的高亮正则会捕捉到“失败”并标红
      useDownloadStore.getState().addOrUpdateTask({
        id: version.file_name,
        message: `下载失败: ${e}`
      });
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
