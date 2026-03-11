import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Package } from 'lucide-react';

import { DownloadDetailModal } from '../../Download/components/DownloadDetailModal';
import { FilterBar } from '../../Download/components/FilterBar';
import { ResourceGrid } from '../../Download/components/ResourceGrid';
import { useResourceDownload } from '../../Download/hooks/useResourceDownload';
import type { ModrinthProject, OreProjectVersion } from '../../InstanceDetail/logic/modrinthApi';
import { useDownloadStore } from '../../../store/useDownloadStore';
import { useLauncherStore } from '../../../store/useLauncherStore';

export const ModpackView: React.FC = () => {
  const downloadState = useResourceDownload('__modpack_market__');
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const setPopupOpen = useDownloadStore((state) => state.setPopupOpen);

  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);

  useEffect(() => {
    downloadState.setActiveTab('modpack');
  }, [downloadState]);

  useEffect(() => {
    if (selectedProject) return;
    const timer = setTimeout(() => setFocus('download-search-input'), 100);
    return () => clearTimeout(timer);
  }, [selectedProject]);

  const handleDownload = async (version: OreProjectVersion, instanceName: string) => {
    if (!version.download_url) {
      alert('找不到可用的下载链接，请检查版本数据。');
      return;
    }

    try {
      await invoke('download_and_import_modpack', {
        url: version.download_url,
        instanceName
      });

      setSelectedProject(null);
      setActiveTab('home');
      setPopupOpen(true);
    } catch (error) {
      console.error('整合包下载指令发送失败:', error);
      alert(`指令发送失败: ${error}`);
    }
  };

  return (
    <div className="relative flex h-full w-full animate-fade-in flex-col bg-[#111112]">
      <FilterBar
        activeTab={downloadState.activeTab}
        tabs={[{ id: 'modpack', label: '整合包', icon: Package }]}
        onTabChange={downloadState.setActiveTab}
        query={downloadState.query}
        setQuery={downloadState.setQuery}
        source={downloadState.source}
        setSource={downloadState.setSource}
        mcVersion={downloadState.mcVersion}
        setMcVersion={downloadState.setMcVersion}
        loaderType={downloadState.loaderType}
        setLoaderType={downloadState.setLoaderType}
        category={downloadState.category}
        setCategory={downloadState.setCategory}
        sort={downloadState.sort}
        setSort={downloadState.setSort}
        mcVersionOptions={downloadState.mcVersionOptions}
        categoryOptions={downloadState.categoryOptions}
        isCurseForgeAvailable={downloadState.isCurseForgeAvailable}
        onSearch={downloadState.handleSearchClick}
        onReset={downloadState.handleResetClick}
      />

      <ResourceGrid
        results={downloadState.results}
        installedMods={[]}
        isLoading={downloadState.isLoading}
        hasMore={downloadState.hasMore}
        onLoadMore={downloadState.loadMore}
        onSelectProject={setSelectedProject}
      />

      {selectedProject && (
        <DownloadDetailModal
          project={selectedProject}
          instanceConfig={null}
          onClose={() => setSelectedProject(null)}
          onDownload={handleDownload}
          installedVersionIds={[]}
          activeTab="modpack"
          source={downloadState.source}
        />
      )}
    </div>
  );
};
