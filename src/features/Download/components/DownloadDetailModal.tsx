// src/features/Download/components/DownloadDetailModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { OreModal } from '../../../ui/primitives/OreModal';
import type { ModrinthProject, OreProjectVersion } from '../../InstanceDetail/logic/modrinthApi';
import { useDownloadDetail } from '../hooks/useDownloadDetail';

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
}

export const DownloadDetailModal: React.FC<DownloadDetailModalProps> = ({ 
  project, instanceConfig, onClose, onDownload, installedVersionIds, searchMcVersion, searchLoader, activeTab 
}) => {
  const [showGallery, setShowGallery] = useState(false);
  const [visibleCount, setVisibleCount] = useState(15);
  const [isScrolled, setIsScrolled] = useState(false);
  const [pendingVersion, setPendingVersion] = useState<OreProjectVersion | null>(null);
  
  const observerTarget = useRef<HTMLDivElement>(null);

  const {
    details, versions, isLoadingVersions,
    activeLoader, setActiveLoader, activeVersion, setActiveVersion,
    loaderOptions, availableVersions
  } = useDownloadDetail(project, instanceConfig, searchMcVersion, searchLoader);

  useEffect(() => {
    if (project) { setShowGallery(false); setIsScrolled(false); }
  }, [project]);

  useEffect(() => { setVisibleCount(15); }, [activeLoader, activeVersion, versions]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setVisibleCount(prev => prev + 15); },
      { threshold: 0.1 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrolled = e.currentTarget.scrollTop > 30; 
    if (scrolled !== isScrolled) setIsScrolled(scrolled);
  };

  if (!project) return null;
  const displayVersions = versions.slice(0, visibleCount);

  return (
    <>
      <OreModal 
        isOpen={!!project} 
        onClose={onClose} 
        hideTitleBar={true} 
        // ✅ 核心修复：锁死宽度为 w-[1000px]，杜绝了不同状态下尺寸乱跳的怪异现象
        className="w-[1000px] max-w-[95vw] h-[85vh] border-[2px] border-[#313233]"
        // ✅ 彻底剥离多余内边距，让内部组件以 100% 占满全屏渲染
        contentClassName="flex flex-col flex-1 min-h-0 bg-[#111112] overflow-hidden p-0"
      >
        <ProjectHeader project={project} details={details} />
        <ProjectGallery project={project} details={details} isScrolled={isScrolled} showGallery={showGallery} setShowGallery={setShowGallery} />
        
        {/* ✅ 去除了多余的 DOM 嵌套和 FocusBoundary，现在 UI 只有极其干练的一层 */}
        <VersionFilters 
          versionsCount={versions.length}
          loaderOptions={loaderOptions} activeLoader={activeLoader} setActiveLoader={setActiveLoader}
          availableVersions={availableVersions} activeVersion={activeVersion} setActiveVersion={setActiveVersion}
        />
        
        <div className="flex-1 overflow-y-auto custom-scrollbar w-full relative z-10 shadow-[inset_0_10px_20px_-10px_rgba(0,0,0,0.8)]" onScroll={handleScroll}>
          <VersionList 
            versions={versions} isLoadingVersions={isLoadingVersions}
            activeVersion={activeVersion} activeLoader={activeLoader}
            displayVersions={displayVersions} installedVersionIds={installedVersionIds}
            onDownload={setPendingVersion} 
            visibleCount={visibleCount} observerTarget={observerTarget}
          />
        </div>
      </OreModal>

      {/* 弹窗部分 */}
      {activeTab === 'modpack' ? (
        <ModpackCreateModal 
          isOpen={!!pendingVersion} version={pendingVersion} project={project}
          onClose={() => setPendingVersion(null)}
          onConfirm={(instanceName) => { if (pendingVersion) onDownload(pendingVersion, instanceName); setPendingVersion(null); }}
        />
      ) : (
        <InstanceSelectModal 
          isOpen={!!pendingVersion} version={pendingVersion}
          onClose={() => setPendingVersion(null)}
          onConfirm={(instanceId) => { if (pendingVersion) onDownload(pendingVersion, instanceId); setPendingVersion(null); }}
          ignoreLoader={activeTab !== 'mod'}
        />
      )}
    </>
  );
};