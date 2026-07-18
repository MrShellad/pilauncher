import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import type { ModrinthProject, OreProjectVersion } from '../../InstanceDetail/logic/modrinthApi';
import { useDownloadDetail } from '../hooks/useDownloadDetail';
import type { DownloadInstanceConfig, DownloadSource } from '../hooks/useResourceDownload';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreOverlayScrollArea } from '../../../ui/primitives/OreOverlayScrollArea';
import { useScreenDensity } from '../../../hooks/ui/useScreenDensity';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';

import { InstanceSelectModal } from './DetailModal/InstanceSelectModal';
import { ModpackCreateModal } from './DetailModal/ModpackCreateModal';
import { ProjectGallery } from './DetailModal/ProjectGallery';
import { ProjectHeader } from './DetailModal/ProjectHeader';
import { VersionFilters } from './DetailModal/VersionFilters';
import { VersionList } from './DetailModal/VersionList';
import { ProjectDescriptionModal } from './DetailModal/ProjectDescriptionModal';

interface DownloadDetailModalProps {
  project: ModrinthProject | null;
  instanceConfig: DownloadInstanceConfig | null;
  onClose: () => void;
  onDownload: (version: OreProjectVersion, targetInstanceIdOrName: string | string[], autoInstallDeps?: boolean) => void | Promise<void>;
  installedVersionIds: string[];
  searchMcVersion?: string;
  searchLoader?: string;
  activeTab: 'mod' | 'resourcepack' | 'shader' | 'modpack';
  source: DownloadSource;
  directInstallInstanceIds?: string[];
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
  directInstallInstanceIds
}) => {
  const { t } = useTranslation();
  const density = useScreenDensity();
  const [detailTab, setDetailTab] = useState<'versions' | 'description'>('versions');
  const hasDirectInstall = !!(directInstallInstanceIds && directInstallInstanceIds.length > 0);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
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

  const [lastProject, setLastProject] = useState<ModrinthProject | null>(null);

  useEffect(() => {
    if (project) {
      setLastProject(project);
    } else {
      const timer = setTimeout(() => {
        setLastProject(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [project]);

  const displayProject = project || lastProject;

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
  } = useDownloadDetail(displayProject, instanceConfig, source, searchMcVersion, searchLoader, activeTab);

  const rawDescription = details?.body || details?.description || displayProject?.description || '';
  const htmlDescription = useMemo(() => {
    try {
      return marked.parse(rawDescription) as string;
    } catch {
      return rawDescription;
    }
  }, [rawDescription]);

  useEffect(() => {
    if (!project) return;
    setShowDescriptionModal(false);
    setIsScrolled(false);
  }, [project]);

  useEffect(() => {
    setVisibleCount(15);
  }, [activeLoader, activeVersion, versions]);

  useEffect(() => {
    didAutoFocusModalRef.current = false;
  }, [displayProject?.id]);

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
      const targetLoader = hasDirectInstall ? searchLoader : (activeLoader || searchLoader);
      const targetVersion = hasDirectInstall ? searchMcVersion : (activeVersion || searchMcVersion);

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
  }, [activeLoader, activeTab, activeVersion, hasDirectInstall, searchLoader, searchMcVersion, versions]);

  const displayVersions = strictlyFilteredVersions.slice(0, visibleCount);
  const currentDisplayLoader = hasDirectInstall ? searchLoader : (activeLoader || searchLoader);
  const currentDisplayVersion = hasDirectInstall ? searchMcVersion : (activeVersion || searchMcVersion);
  const controlsEnabled = !pendingVersion;



  useEffect(() => {
    if (!project || didAutoFocusModalRef.current) return;

    // Retry focusing the first version row if it hasn't rendered yet
    let retries = 0;
    const tryFocus = () => {
      if (doesFocusableExist('download-modal-version-row-0')) {
        didAutoFocusModalRef.current = true;
        setFocus('download-modal-version-row-0');
      } else if (!hasDirectInstall && doesFocusableExist('download-modal-mc-dropdown-0')) {
        didAutoFocusModalRef.current = true;
        setFocus('download-modal-mc-dropdown-0');
      } else if (retries < 5) {
        retries++;
        setTimeout(tryFocus, 100);
      }
    };
    
    // Slight initial delay to allow Modal animations
    setTimeout(tryFocus, 150);
  }, [hasDirectInstall, displayVersions.length, isLoadingVersions, project]);

  if (!displayProject) return null;

  return (
    <>
      <OreModal
        isOpen={!!project}
        onClose={onClose}
        hideTitleBar
        defaultFocusKey="download-modal-version-row-0"
        className="ore-download-detail-modal border-[0.1875rem] border-[#1E1E1F]"
        contentClassName="ore-download-detail-modal__content flex flex-1 min-h-0 flex-col overflow-hidden bg-[#313233] p-0"
      >
        <ProjectHeader project={displayProject} details={details} />

        {density === 'compact' && (
          <div className="flex border-b border-[#1E1E1F] bg-[#222324] shrink-0">
            <button
              onClick={() => setDetailTab('versions')}
              className={`flex-1 py-2 text-center font-minecraft font-bold text-xs border-b-2 transition-colors ${detailTab === 'versions' ? 'border-ore-green text-white bg-white/5' : 'border-transparent text-gray-400 hover:text-white'}`}
            >
              {t('download.detail.versions', '版本列表')}
            </button>
            <button
              onClick={() => setDetailTab('description')}
              className={`flex-1 py-2 text-center font-minecraft font-bold text-xs border-b-2 transition-colors ${detailTab === 'description' ? 'border-ore-green text-white bg-white/5' : 'border-transparent text-gray-400 hover:text-white'}`}
            >
              {t('download.detail.description', '项目描述')}
            </button>
          </div>
        )}

        {density !== 'compact' ? (
          <>
            <ProjectGallery
              project={displayProject}
              details={details}
              isScrolled={isScrolled}
              onOpenDescriptionModal={() => setShowDescriptionModal(true)}
              controlsEnabled={controlsEnabled}
            />

            {!hasDirectInstall && (
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

            <OreOverlayScrollArea
              ref={scrollContainerRef}
              className={`
                relative z-10 flex-1 w-full bg-[#313233] min-h-0
                ${hasDirectInstall ? 'border-t-[0.125rem] border-[#1E1E1F]' : ''}
              `}
              viewportClassName="shadow-[inset_0_0.625rem_1.25rem_-0.625rem_rgba(0,0,0,0.55)]"
              onScroll={handleScroll}
              contentSafePaddingRight={6}
            >
              <VersionList
                versions={strictlyFilteredVersions}
                isLoadingVersions={isLoadingVersions}
                activeVersion={currentDisplayVersion || ''}
                activeLoader={currentDisplayLoader || ''}
                displayVersions={displayVersions}
                installedVersionIds={installedVersionIds}
                onDownload={(version) => {
                  if (hasDirectInstall && directInstallInstanceIds) {
                    onDownload(version, directInstallInstanceIds);
                    onClose();
                  } else {
                    setPendingVersion(version);
                  }
                }}
                visibleCount={visibleCount}
                observerTarget={observerTarget}
              />
            </OreOverlayScrollArea>
          </>
        ) : (
          <>
            {detailTab === 'versions' ? (
              <>
                {!hasDirectInstall && (
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
                <OreOverlayScrollArea
                  ref={scrollContainerRef}
                  className={`
                    relative z-10 flex-1 w-full bg-[#313233] min-h-0
                    ${hasDirectInstall ? 'border-t-[0.125rem] border-[#1E1E1F]' : ''}
                  `}
                  viewportClassName="shadow-[inset_0_0.625rem_1.25rem_-0.625rem_rgba(0,0,0,0.55)]"
                  onScroll={handleScroll}
                  contentSafePaddingRight={6}
                >
                  <VersionList
                    versions={strictlyFilteredVersions}
                    isLoadingVersions={isLoadingVersions}
                    activeVersion={currentDisplayVersion || ''}
                    activeLoader={currentDisplayLoader || ''}
                    displayVersions={displayVersions}
                    installedVersionIds={installedVersionIds}
                    onDownload={(version) => {
                      if (hasDirectInstall && directInstallInstanceIds) {
                        onDownload(version, directInstallInstanceIds);
                        onClose();
                      } else {
                        setPendingVersion(version);
                      }
                    }}
                    visibleCount={visibleCount}
                    observerTarget={observerTarget}
                  />
                </OreOverlayScrollArea>
              </>
            ) : (
              <OreOverlayScrollArea
                className="relative z-10 flex-1 w-full bg-[#313233] min-h-0"
                viewportClassName="shadow-[inset_0_0.625rem_1.25rem_-0.625rem_rgba(0,0,0,0.55)] p-4"
                contentSafePaddingRight={6}
              >
                <div className="flex flex-col gap-4">
                  <ProjectGallery
                    project={displayProject}
                    details={details}
                    isScrolled={isScrolled}
                    onOpenDescriptionModal={() => setShowDescriptionModal(true)}
                    controlsEnabled={controlsEnabled}
                  />
                  <div
                    className="markdown-body font-minecraft text-xs leading-relaxed text-gray-300 break-words"
                    dangerouslySetInnerHTML={{ __html: htmlDescription }}
                  />
                </div>
              </OreOverlayScrollArea>
            )}
          </>
        )}
      </OreModal>

      {activeTab === 'modpack' ? (
        <ModpackCreateModal
          isOpen={!!pendingVersion}
          version={pendingVersion}
          project={displayProject}
          onClose={() => setPendingVersion(null)}
          onConfirm={(instanceName) => {
            if (pendingVersion) onDownload(pendingVersion, instanceName, false);
            setPendingVersion(null);
            onClose();
          }}
        />
      ) : (
        <InstanceSelectModal
          isOpen={!!pendingVersion && !hasDirectInstall}
          version={pendingVersion}
          projectId={displayProject.id || (displayProject as any).project_id}
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
          source={source}
        />
      )}
      <ProjectDescriptionModal
        isOpen={showDescriptionModal}
        project={displayProject}
        details={details}
        onClose={() => setShowDescriptionModal(false)}
      />
    </>
  );
};
