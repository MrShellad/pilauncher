// src/features/InstanceDetail/components/tabs/mods/InstanceModDownloadView.tsx
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useResourceDownload } from '../../../../Download/hooks/useResourceDownload';
import { ResourceGrid } from '../../../../Download/components/ResourceGrid';
import { DownloadDetailModal } from '../../../../Download/components/DownloadDetailModal';
import { useDownloadStore } from '../../../../../store/useDownloadStore';
import { InstanceFilterBar } from './InstanceFilterBar';
import type { ModrinthProject, OreProjectVersion } from '../../../logic/modrinthApi';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Loader2 } from 'lucide-react';
import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary'; 

export const InstanceModDownloadView: React.FC<{ instanceId: string, onBack: () => void }> = ({ instanceId, onBack }) => {
  const {
    activeTab, setActiveTab,
    query, setQuery, mcVersion, setMcVersion, loaderType, setLoaderType,
    category, setCategory, sort, setSort, source, setSource,
    results, hasMore, isLoading, isEnvLoaded, installedMods, instanceConfig,
    handleSearchClick, handleResetClick, loadMore
  } = useResourceDownload(instanceId);

  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);
  
  // ✅ 核心修复：采用严格的同步状态机
  // 0=未同步 1=已派发更新指令 2=确认状态生效并已触发搜索 3=可以显示UI
  const [syncStep, setSyncStep] = useState(0);

  useEffect(() => {
    if (!isEnvLoaded || !instanceConfig) return;

    const targetMc = instanceConfig.mcVersion || '';
    const lTypeRaw = instanceConfig.loader?.type?.toLowerCase() || '';
    const targetLoader = lTypeRaw === 'vanilla' ? '' : lTypeRaw;

    if (syncStep === 0) {
      // Step 0: 派发状态覆盖指令
      if (mcVersion !== targetMc) setMcVersion(targetMc);
      if (loaderType !== targetLoader) setLoaderType(targetLoader);
      if (activeTab !== 'mod') setActiveTab('mod');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSyncStep(1);
    } else if (syncStep === 1) {
      // Step 1: 等待 React 将状态写入组件闭包，只有当它们完全相等时才允许触发搜索！
      if (mcVersion === targetMc && loaderType === targetLoader && activeTab === 'mod') {
        handleSearchClick(); 
        setSyncStep(2);
      }
    } else if (syncStep === 2) {
      // Step 2: 留出 150ms 给网络请求缓冲，然后揭开遮罩屏
      const timer = setTimeout(() => setSyncStep(3), 150);
      return () => clearTimeout(timer);
    }
  }, [isEnvLoaded, instanceConfig, syncStep, mcVersion, loaderType, activeTab, setMcVersion, setLoaderType, setActiveTab, handleSearchClick]);

  useEffect(() => {
    // Step 3: UI 渲染完成后，精准挂载焦点
    if (syncStep === 3) {
      const timer = setTimeout(() => setFocus('inst-filter-search'), 100);
      return () => clearTimeout(timer);
    }
  }, [syncStep]);

  const handleStartDownload = async (version: OreProjectVersion, targetInstanceId: string) => {
    useDownloadStore.getState().addOrUpdateTask({
      id: version.file_name,
      taskType: 'resource',
      title: version.file_name,
      stage: 'DOWNLOADING_MOD',
      current: 0,
      total: 100, 
      message: '正在建立连接...'
    });

    try {
      await invoke('download_resource', {
        url: version.download_url,
        fileName: version.file_name,
        instanceId: targetInstanceId,
        subFolder: 'mods' 
      });
    } catch (e) {
      console.error("下载异常:", e);
      useDownloadStore.getState().addOrUpdateTask({ id: version.file_name, message: `下载失败: ${e}` });
    }
  };

  if (!isEnvLoaded || syncStep < 3) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center bg-[#141415] text-ore-green font-minecraft animate-pulse">
        <Loader2 size={40} className="animate-spin mb-5" />
        <div className="text-xl text-white tracking-widest mb-2">正在初始化下载引擎</div>
        <div className="text-sm text-gray-500">
          自动匹配 {instanceConfig?.mcVersion} {instanceConfig?.loader?.type !== 'Vanilla' ? instanceConfig?.loader?.type : ''} 专属模组...
        </div>
      </div>
    );
  }

  return (
    <FocusBoundary id="instance-mod-download-view" className="flex flex-col h-full w-full animate-fade-in outline-none">
      <InstanceFilterBar
        onBack={onBack}
        query={query} setQuery={setQuery} source={source} setSource={setSource}
        category={category} setCategory={setCategory} sort={sort} setSort={setSort}
        onSearch={handleSearchClick} onReset={handleResetClick}
      />
      <div className="flex-1 overflow-hidden relative border-2 border-[#1E1E1F] bg-black/20 shadow-inner rounded-sm">
        <ResourceGrid 
          results={results} installedMods={installedMods} isLoading={isLoading && results.length === 0} 
          hasMore={hasMore} onLoadMore={loadMore} onSelectProject={setSelectedProject} 
        />
      </div>
      <DownloadDetailModal 
        project={selectedProject} 
        instanceConfig={instanceConfig} 
        onClose={() => {
          setSelectedProject(null);
          setTimeout(() => setFocus('download-grid-item-0'), 50);
        }}
        onDownload={handleStartDownload}
        installedVersionIds={installedMods.map(m => m.modId || '').filter(Boolean)}
        // ✅ 强制传参为当前实例的属性，保障模态框筛选精准无误
        searchMcVersion={instanceConfig?.mcVersion} 
        searchLoader={instanceConfig?.loader?.type?.toLowerCase() === 'vanilla' ? '' : instanceConfig?.loader?.type?.toLowerCase()} 
        activeTab="mod"
        directInstallInstanceId={instanceId} 
      />
    </FocusBoundary>
  );
};
