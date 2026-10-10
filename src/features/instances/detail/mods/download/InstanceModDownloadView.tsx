import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { DownloadDetailModal } from '../../../../download';
import {
  ContextualActionBar,
  getContextualActionBarFocusKey
} from '../../../../download';
import { FavoritePlaceholderModal } from '../../../../library';
import {
  resolveInstanceGameVersion,
  resolveInstanceLoaderType,
  useResourceDownload,
  type DownloadSource
} from '../../../../download';
import { useIconCacheStore } from '../../../../download';
import {
  type ModrinthProject
} from '../../../../resource-catalog';
import { getInstalledVersionIds } from '../../../../instance-resources';
import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import { useInputAction } from '../../../../../ui/focus/InputDriver';
import { InstanceFilterBar } from './InstanceFilterBar';
import { MissingDependenciesModal } from './MissingDependenciesModal';
import { ResourceGrid } from './ResourceGrid';
import { useInstanceModDownloadActions } from './useInstanceModDownloadActions';
import { useInstanceDownloadSelectionStore } from '../hooks/useInstanceDownloadSelectionStore';
import { GamepadButtonIcon } from '../../../../../ui/components/GamepadButtonIcon';

const INSTANCE_DOWNLOAD_ACTION_BAR_FOCUS_PREFIX = 'instance-download-actions';
const INSTANCE_DOWNLOAD_GRID_FOCUS_PREFIX = 'download-grid-item-';

