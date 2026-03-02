// /src/features/Download/components/DownloadDetailModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { OreModal } from '../../../ui/primitives/OreModal';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import type { ModrinthProject, OreProjectVersion } from '../../InstanceDetail/logic/modrinthApi';
import { useDownloadDetail } from '../hooks/useDownloadDetail';

import { ProjectHeader } from './DetailModal/ProjectHeader';
import { ProjectGallery } from './DetailModal/ProjectGallery';
import { VersionFilters } from './DetailModal/VersionFilters';
import { VersionList } from './DetailModal/VersionList';
// ✅ 引入新弹窗
import { InstanceSelectModal } from './DetailModal/InstanceSelectModal';

interface DownloadDetailModalProps {
  project: ModrinthProject | null;
  instanceConfig: any; 
  onClose: () => void;
  // ✅ 核心修改：暴露到顶层的 onDownload 现在的签名为 (版本对象, 选中的目标实例ID)
  onDownload: (version: OreProjectVersion, targetInstanceId: string) => void;
  installedVersionIds: string[]; 
  searchMcVersion?: string; 
  searchLoader?: string;
  activeTab: 'mod' | 'resourcepack' | 'shader';    
}

export const DownloadDetailModal: React.FC<DownloadDetailModalProps> = ({ 
  project, instanceConfig, onClose, onDownload, installedVersionIds, searchMcVersion, searchLoader, activeTab 
}) => {
  const [showGallery, setShowGallery] = useState(false);
  const [visibleCount, setVisibleCount] = useState(15);
  const [isScrolled, setIsScrolled] = useState(false);
  
  // ✅ 追踪用户点击下载时，准备要下载的那个具体版本
  const [pendingVersion, setPendingVersion] = useState<OreProjectVersion | null>(null);
  
  const observerTarget = useRef<HTMLDivElement>(null);

  const {
    details, versions, isLoadingVersions,
    activeLoader, setActiveLoader, activeVersion, setActiveVersion,
    loaderOptions, availableVersions
  } = useDownloadDetail(project, instanceConfig, searchMcVersion, searchLoader);

  useEffect(() => {
    if (project) {
      setShowGallery(false);
      setIsScrolled(false);
    }
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
      <OreModal isOpen={!!project} onClose={onClose} hideTitleBar={true} className="w-full max-w-5xl h-[85vh] p-0 overflow-hidden bg-[#111112]">
        <FocusBoundary id="download-detail-boundary" className="flex flex-col h-full relative">
          
          <ProjectHeader project={project} details={details} />
          <ProjectGallery project={project} details={details} isScrolled={isScrolled} showGallery={showGallery} setShowGallery={setShowGallery} />

          <div className="flex flex-col flex-1 min-h-0 bg-[#18181B]">
            <VersionFilters 
              versionsCount={versions.length}
              loaderOptions={loaderOptions} activeLoader={activeLoader} setActiveLoader={setActiveLoader}
              availableVersions={availableVersions} activeVersion={activeVersion} setActiveVersion={setActiveVersion}
            />

            <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10" onScroll={handleScroll}>
              <VersionList 
                versions={versions} isLoadingVersions={isLoadingVersions}
                activeVersion={activeVersion} activeLoader={activeLoader}
                displayVersions={displayVersions} installedVersionIds={installedVersionIds}
                // ✅ 点击下载时，唤醒实例选择弹窗
                onDownload={setPendingVersion} 
                visibleCount={visibleCount} observerTarget={observerTarget}
              />
            </div>
          </div>
        </FocusBoundary>
      </OreModal>

      {/* ✅ 挂载实例选择弹窗 */}
      <InstanceSelectModal 
        isOpen={!!pendingVersion}
        version={pendingVersion}
        onClose={() => setPendingVersion(null)}
        onConfirm={(instanceId) => {
          if (pendingVersion) onDownload(pendingVersion, instanceId);
          setPendingVersion(null);
        }}
        ignoreLoader={activeTab !== 'mod'}
      />
    </>
  );
};