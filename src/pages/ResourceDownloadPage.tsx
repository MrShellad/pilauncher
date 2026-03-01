// /src/pages/ResourceDownloadPage.tsx
import React, { useState, useEffect } from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { Blocks, Package, Image as ImageIcon } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

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
  
  // 1. 注入解耦好的超强 Hook
  const {
    activeTab, setActiveTab,
    query, setQuery, mcVersion, setMcVersion, loaderType, setLoaderType,
    category, setCategory, sort, setSort, source, setSource,
    results, hasMore, isLoading, isEnvLoaded, installedMods, instanceConfig,
    handleSearchClick, handleResetClick, loadMore
  } = useResourceDownload(instanceId);

  // 2. 详情弹窗状态
  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);

  // 3. 全局键盘/手柄监听 (LT/RT切换选项卡，ESC退出)
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

  // ✅ 安全屏障：必须等环境加载完毕才能渲染UI，解决白屏死机问题
  if (!isEnvLoaded) return <div className="flex h-full items-center justify-center text-white font-minecraft">加载环境...</div>;

  return (
    <div className="w-full h-full flex flex-col bg-transparent text-white relative">
      
      {/* 模块 1：顶部筛选器 */}
      <FilterBar 
        query={query} setQuery={setQuery} source={source} setSource={setSource}
        mcVersion={mcVersion} setMcVersion={setMcVersion} loaderType={loaderType} setLoaderType={setLoaderType}
        category={category} setCategory={setCategory} sort={sort} setSort={setSort}
        onSearch={handleSearchClick} onReset={handleResetClick}
      />

      {/* 模块 2：带有无限滚动的资源网格 */}
      <ResourceGrid 
        results={results} installedMods={installedMods} isLoading={isLoading && results.length === 0} 
        hasMore={hasMore} onLoadMore={loadMore} onSelectProject={setSelectedProject} 
      />

      {/* 模块 3：底部分段导航 */}
      <BottomNav activeTab={activeTab} tabs={TABS} />

      {/* 模块 4：详情与下载模态框 */}
      <DownloadDetailModal 
        project={selectedProject} 
        instanceConfig={instanceConfig} 
        onClose={() => { setSelectedProject(null); setTimeout(() => setFocus('download-results-grid'), 50); }}
        onDownload={(versionId, url, fileName) => alert(`测试下载: ${fileName}`)}
        installedVersionIds={installedMods.map(m => m.modId || '').filter(Boolean)}
      />

    </div>
  );
};

export default ResourceDownloadPage;