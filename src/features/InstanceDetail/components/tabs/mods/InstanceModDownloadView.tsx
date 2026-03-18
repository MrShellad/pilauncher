import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Loader2 } from 'lucide-react';

import { DownloadDetailModal } from '../../../../Download/components/DownloadDetailModal';
import { useResourceDownload } from '../../../../Download/hooks/useResourceDownload';
import type { ModrinthProject, OreProjectVersion } from '../../../logic/modrinthApi';
import { useDownloadStore } from '../../../../../store/useDownloadStore';
import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import { useInputAction } from '../../../../../ui/focus/InputDriver';
import { InstanceFilterBar } from './InstanceFilterBar';
import { ResourceGrid } from './ResourceGrid';

const GamepadBtn = ({ text, color }: { text: string; color: string }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="inline-block flex-shrink-0"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" fill={color} className="drop-shadow-[0_0_4px_rgba(250,204,21,0.45)]" />
    <text
      x="12"
      y="16.5"
      fontSize="13"
      fontWeight="900"
      fontFamily="system-ui, sans-serif"
      fill="#1E1E1F"
      textAnchor="middle"
    >
      {text}
    </text>
  </svg>
);

export const InstanceModDownloadView: React.FC<{
  instanceId: string;
  onBack: () => void;
  showFilterBackButton?: boolean;
  resourceTab?: 'mod' | 'resourcepack' | 'shader';
}> = ({
  instanceId,
  onBack,
  showFilterBackButton = true,
  resourceTab = 'mod'
}) => {
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
    handleSearchClick,
    handleResetClick,
    loadMore
  } = useResourceDownload(instanceId);

  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);
  const [syncStep, setSyncStep] = useState(0);
  const filterBarRef = useRef<HTMLDivElement | null>(null);
  const [resultsScrollTop, setResultsScrollTop] = useState(0);
  const isHintVisible = resultsScrollTop > 48;

  const config = (instanceConfig || {}) as Record<string, any>;
  const targetMc = config.game_version || config.gameVersion || config.mcVersion || '';
  const loaderRaw = (config.loader_type || config.loaderType || config.loader?.type || '').toLowerCase();
  const targetLoader = loaderRaw === 'vanilla' ? '' : loaderRaw;
  const yHintText = useMemo(() => '回到顶部', []);

  useEffect(() => {
    if (!isEnvLoaded || !instanceConfig) return;

    if (syncStep === 0) {
      if (mcVersion !== targetMc) setMcVersion(targetMc);
      if (resourceTab === 'mod' && loaderType !== targetLoader) setLoaderType(targetLoader);
      if (activeTab !== resourceTab) setActiveTab(resourceTab);
      setSyncStep(1);
      return;
    }

    if (syncStep === 1) {
      const loaderReady = resourceTab === 'mod' ? loaderType === targetLoader : true;
      if (mcVersion === targetMc && loaderReady && activeTab === resourceTab) {
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
    targetMc,
    resourceTab
  ]);

  useEffect(() => {
    if (syncStep !== 3) return;
    const timer = setTimeout(() => setFocus('inst-filter-search'), 100);
    return () => clearTimeout(timer);
  }, [syncStep]);

  useInputAction('ACTION_Y', () => {
    const scrollHost = document.getElementById('instance-mod-download-results');
    if (scrollHost) {
      scrollHost.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setTimeout(() => setFocus('inst-filter-search'), 120);
  });

  const handleStartDownload = async (version: OreProjectVersion, targetInstanceId: string) => {
    const subFolder = resourceTab === 'shader'
      ? 'shaderpacks'
      : resourceTab === 'resourcepack'
        ? 'resourcepacks'
        : 'mods';

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
        subFolder
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
      <div ref={filterBarRef}>
        <InstanceFilterBar
          onBack={onBack}
          showBackButton={showFilterBackButton}
          resourceTab={resourceTab}
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
      </div>

      <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden rounded-sm border-2 border-[#1E1E1F] bg-black/20 shadow-inner">
        {isHintVisible && (
          <div className="pointer-events-none absolute right-4 top-4 z-50 flex items-center gap-2 rounded-sm border border-white/10 bg-black/60 px-3 py-2 text-xs font-minecraft tracking-wider text-gray-200 shadow-lg backdrop-blur">
            <GamepadBtn text="Y" color="#FACC15" />
            <span className="mt-[1px]">{yHintText}</span>
          </div>
        )}
        <ResourceGrid
          results={results}
          installedMods={installedMods}
          isLoading={isLoading && results.length === 0}
          isLoadingMore={isLoadingMore}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onSelectProject={setSelectedProject}
          scrollContainerId="instance-mod-download-results"
          onScrollTopChange={setResultsScrollTop}
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
        searchLoader={resourceTab === 'mod' ? targetLoader : ''}
        activeTab={resourceTab}
        source={source}
        directInstallInstanceId={instanceId}
      />
    </FocusBoundary>
  );
};
