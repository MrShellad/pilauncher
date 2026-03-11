import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Loader2 } from 'lucide-react';

import { DownloadDetailModal } from '../../../../Download/components/DownloadDetailModal';
import { ResourceGrid } from '../../../../Download/components/ResourceGrid';
import { useResourceDownload } from '../../../../Download/hooks/useResourceDownload';
import type { ModrinthProject, OreProjectVersion } from '../../../logic/modrinthApi';
import { useDownloadStore } from '../../../../../store/useDownloadStore';
import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import { InstanceFilterBar } from './InstanceFilterBar';

export const InstanceModDownloadView: React.FC<{ instanceId: string; onBack: () => void }> = ({ instanceId, onBack }) => {
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
    isEnvLoaded,
    installedMods,
    instanceConfig,
    handleSearchClick,
    handleResetClick,
    loadMore
  } = useResourceDownload(instanceId);

  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);
  const [syncStep, setSyncStep] = useState(0);

  const config = (instanceConfig || {}) as Record<string, any>;
  const targetMc = config.game_version || config.gameVersion || config.mcVersion || '';
  const loaderRaw = (config.loader_type || config.loaderType || config.loader?.type || '').toLowerCase();
  const targetLoader = loaderRaw === 'vanilla' ? '' : loaderRaw;

  useEffect(() => {
    if (!isEnvLoaded || !instanceConfig) return;

    if (syncStep === 0) {
      if (mcVersion !== targetMc) setMcVersion(targetMc);
      if (loaderType !== targetLoader) setLoaderType(targetLoader);
      if (activeTab !== 'mod') setActiveTab('mod');
      setSyncStep(1);
      return;
    }

    if (syncStep === 1) {
      if (mcVersion === targetMc && loaderType === targetLoader && activeTab === 'mod') {
        handleSearchClick();
        setSyncStep(2);
      }
      return;
    }

    if (syncStep === 2) {
      const timer = setTimeout(() => setSyncStep(3), 150);
      return () => clearTimeout(timer);
    }
  }, [
    activeTab,
    handleSearchClick,
    instanceConfig,
    isEnvLoaded,
    loaderType,
    mcVersion,
    setActiveTab,
    setLoaderType,
    setMcVersion,
    syncStep,
    targetLoader,
    targetMc
  ]);

  useEffect(() => {
    if (syncStep !== 3) return;
    const timer = setTimeout(() => setFocus('inst-filter-search'), 100);
    return () => clearTimeout(timer);
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
    } catch (error) {
      console.error('下载异常:', error);
      useDownloadStore.getState().addOrUpdateTask({
        id: version.file_name,
        message: `下载失败: ${error}`
      });
    }
  };

  if (!isEnvLoaded || syncStep < 3) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#141415] font-minecraft text-ore-green animate-pulse">
        <Loader2 size={40} className="mb-5 animate-spin" />
        <div className="mb-2 text-xl tracking-widest text-white">正在初始化下载环境</div>
        <div className="text-sm text-gray-500">
          自动匹配 {targetMc} {loaderRaw !== 'vanilla' ? loaderRaw : ''} 专属模组...
        </div>
      </div>
    );
  }

  return (
    <FocusBoundary id="instance-mod-download-view" className="flex h-full w-full animate-fade-in flex-col outline-none">
      <InstanceFilterBar
        onBack={onBack}
        query={query}
        setQuery={setQuery}
        source={source}
        setSource={(value) => setSource(value as any)}
        category={category}
        setCategory={setCategory}
        sort={sort}
        setSort={setSort}
        onSearch={handleSearchClick}
        onReset={handleResetClick}
      />

      <div className="relative flex-1 overflow-hidden rounded-sm border-2 border-[#1E1E1F] bg-black/20 shadow-inner">
        <ResourceGrid
          results={results}
          installedMods={installedMods}
          isLoading={isLoading && results.length === 0}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onSelectProject={setSelectedProject}
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
        installedVersionIds={installedMods.map((item) => item.modId || '').filter(Boolean)}
        searchMcVersion={targetMc}
        searchLoader={targetLoader}
        activeTab="mod"
        source={source}
        directInstallInstanceId={instanceId}
      />
    </FocusBoundary>
  );
};