export const InstanceModDownloadView: React.FC<{
  instanceId: string;
  onBack: () => void;
  showFilterBackButton?: boolean;
  resourceTab?: 'mod' | 'resourcepack' | 'shader';
}> = ({
  instanceId,
  onBack,
  showFilterBackButton = true,
  resourceTab = 'mod'
}) => {
  const {
    activeTab,
    setActiveTab,
    query,
    setQuery,
    category,
    setCategory,
    sort,
    setSort,
    source,
    setSource,
    categoryOptions,
    results,
    offset,
    hasMore,
    isLoading,
    isLoadingMore,
    isEnvLoaded,
    installedMods,
    refreshInstalledMods,
    instanceConfig,
    resolvedMcVersion,
    resolvedLoaderType,
    mcVersionOptions,
    handleSearchClick,
    handleResetClick,
    loadMore,
    restoreState,
    loadMoreFailed,
    retryLoadMore
  } = useResourceDownload(instanceId, { lockInstanceEnvironment: true });
  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);
  const [selectedProjectIdForTransition, setSelectedProjectIdForTransition] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (selectedProject) {
      setSelectedProjectIdForTransition(selectedProject.id || (selectedProject as any).project_id);
    } else {
      const timer = setTimeout(() => {
        setSelectedProjectIdForTransition(undefined);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [selectedProject]);

  const [syncStep, setSyncStep] = useState(0);
  const [resultsScrollTop, setResultsScrollTop] = useState(0);
  const [isFavoriteModalOpen, setIsFavoriteModalOpen] = useState(false);

  interface DownloadHistoryItem {
    query: string;
    category: string;
    results: ModrinthProject[];
    offset: number;
    hasMore: boolean;
    scrollTop: number;
  }

  const [historyStack, setHistoryStack] = useState<DownloadHistoryItem[]>([]);
  const [prevResourceTab, setPrevResourceTab] = useState(resourceTab);
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab);

  if (resourceTab !== prevResourceTab || activeTab !== prevActiveTab) {
    setPrevResourceTab(resourceTab);
    setPrevActiveTab(activeTab);
    setHistoryStack([]);
  }

  const handleBackFromAuthor = useCallback(() => {
    if (historyStack.length === 0) return;

    const prevStack = [...historyStack];
    const lastState = prevStack.pop()!;
    setHistoryStack(prevStack);

    restoreState(
      lastState.query,
      lastState.category,
      lastState.results,
      lastState.offset,
      lastState.hasMore
    );

    setTimeout(() => {
      const scrollHost = document.getElementById('instance-mod-download-results');
      if (scrollHost) {
        scrollHost.scrollTop = lastState.scrollTop;
      }
    }, 50);
  }, [historyStack, restoreState]);

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        e.stopPropagation();
        handleBackFromAuthor();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleBackFromAuthor]);

  const selectedProjectIds = useInstanceDownloadSelectionStore((state) => state.selectedProjectIds);
  const selectedProjectsById = useInstanceDownloadSelectionStore((state) => state.selectedProjects);
  const selectedCount = useInstanceDownloadSelectionStore((state) => state.selectedCount);
  const isSelectionMode = useInstanceDownloadSelectionStore((state) => state.isSelectionMode);
  const getProjectKey = useInstanceDownloadSelectionStore((state) => state.getProjectKey);
  const toggleProjectSelection = useInstanceDownloadSelectionStore((state) => state.toggleProject);
  const clearDownloadSelection = useInstanceDownloadSelectionStore((state) => state.clearSelection);
  const lastListFocusBeforeActionBarRef = React.useRef<string>('download-grid-item-0');
  const lastFocusBeforeModalRef = React.useRef<string>('inst-filter-search');

  const isHintVisible = resultsScrollTop > 48;
  const targetMc = resolvedMcVersion || resolveInstanceGameVersion(instanceConfig);
  const targetLoader = resourceTab === 'mod'
    ? (resolvedLoaderType || resolveInstanceLoaderType(instanceConfig))
    : '';
  const installedVersionIds = useMemo(() => getInstalledVersionIds(installedMods), [installedMods]);
  const yHintText = useMemo(() => '回到顶部', []);
  const subFolder = resourceTab === 'shader'
    ? 'shaderpacks'
    : resourceTab === 'resourcepack'
      ? 'resourcepacks'
      : 'mods';
  const selectedProjects = useMemo(
    () => Object.values(selectedProjectsById),
    [selectedProjectsById]
  );
  const showBulkDownload = Boolean(
    selectedCount > 0 &&
    targetMc &&
    (resourceTab !== 'mod' || targetLoader)
  );

  const clearSelection = useCallback(() => {
    clearDownloadSelection();
    setIsFavoriteModalOpen(false);
  }, [clearDownloadSelection]);

  const {
    pendingDependencyVersion,
    missingDeps,
    autoInstallDeps,
    isCheckingDeps,
    isBatchDependency,
    batchCount,
    closeDependencyModal,
    toggleAutoInstallDeps,
    handleConfirmDependencyDownload,
    handleConfirmBatchDownload,
    handleDetailDownload,
    handleBatchDownload
  } = useInstanceModDownloadActions({
    instanceId,
    resourceTab,
    source,
    subFolder,
    targetMc,
    targetLoader,
    installedMods,
    refreshInstalledMods,
    selectedProject,
    selectedProjects,
    clearSelection
  });

  const handleToggleProjectSelection = useCallback((project: ModrinthProject) => {
    toggleProjectSelection(project);
  }, [toggleProjectSelection]);

  const getFocusedResultProject = useCallback(() => {
    const currentFocus = getCurrentFocusKey();
    if (!currentFocus?.startsWith(INSTANCE_DOWNLOAD_GRID_FOCUS_PREFIX)) return null;

    const index = Number(currentFocus.slice(INSTANCE_DOWNLOAD_GRID_FOCUS_PREFIX.length));
    if (!Number.isInteger(index) || index < 0) return null;
    return results[index] ?? null;
  }, [results]);

  useEffect(() => {
    setSyncStep(0);
  }, [instanceId, resourceTab, targetMc, targetLoader]);

  useEffect(() => {
    void refreshInstalledMods();
  }, [refreshInstalledMods]);

  useEffect(() => {
    if (!isEnvLoaded || !instanceConfig) return;

    if (syncStep === 0) {
      if (activeTab !== resourceTab) setActiveTab(resourceTab);
      setSyncStep(1);
      return;
    }

    if (syncStep === 1) {
      if (targetMc && activeTab === resourceTab) {
        handleSearchClick();
        setSyncStep(2);
      }
      return;
    }

    if (syncStep === 2) {
      const timer = setTimeout(() => setSyncStep(3), 150);
      return () => clearTimeout(timer);
    }
  }, [
    activeTab,
    handleSearchClick,
    instanceConfig,
    isEnvLoaded,
    resourceTab,
    setActiveTab,
    syncStep,
    targetMc
  ]);

  useEffect(() => {
    if (syncStep !== 3) return;
    const timer = setTimeout(() => setFocus('inst-filter-search'), 100);
    return () => clearTimeout(timer);
  }, [syncStep]);

  useInputAction('ACTION_Y', () => {
    const scrollHost = document.getElementById('instance-mod-download-results');
    if (scrollHost) {
      scrollHost.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setTimeout(() => setFocus('inst-filter-search'), 120);
  });

  useInputAction('ACTION_X', () => {
    if (selectedProject || isFavoriteModalOpen || pendingDependencyVersion) return;

    const project = getFocusedResultProject();
    if (!project) return;

    const currentFocus = getCurrentFocusKey();
    if (currentFocus) lastListFocusBeforeActionBarRef.current = currentFocus;
    handleToggleProjectSelection(project);
  });

  useInputAction('MENU', () => {
    if (!isSelectionMode || selectedProject || isFavoriteModalOpen || pendingDependencyVersion) return;

    const currentFocus = getCurrentFocusKey();
    const isActionBarFocused = Boolean(currentFocus?.startsWith(INSTANCE_DOWNLOAD_ACTION_BAR_FOCUS_PREFIX));

    if (isActionBarFocused) {
      const target = lastListFocusBeforeActionBarRef.current;
      if (target && doesFocusableExist(target)) {
        setFocus(target);
      } else if (doesFocusableExist('download-grid-item-0')) {
        setFocus('download-grid-item-0');
      }
      return;
    }

    if (currentFocus?.startsWith(INSTANCE_DOWNLOAD_GRID_FOCUS_PREFIX)) {
      lastListFocusBeforeActionBarRef.current = currentFocus;
    }

    const actionFocusKey = getContextualActionBarFocusKey(INSTANCE_DOWNLOAD_ACTION_BAR_FOCUS_PREFIX, showBulkDownload);
    if (doesFocusableExist(actionFocusKey)) {
      setFocus(actionFocusKey);
    }
  });











  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent">
      {/* Main page content wrapper, always mounted to prevent shifts and flash */}
      <FocusBoundary id="instance-mod-download-view" className="flex h-full w-full flex-col outline-none">
        <InstanceFilterBar
          onBack={onBack}
          showBackButton={showFilterBackButton}
          showBackFromAuthorButton={historyStack.length > 0}
          onBackFromAuthor={handleBackFromAuthor}
          resourceTab={resourceTab}
          lockedMcVersion={targetMc}
          lockedLoaderType={targetLoader}
          query={query}
          setQuery={setQuery}
          source={source}
          setSource={(value) => setSource(value as DownloadSource)}
          category={category}
          setCategory={setCategory}
          categoryOptions={categoryOptions}
          sort={sort}
          setSort={setSort}
          onSearch={handleSearchClick}
          onReset={handleResetClick}
        />

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border-2 border-[#1E1E1F] bg-black/20 shadow-inner">
          {isHintVisible && (
            <div className="pointer-events-none absolute right-4 top-4 z-50 flex items-center gap-2 rounded-sm border border-white/10 bg-black/85 px-3 py-2 text-xs font-minecraft tracking-wider text-gray-200 shadow-lg">
               <GamepadButtonIcon button="Y" size="sm" />
              <span className="mt-[0.0625rem]">{yHintText}</span>
            </div>
          )}

          <ResourceGrid
            key={`${source}-${resourceTab}`}
            results={results}
            installedMods={installedMods}
            isLoading={isLoading && results.length === 0}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            resourceTab={resourceTab}
            lockedMcVersion={targetMc}
            lockedLoaderType={targetLoader}
            onLoadMore={loadMore}
            onSelectProject={(project) => {
              const currentFocus = getCurrentFocusKey();
              if (currentFocus && currentFocus !== 'SN:ROOT') {
                lastFocusBeforeModalRef.current = currentFocus;
              }
              setSelectedProject(project);
              if (project.icon_url) {
                void useIconCacheStore.getState().refreshIcon(project.icon_url);
              }
            }}
            selectedProjectIds={selectedProjectIds}
            isSelectionMode={isSelectionMode}
            onToggleProjectSelection={handleToggleProjectSelection}
            getProjectKey={getProjectKey}
            scrollContainerId="instance-mod-download-results"
            onScrollTopChange={setResultsScrollTop}
            onClickAuthor={(author) => {
              setHistoryStack((prev) => [
                ...prev,
                {
                  query,
                  category,
                  results,
                  offset,
                  hasMore,
                  scrollTop: resultsScrollTop
                }
              ]);
              setCategory('');
              setQuery(author, true);
            }}
            selectedProjectId={selectedProjectIdForTransition}
            loadMoreFailed={loadMoreFailed}
            onRetryLoadMore={retryLoadMore}
          />

          <ContextualActionBar
            selectedCount={selectedCount}
            showBulkDownload={showBulkDownload}
            onBulkDownload={() => { void handleBatchDownload(); }}
            onAddFavorite={() => setIsFavoriteModalOpen(true)}
            onClear={clearSelection}
            focusKeyPrefix={INSTANCE_DOWNLOAD_ACTION_BAR_FOCUS_PREFIX}
          />
        </div>

        <DownloadDetailModal
          project={selectedProject}
          instanceConfig={instanceConfig}
          onClose={() => {
            setSelectedProject(null);
            setTimeout(() => {
              const lastFocus = lastFocusBeforeModalRef.current;
              if (lastFocus && doesFocusableExist(lastFocus)) {
                setFocus(lastFocus);
                return;
              }
              if (doesFocusableExist('download-grid-item-0')) {
                setFocus('download-grid-item-0');
                return;
              }
              setFocus('inst-filter-search');
            }, 50);
          }}
          onDownload={handleDetailDownload}
          installedVersionIds={installedVersionIds}
          searchMcVersion={targetMc}
          searchLoader={resourceTab === 'mod' ? targetLoader : ''}
          activeTab={resourceTab}
          source={source}
          directInstallInstanceIds={[instanceId]}
        />

        <MissingDependenciesModal
          isOpen={!!pendingDependencyVersion || isBatchDependency}
          version={pendingDependencyVersion}
          missingDeps={missingDeps}
          autoInstallDeps={autoInstallDeps}
          isChecking={isCheckingDeps}
          onToggleAutoInstall={toggleAutoInstallDeps}
          onClose={closeDependencyModal}
          onConfirm={isBatchDependency ? handleConfirmBatchDownload : handleConfirmDependencyDownload}
          isBatch={isBatchDependency}
          batchCount={batchCount}
        />

        <FavoritePlaceholderModal
          isOpen={isFavoriteModalOpen}
          projects={selectedProjects}
          onClose={() => setIsFavoriteModalOpen(false)}
          defaultGameVersion={targetMc}
          defaultLoader={targetLoader}
          mcVersionOptions={mcVersionOptions}
          onCreated={clearSelection}
        />
      </FocusBoundary>
    </div>
  );
};
