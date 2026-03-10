import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { OreModal } from '../../../ui/primitives/OreModal';
import type { ModrinthProject, OreProjectVersion } from '../../InstanceDetail/logic/modrinthApi';
import { useDownloadDetail } from '../hooks/useDownloadDetail';
import { ProjectHeader } from './DetailModal/ProjectHeader';
import { ProjectGallery } from './DetailModal/ProjectGallery';
import { VersionFilters } from './DetailModal/VersionFilters';
import { VersionList } from './DetailModal/VersionList';
import { InstanceSelectModal } from './DetailModal/InstanceSelectModal';
import { ModpackCreateModal } from './DetailModal/ModpackCreateModal';

interface DownloadInstanceConfig {
  game_version?: string;
  gameVersion?: string;
  loader_type?: string;
  loaderType?: string;
}

interface DownloadDetailModalProps {
  project: ModrinthProject | null;
  instanceConfig: DownloadInstanceConfig | null;
  onClose: () => void;
  onDownload: (version: OreProjectVersion, targetInstanceIdOrName: string) => void;
  installedVersionIds: string[];
  searchMcVersion?: string;
  searchLoader?: string;
  activeTab: 'mod' | 'resourcepack' | 'shader' | 'modpack';
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
  } = useDownloadDetail(project, instanceConfig, searchMcVersion, searchLoader);

  useEffect(() => {
    if (!project) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowGallery(false);
    setIsScrolled(false);
  }, [project]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleCount(15);
  }, [activeLoader, activeVersion, versions]);

  useEffect(() => {
    didAutoFocusModalRef.current = false;
  }, [project?.id]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 15);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrolled = e.currentTarget.scrollTop > 30;
    if (scrolled !== isScrolled) setIsScrolled(scrolled);
  };

  const strictlyFilteredVersions = useMemo(() => {
    if (!versions) return [];

    return versions.filter((version: OreProjectVersion) => {
      const targetLoader = directInstallInstanceId ? searchLoader : (activeLoader || searchLoader);
      const targetVersion = directInstallInstanceId ? searchMcVersion : (activeVersion || searchMcVersion);

      let matchLoader = true;
      if (activeTab === 'mod' && targetLoader && targetLoader.toLowerCase() !== 'all') {
        matchLoader = version.loaders.some((loader: string) => loader.toLowerCase() === targetLoader.toLowerCase());
      }

      let matchVersion = true;
      if (targetVersion && targetVersion.toLowerCase() !== 'all') {
        matchVersion = version.game_versions.includes(targetVersion);
      }

      return matchLoader && matchVersion;
    });
  }, [
    versions,
    directInstallInstanceId,
    searchLoader,
    searchMcVersion,
    activeLoader,
    activeVersion,
    activeTab
  ]);

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
  }, [project, directInstallInstanceId, isLoadingVersions, displayVersions.length]);

  if (!project) return null;

  return (
    <>
      <OreModal
        isOpen={!!project}
        onClose={onClose}
        hideTitleBar
        defaultFocusKey="download-modal-version-action-0"
        className="h-[90vh] w-[1180px] max-w-[96vw]"
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--ore-downloadDetail-base)] p-0"
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
            relative z-10 min-h-0 flex-1 overflow-y-auto custom-scrollbar w-full bg-[var(--ore-downloadDetail-base)]
            ${directInstallInstanceId ? 'border-t-[2px] border-[var(--ore-downloadDetail-divider)]' : ''}
          `}
          style={{ boxShadow: 'var(--ore-downloadDetail-listShadow)' }}
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
                onDownload(version, directInstallInstanceId);
                onClose();
                return;
              }

              setPendingVersion(version);
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
            if (pendingVersion) onDownload(pendingVersion, instanceName);
            setPendingVersion(null);
            onClose();
          }}
        />
      ) : (
        <InstanceSelectModal
          isOpen={!!pendingVersion && !directInstallInstanceId}
          version={pendingVersion}
          onClose={() => setPendingVersion(null)}
          onConfirm={(instanceId) => {
            if (pendingVersion) onDownload(pendingVersion, instanceId);
            setPendingVersion(null);
            onClose();
          }}
          ignoreLoader={activeTab !== 'mod'}
        />
      )}
    </>
  );
};
