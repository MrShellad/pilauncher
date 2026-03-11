import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import type { ModrinthProject, OreProjectVersion } from '../../InstanceDetail/logic/modrinthApi';
import { useDownloadDetail } from '../hooks/useDownloadDetail';
import type { DownloadInstanceConfig, DownloadSource } from '../hooks/useResourceDownload';
import { OreModal } from '../../../ui/primitives/OreModal';

import { InstanceSelectModal } from './DetailModal/InstanceSelectModal';
import { ModpackCreateModal } from './DetailModal/ModpackCreateModal';
import { ProjectGallery } from './DetailModal/ProjectGallery';
import { ProjectHeader } from './DetailModal/ProjectHeader';
import { VersionFilters } from './DetailModal/VersionFilters';
import { VersionList } from './DetailModal/VersionList';

interface DownloadDetailModalProps {
  project: ModrinthProject | null;
  instanceConfig: DownloadInstanceConfig | null;
  onClose: () => void;
  onDownload: (version: OreProjectVersion, targetInstanceIdOrName: string, autoInstallDeps?: boolean) => void;
  installedVersionIds: string[];
  searchMcVersion?: string;
  searchLoader?: string;
  activeTab: 'mod' | 'resourcepack' | 'shader' | 'modpack';
  source: DownloadSource;
  directInstallInstanceId?: string;
}

export const DownloadDetailModal: React.FC<DownloadDetailModalProps> = ({
  project,
  instanceConfig,
  onClose,
  onDownload,
  installedVersionIds,
  searchMcVersion,
  searchLoader,
  activeTab,
  source,
  directInstallInstanceId
}) => {
  const [showGallery, setShowGallery] = useState(false);
  const [visibleCount, setVisibleCount] = useState(15);
  const [isScrolled, setIsScrolled] = useState(false);
  const [pendingVersion, setPendingVersion] = useState<OreProjectVersion | null>(null);

  const observerTarget = useRef<HTMLDivElement>(null);
  const didAutoFocusModalRef = useRef(false);

  const {
    details,
    versions,
    isLoadingVersions,
    activeLoader,
    setActiveLoader,
    activeVersion,
    setActiveVersion,
    loaderOptions,
    availableVersions
  } = useDownloadDetail(project, instanceConfig, source, searchMcVersion, searchLoader);

  useEffect(() => {
    if (!project) return;
    setShowGallery(false);
    setIsScrolled(false);
  }, [project]);

  useEffect(() => {
    setVisibleCount(15);
  }, [activeLoader, activeVersion, versions]);

  useEffect(() => {
    didAutoFocusModalRef.current = false;
  }, [project?.id]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount((prev) => prev + 15);
      }
    }, { threshold: 0.1 });

    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, []);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const scrolled = event.currentTarget.scrollTop > 30;
    if (scrolled !== isScrolled) setIsScrolled(scrolled);
  };

  const strictlyFilteredVersions = useMemo(() => {
    return versions.filter((version) => {
      const targetLoader = directInstallInstanceId ? searchLoader : (activeLoader || searchLoader);
      const targetVersion = directInstallInstanceId ? searchMcVersion : (activeVersion || searchMcVersion);

      let matchLoader = true;
      if (activeTab === 'mod' && targetLoader && targetLoader.toLowerCase() !== 'all') {
        matchLoader = version.loaders.some((loader) => loader.toLowerCase() === targetLoader.toLowerCase());
      }

      let matchVersion = true;
      if (targetVersion && targetVersion.toLowerCase() !== 'all') {
        matchVersion = version.game_versions.includes(targetVersion);
      }

      return matchLoader && matchVersion;
    });
  }, [activeLoader, activeTab, activeVersion, directInstallInstanceId, searchLoader, searchMcVersion, versions]);

  const displayVersions = strictlyFilteredVersions.slice(0, visibleCount);
  const currentDisplayLoader = directInstallInstanceId ? searchLoader : (activeLoader || searchLoader);
  const currentDisplayVersion = directInstallInstanceId ? searchMcVersion : (activeVersion || searchMcVersion);

  useEffect(() => {
    if (!project || didAutoFocusModalRef.current) return;

    const candidates = [
      'download-modal-version-action-0',
      !directInstallInstanceId ? 'download-modal-mc-dropdown-0' : undefined
    ].filter(Boolean) as string[];

    const target = candidates.find((key) => doesFocusableExist(key));
    if (!target) return;

    didAutoFocusModalRef.current = true;
    const timer = setTimeout(() => setFocus(target), 50);
    return () => clearTimeout(timer);
  }, [directInstallInstanceId, displayVersions.length, isLoadingVersions, project]);

  if (!project) return null;

  return (
    <>
      <OreModal
        isOpen={!!project}
        onClose={onClose}
        hideTitleBar
        defaultFocusKey="download-modal-version-action-0"
        className="h-[85vh] w-[1080px] max-w-[95vw] border-[3px] border-[#1E1E1F]"
        contentClassName="flex flex-1 min-h-0 flex-col overflow-hidden bg-[#313233] p-0"
      >
        <ProjectHeader project={project} details={details} />
        <ProjectGallery
          project={project}
          details={details}
          isScrolled={isScrolled}
          showGallery={showGallery}
          setShowGallery={setShowGallery}
        />

        {!directInstallInstanceId && (
          <VersionFilters
            versionsCount={strictlyFilteredVersions.length}
            loaderOptions={loaderOptions}
            activeLoader={activeLoader}
            setActiveLoader={setActiveLoader}
            availableVersions={availableVersions}
            activeVersion={activeVersion}
            setActiveVersion={setActiveVersion}
          />
        )}

        <div
          className={`
            relative z-10 flex-1 w-full overflow-y-auto custom-scrollbar bg-[#313233]
            shadow-[inset_0_10px_20px_-10px_rgba(0,0,0,0.55)]
            ${directInstallInstanceId ? 'border-t-[2px] border-[#1E1E1F]' : ''}
          `}
          onScroll={handleScroll}
        >
          <VersionList
            versions={strictlyFilteredVersions}
            isLoadingVersions={isLoadingVersions}
            activeVersion={currentDisplayVersion || ''}
            activeLoader={currentDisplayLoader || ''}
            displayVersions={displayVersions}
            installedVersionIds={installedVersionIds}
            onDownload={(version) => {
              if (directInstallInstanceId) {
                onDownload(version, directInstallInstanceId, false);
                onClose();
              } else {
                setPendingVersion(version);
              }
            }}
            visibleCount={visibleCount}
            observerTarget={observerTarget}
          />
        </div>
      </OreModal>

      {activeTab === 'modpack' ? (
        <ModpackCreateModal
          isOpen={!!pendingVersion}
          version={pendingVersion}
          project={project}
          onClose={() => setPendingVersion(null)}
          onConfirm={(instanceName) => {
            if (pendingVersion) onDownload(pendingVersion, instanceName, false);
            setPendingVersion(null);
            onClose();
          }}
        />
      ) : (
        <InstanceSelectModal
          isOpen={!!pendingVersion && !directInstallInstanceId}
          version={pendingVersion}
          onClose={() => setPendingVersion(null)}
          onConfirm={(instanceId, autoInstallDeps) => {
            if (pendingVersion) onDownload(pendingVersion, instanceId, autoInstallDeps);
            setPendingVersion(null);
            onClose();
          }}
          ignoreLoader={activeTab !== 'mod'}
        />
      )}
    </>
  );
};
