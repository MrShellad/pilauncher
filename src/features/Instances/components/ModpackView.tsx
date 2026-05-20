import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { DownloadDetailModal } from '../../Download/components/DownloadDetailModal';
import { FilterBar } from '../../Download/components/FilterBar';
import { ResourceGrid } from '../../Download/components/ResourceGrid';
import { useResourceDownload } from '../../Download/hooks/useResourceDownload';
import type { ModrinthProject, OreProjectVersion } from '../../InstanceDetail/logic/modrinthApi';
import { useDownloadStore } from '../../../store/useDownloadStore';
import { useLauncherStore } from '../../../store/useLauncherStore';

export const ModpackView: React.FC = () => {
  const { t } = useTranslation();
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
      alert('\u627e\u4e0d\u5230\u53ef\u7528\u7684\u4e0b\u8f7d\u94fe\u63a5\uff0c\u8bf7\u68c0\u67e5\u7248\u672c\u6570\u636e\u3002');
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
      console.error('\u6574\u5408\u5305\u4e0b\u8f7d\u6307\u4ee4\u53d1\u9001\u5931\u8d25:', error);
      alert(`\u6307\u4ee4\u53d1\u9001\u5931\u8d25: ${error}`);
    }
  };

  return (
    <div className="relative flex h-full w-full animate-fade-in flex-col bg-[#111112]">
      <FilterBar
        activeTab={downloadState.activeTab}
        tabs={[{ id: 'modpack', label: t('download.tabs.modpack', { defaultValue: 'Modpacks' }), icon: Package }]}
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
        isLoadingMore={downloadState.isLoadingMore}
        hasMore={downloadState.hasMore}
        categoryOptions={downloadState.categoryOptions}
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
