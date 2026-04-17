import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import type { ModrinthProject, OreProjectVersion } from '../../InstanceDetail/logic/modrinthApi';
import { useDownloadDetail } from '../hooks/useDownloadDetail';
import type { DownloadInstanceConfig, DownloadSource } from '../hooks/useResourceDownload';
import { OreModal } from '../../../ui/primitives/OreModal';
import '../../../style/ui/primitives/DownloadDetailModal.css';

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
  onDownload: (version: OreProjectVersion, targetInstanceIdOrName: string, autoInstallDeps?: boolean) => void | Promise<void>;
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

  const observer = useRef<IntersectionObserver | null>(null);

  const observerTarget = useCallback((node: HTMLDivElement | null) => {
    if (observer.current) observer.current.disconnect();
    if (node) {
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 15);
        }
      }, { threshold: 0.1 });
      observer.current.observe(node);
    }
  }, []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
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
  } = useDownloadDetail(project, instanceConfig, source, searchMcVersion, searchLoader, activeTab);
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
    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, []);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const scrolled = event.currentTarget.scrollTop > 30;
    if (scrolled !== isScrolled) setIsScrolled(scrolled);
  };

  const strictlyFilteredVersions = useMemo(() => {
    return versions.map(v => {
      if (activeTab === 'mod') {
        const validModLoaders = ['fabric', 'forge', 'neoforge'];
        return {
          ...v,
          loaders: v.loaders.filter(l => validModLoaders.includes(l.toLowerCase()))
        };
      }
      return v;
    }).filter((version) => {
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
  const galleryCount = details?.gallery_urls?.length ?? project?.gallery_urls?.length ?? 0;
  const controlsEnabled = !pendingVersion;

  const handleToggleGallery = useCallback(() => {
    if (!galleryCount || !controlsEnabled) return;
    if (document.querySelector('.ore-dropdown-panel')) return;

    setShowGallery((prev) => {
      const next = !prev;
      if (next) {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return next;
    });
  }, [controlsEnabled, galleryCount]);

  useEffect(() => {
    if (!project || didAutoFocusModalRef.current) return;

    // Retry focusing the first version row if it hasn't rendered yet
    let retries = 0;
    const tryFocus = () => {
      if (doesFocusableExist('download-modal-version-row-0')) {
        didAutoFocusModalRef.current = true;
        setFocus('download-modal-version-row-0');
      } else if (!directInstallInstanceId && doesFocusableExist('download-modal-mc-dropdown-0')) {
        didAutoFocusModalRef.current = true;
        setFocus('download-modal-mc-dropdown-0');
      } else if (retries < 5) {
        retries++;
        setTimeout(tryFocus, 100);
      }
    };
    
    // Slight initial delay to allow Modal animations
    setTimeout(tryFocus, 150);
  }, [directInstallInstanceId, displayVersions.length, isLoadingVersions, project]);

  if (!project) return null;

  return (
    <>
      <OreModal
        isOpen={!!project}
        onClose={onClose}
        hideTitleBar
        defaultFocusKey="download-modal-version-row-0"
        className="ore-download-detail-modal border-[3px] border-[#1E1E1F]"
        contentClassName="ore-download-detail-modal__content flex flex-1 min-h-0 flex-col overflow-hidden bg-[#313233] p-0"
      >
        <ProjectHeader project={project} details={details} />
        <ProjectGallery
          project={project}
          details={details}
          isScrolled={isScrolled}
          showGallery={showGallery}
          onToggleGallery={handleToggleGallery}
          controlsEnabled={controlsEnabled}
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
            controlsEnabled={controlsEnabled}
          />
        )}

        <div
          ref={scrollContainerRef}
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
                onDownload(version, directInstallInstanceId);
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
          projectId={project.id || (project as any).project_id}
          onClose={() => setPendingVersion(null)}
          onConfirm={(instanceIds, autoInstallDeps) => {
            const version = pendingVersion;
            if (version) {
              void Promise.allSettled(
                instanceIds.map((instanceId) => Promise.resolve(onDownload(version, instanceId, autoInstallDeps)))
              );
            }
            setPendingVersion(null);
            onClose();
          }}
          ignoreLoader={activeTab !== 'mod'}
        />
      )}
    </>
  );
};
