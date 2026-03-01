// /src/pages/ResourceDownloadPage.tsx
import React, { useState, useEffect } from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { Blocks, Package, Image as ImageIcon } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
// ✅ 引入核心边界组件
import { FocusBoundary } from '../ui/focus/FocusBoundary'; 

import { useResourceDownload, type TabType } from '../features/Download/hooks/useResourceDownload';
import { FilterBar } from '../features/Download/components/FilterBar';
import { ResourceGrid } from '../features/Download/components/ResourceGrid';
import { BottomNav } from '../features/Download/components/BottomNav';
import { DownloadDetailModal } from '../features/Download/components/DownloadDetailModal';
import type { ModrinthProject } from '../features/InstanceDetail/logic/modrinthApi';

const TABS: { id: TabType, label: string, icon: any }[] = [
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

  // 快捷键拦截 (LT/RT / Esc)
  useEffect(() => {
    const handleGamepad = (e: KeyboardEvent) => {
      if (e.key === 'PageUp' || e.key === 'PageDown') {
        const currentIndex = TABS.findIndex(t => t.id === activeTab);
        let nextIndex = e.key === 'PageDown' ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex < 0) nextIndex = TABS.length - 1;
        if (nextIndex >= TABS.length) nextIndex = 0;
        setActiveTab(TABS[nextIndex].id);
      }
      if (e.key === 'Escape' && !selectedProject) setActiveTabGlobal('instances');
    };
    window.addEventListener('keydown', handleGamepad);
    return () => window.removeEventListener('keydown', handleGamepad);
  }, [activeTab, selectedProject, setActiveTabGlobal, setActiveTab]);

  // ✅ 当环境加载完毕时，自动向引擎发送“降落”指令，把焦点吸附在搜索框上
  useEffect(() => {
    if (isEnvLoaded && !selectedProject) {
      setTimeout(() => setFocus('download-search-input'), 100);
    }
  }, [isEnvLoaded, selectedProject]);

  if (!isEnvLoaded) return <div className="flex h-full items-center justify-center text-white font-minecraft">加载环境...</div>;

  return (
    // ✅ 核心修复：为页面套上最外层的保护边界，这不仅让引擎知道页面的存在，也拦截了意外的焦点丢失
    <FocusBoundary id="resource-download-page" className="w-full h-full flex flex-col bg-transparent text-white relative">
      
      <FilterBar 
        query={query} setQuery={setQuery} source={source} setSource={setSource}
        mcVersion={mcVersion} setMcVersion={setMcVersion} loaderType={loaderType} setLoaderType={setLoaderType}
        category={category} setCategory={setCategory} sort={sort} setSort={setSort}
        onSearch={handleSearchClick} onReset={handleResetClick}
      />

      <ResourceGrid 
        results={results} installedMods={installedMods} isLoading={isLoading && results.length === 0} 
        hasMore={hasMore} onLoadMore={loadMore} onSelectProject={setSelectedProject} 
      />

      {/* ✅ 传入 onTabChange 回调 */}
      <BottomNav activeTab={activeTab} tabs={TABS} onTabChange={setActiveTab} />

      <DownloadDetailModal 
        project={selectedProject} 
        instanceConfig={instanceConfig} 
        onClose={() => { setSelectedProject(null); setTimeout(() => setFocus('download-results-grid'), 50); }}
        onDownload={(versionId, url, fileName) => alert(`测试下载: ${fileName}`)}
        installedVersionIds={installedMods.map(m => m.modId || '').filter(Boolean)}
      />

    </FocusBoundary>
  );
};

export default ResourceDownloadPage;