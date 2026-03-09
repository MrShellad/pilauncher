// src/features/Download/components/DownloadDetailModal.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { OreModal } from '../../../ui/primitives/OreModal';
import type { ModrinthProject, OreProjectVersion } from '../../InstanceDetail/logic/modrinthApi';
import { useDownloadDetail } from '../hooks/useDownloadDetail';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { ProjectHeader } from './DetailModal/ProjectHeader';
import { ProjectGallery } from './DetailModal/ProjectGallery';
import { VersionFilters } from './DetailModal/VersionFilters';
import { VersionList } from './DetailModal/VersionList';
import { InstanceSelectModal } from './DetailModal/InstanceSelectModal';
import { ModpackCreateModal } from './DetailModal/ModpackCreateModal'; 

interface DownloadDetailModalProps {
  project: ModrinthProject | null;
  instanceConfig: any; 
  onClose: () => void;
  onDownload: (version: OreProjectVersion, targetInstanceIdOrName: string) => void;
  installedVersionIds: string[]; 
  searchMcVersion?: string; 
  searchLoader?: string;
  activeTab: 'mod' | 'resourcepack' | 'shader' | 'modpack'; 
  directInstallInstanceId?: string; 
}

export const DownloadDetailModal: React.FC<DownloadDetailModalProps> = ({ 
  project, instanceConfig, onClose, onDownload, installedVersionIds, searchMcVersion, searchLoader, activeTab, directInstallInstanceId
}) => {
  const [showGallery, setShowGallery] = useState(false);
  const [visibleCount, setVisibleCount] = useState(15);
  const [isScrolled, setIsScrolled] = useState(false);
  const [pendingVersion, setPendingVersion] = useState<OreProjectVersion | null>(null);
  
  const observerTarget = useRef<HTMLDivElement>(null);

  const {
    details, versions, isLoadingVersions,
    activeLoader, setActiveLoader, activeVersion, setActiveVersion, loaderOptions, availableVersions
  } = useDownloadDetail(project, instanceConfig, searchMcVersion, searchLoader);

  useEffect(() => {
    if (project) { setShowGallery(false); setIsScrolled(false); }
  }, [project]);

  useEffect(() => { setVisibleCount(15); }, [activeLoader, activeVersion, versions]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) setVisibleCount(prev => prev + 15); }, { threshold: 0.1 });
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrolled = e.currentTarget.scrollTop > 30; 
    if (scrolled !== isScrolled) setIsScrolled(scrolled);
  };

  // ============================================================================
  // ✅ 核心修复：前端强力二次拦截过滤（绝对防御）
  // 无论底层 Hook 怎么延迟，只要渲染列表，强制过滤出完全匹配当前实例的版本！
  // ============================================================================
  const strictlyFilteredVersions = useMemo(() => {
    if (!versions) return [];

    return versions.filter((v: any) => {
      // 1. 内嵌直装模式：绝对锁死传入的 searchLoader / searchMcVersion
      // 2. 全局大厅模式：优先使用用户下拉框选中的 active 状态，否则兜底 search 参数
      const targetLoader = directInstallInstanceId ? searchLoader : (activeLoader || searchLoader);
      const targetVersion = directInstallInstanceId ? searchMcVersion : (activeVersion || searchMcVersion);

      let matchLoader = true;
      // 资源包和光影通常没有 loader 限制，因此仅对 Mod 生效
      if (activeTab === 'mod' && targetLoader && targetLoader.toLowerCase() !== 'all') {
        matchLoader = v.loaders.some((l: string) => l.toLowerCase() === targetLoader.toLowerCase());
      }

      let matchVersion = true;
      if (targetVersion && targetVersion.toLowerCase() !== 'all') {
        matchVersion = v.game_versions.includes(targetVersion);
      }

      return matchLoader && matchVersion;
    });
  }, [versions, directInstallInstanceId, searchLoader, searchMcVersion, activeLoader, activeVersion, activeTab]);

  if (!project) return null;
  
  // ✅ 使用严格过滤后的数组进行分页切片，杜绝脏数据
  const displayVersions = strictlyFilteredVersions.slice(0, visibleCount);

  // 计算当前实际在展示的状态，传给子组件做 UI 反馈
  const currentDisplayLoader = directInstallInstanceId ? searchLoader : (activeLoader || searchLoader);
  const currentDisplayVersion = directInstallInstanceId ? searchMcVersion : (activeVersion || searchMcVersion);

  return (
    <>
      <OreModal isOpen={!!project} onClose={onClose} hideTitleBar={true} className="w-[1000px] max-w-[95vw] h-[85vh] border-[2px] border-[#313233]" contentClassName="flex flex-col flex-1 min-h-0 bg-[#111112] overflow-hidden p-0">
        <ProjectHeader project={project} details={details} />
        <ProjectGallery project={project} details={details} isScrolled={isScrolled} showGallery={showGallery} setShowGallery={setShowGallery} />
        
        {/* 如果在内嵌直装模式下，彻底隐藏冗余的筛选器 */}
        {!directInstallInstanceId && (
          <VersionFilters 
            versionsCount={strictlyFilteredVersions.length} // 更新正确的过滤后总数
            loaderOptions={loaderOptions} activeLoader={activeLoader} setActiveLoader={setActiveLoader} 
            availableVersions={availableVersions} activeVersion={activeVersion} setActiveVersion={setActiveVersion} 
          />
        )}
        
        <div className={`flex-1 overflow-y-auto custom-scrollbar w-full relative z-10 shadow-[inset_0_10px_20px_-10px_rgba(0,0,0,0.8)] ${directInstallInstanceId ? 'mt-4 border-t border-white/5' : ''}`} onScroll={handleScroll}>
          <VersionList 
            versions={strictlyFilteredVersions} // ✅ 传入纯净无污染的总列表
            isLoadingVersions={isLoadingVersions} 
            activeVersion={currentDisplayVersion || ''} 
            activeLoader={currentDisplayLoader || ''} 
            displayVersions={displayVersions}   // ✅ 传入切片后的干净显示列表
            installedVersionIds={installedVersionIds}
            onDownload={(v) => {
              if (directInstallInstanceId) {
                onDownload(v, directInstallInstanceId);
                onClose(); 
                setTimeout(() => setFocus('btn-floating-download'), 150);
              } else {
                setPendingVersion(v);
              }
            }} 
            visibleCount={visibleCount} observerTarget={observerTarget}
          />
        </div>
      </OreModal>

      {/* 以下弹窗在 directInstallInstanceId 存在时不会被渲染调用 */}
      {activeTab === 'modpack' ? (
        <ModpackCreateModal 
          isOpen={!!pendingVersion} version={pendingVersion} project={project}
          onClose={() => setPendingVersion(null)}
          onConfirm={(instanceName) => { 
            if (pendingVersion) onDownload(pendingVersion, instanceName); 
            setPendingVersion(null); 
            onClose(); 
            setTimeout(() => setFocus('btn-floating-download'), 150);
          }}
        />
      ) : (
        <InstanceSelectModal 
          isOpen={!!pendingVersion && !directInstallInstanceId} version={pendingVersion}
          onClose={() => setPendingVersion(null)}
          onConfirm={(instanceId) => { 
            if (pendingVersion) onDownload(pendingVersion, instanceId); 
            setPendingVersion(null); 
            onClose(); 
            setTimeout(() => setFocus('btn-floating-download'), 150);
          }}
          ignoreLoader={activeTab !== 'mod'}
        />
      )}
    </>
  );
};