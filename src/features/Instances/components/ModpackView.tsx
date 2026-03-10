// /src/features/Instances/components/ModpackView.tsx
import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Package } from 'lucide-react';

import { useResourceDownload } from '../../Download/hooks/useResourceDownload';
import { FilterBar } from '../../Download/components/FilterBar';
import { ResourceGrid } from '../../Download/components/ResourceGrid';
import { DownloadDetailModal } from '../../Download/components/DownloadDetailModal';
import type { ModrinthProject, OreProjectVersion } from '../../InstanceDetail/logic/modrinthApi';

import { useLauncherStore } from '../../../store/useLauncherStore';
import { useDownloadStore } from '../../../store/useDownloadStore';

export const ModpackView: React.FC = () => {
  // ✅ 使用特殊 ID 隔离缓存，防止和普通的实例模组下载冲突
  const downloadState = useResourceDownload('__modpack_market__');
  const setActiveTab = useLauncherStore(state => state.setActiveTab);
  const setPopupOpen = useDownloadStore(state => state.setPopupOpen);
  const setActiveDownloadTab = downloadState.setActiveTab;
  
  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);

  // ✅ 强制锁定为 modpack 模式，这样底层的 Modrinth API 会自动去搜索整合包
  useEffect(() => {
    setActiveDownloadTab('modpack');
  }, [setActiveDownloadTab]);

  useEffect(() => {
    if (selectedProject) return;
    const timer = setTimeout(() => setFocus('download-search-input'), 100);
    return () => clearTimeout(timer);
  }, [selectedProject]);

  // ✅ 核心下载与跳转逻辑
  const handleDownload = async (version: OreProjectVersion, instanceName: string) => {
    const targetUrl = version.download_url;

    if (!targetUrl) {
      console.error("异常的版本数据结构:", version);
      alert('找不到可用的下载直链，请查看控制台排查数据格式');
      return;
    }

    try {
      // 发送下载直链和用户起好的实例名给 Rust 后端
      await invoke('download_and_import_modpack', {
        url: targetUrl,
        instanceName: instanceName,
      });
      
      // 关闭弹窗
      setSelectedProject(null);
      
      // ✅ 终极联动：瞬间跳回主页，并自动在右下角弹出下载任务管理器面板
      setActiveTab('home'); 
      setPopupOpen(true);   
      
    } catch (e) {
      console.error("请求发送失败:", e);
      alert(`指令发送失败: ${e}`);
    }
  };

  return (
    <div className="flex flex-col h-full w-full relative animate-fade-in bg-[#111112]">
      {/* 搜索与过滤器生态复用 */}
      <FilterBar
        activeTab={downloadState.activeTab}
        tabs={[{ id: 'modpack', label: '整合包', icon: Package }]}
        onTabChange={downloadState.setActiveTab}
        query={downloadState.query} setQuery={downloadState.setQuery}
        source={downloadState.source} setSource={downloadState.setSource}
        mcVersion={downloadState.mcVersion} setMcVersion={downloadState.setMcVersion}
        loaderType={downloadState.loaderType} setLoaderType={downloadState.setLoaderType}
        category={downloadState.category} setCategory={downloadState.setCategory}
        sort={downloadState.sort} setSort={downloadState.setSort}
        onSearch={downloadState.handleSearchClick}
        onReset={downloadState.handleResetClick}
      />
      
      {/* 瀑布流卡片生态复用 */}
      <ResourceGrid
        results={downloadState.results}
        installedMods={[]} // 整合包市场不需要检查哪些包已经安装
        isLoading={downloadState.isLoading}
        hasMore={downloadState.hasMore}
        onLoadMore={downloadState.loadMore}
        onSelectProject={setSelectedProject}
      />
      
      {/* 详情与版本选择弹窗生态复用 */}
      {selectedProject && (
        <DownloadDetailModal
          project={selectedProject}
          instanceConfig={null} // 此时还没有实例，所以环境信息为 null
          onClose={() => setSelectedProject(null)}
          onDownload={handleDownload} // 将上面的下载逻辑注入
          installedVersionIds={[]}
          activeTab="modpack" // 告诉弹窗当前处于整合包模式，弹出 ModpackCreateModal
        />
      )}
    </div>
  );
};
