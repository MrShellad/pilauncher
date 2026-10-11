import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Blocks, Image as ImageIcon, Package, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ContextualActionBar } from './ContextualActionBar';
import { DownloadDetailModal } from './DownloadDetailModal';
import { FilterBar } from './FilterBar';
import { InstanceSelectModal } from './detail-modal/InstanceSelectModal';
import { ResourceGrid } from './ResourceGrid';
import { type ModrinthProject } from '@/features/resource-catalog';
import { useResourceDownload, type TabType } from '../hooks/useResourceDownload';
import { useResourceDownloadActions } from '../hooks/useResourceDownloadActions';
import {
  DOWNLOAD_ACTION_BAR_FOCUS_PREFIX,
  useResourceDownloadSelection,
} from '../hooks/useResourceDownloadSelection';
import { useLauncherStore } from '@/app/stores/useLauncherStore';
import { FocusBoundary } from '@/ui/focus/FocusBoundary';
import type { DropdownOption } from '@/ui/primitives/OreDropdown';

interface DownloadHistoryItem {
  query: string;
  category: string;
  results: ModrinthProject[];
  offset: number;
  hasMore: boolean;
  scrollTop: number;
}

export interface ResourceDownloadFavoriteModalProps {
  isOpen: boolean;
  projects: ModrinthProject[];
  onClose: () => void;
  resourceType: Extract<TabType, 'mod' | 'resourcepack' | 'shader'>;
  defaultGameVersion: string;
  defaultLoader: string;
  mcVersionOptions: DropdownOption[];
  onCreated: () => void;
}

interface ResourceDownloadPageControllerProps {
  FavoriteModal: React.ComponentType<ResourceDownloadFavoriteModalProps>;
}

export const ResourceDownloadPageController: React.FC<ResourceDownloadPageControllerProps> = ({
  FavoriteModal,
}) => {
  const { t } = useTranslation();
  const instanceId = useLauncherStore((state) => state.selectedInstanceId);
  const currentGlobalTab = useLauncherStore((state) => state.activeTab);

  const tabs: { id: TabType; label: string; icon: LucideIcon }[] = [
    { id: 'mod', label: t('download.tabs.mod', { defaultValue: 'Mods' }), icon: Blocks },
    { id: 'resourcepack', label: t('download.tabs.resourcepack', { defaultValue: 'Resource Packs' }), icon: Package },
    { id: 'shader', label: t('download.tabs.shader', { defaultValue: 'Shaders' }), icon: ImageIcon }
  ];

  const {
    activeTab,
    setActiveTab,
    query,
    setQuery,
    mcVersion,
    setMcVersion,
    loaderType,
    setLoaderType,
    category,
    setCategory,
    sort,
    setSort,
    source,
    setSource,
    results,
    offset,
    hasMore,
    isLoading,
    isLoadingMore,
    isEnvLoaded,
    installedMods,
    installedModIndex,
    refreshInstalledMods,
    instanceConfig,
    mcVersionOptions,
    categoryOptions,
    isCurseForgeAvailable,
    handleSearchClick,
    handleResetClick,
    loadMore,
    restoreState,
    loadMoreFailed,
    retryLoadMore
  } = useResourceDownload(instanceId);

  const {
    selectedProject,
    selectedProjectIdForTransition,
    selectedProjectIds,
    selectedProjects,
    selectedCount,
    isSelectionMode,
    selectionEnabled,
    showBulkDownload,
    favoriteResourceType,
    batchRepresentativeVersion,
    isFavoriteModalOpen,
    isBatchInstanceModalOpen,
    getProjectKey,
    handleSelectProject,
    handleToggleProjectSelection,
    clearSelection,
    closeSelectedProject,
    openFavoriteModal,
    closeFavoriteModal,
    openBatchInstanceModal,
    closeBatchInstanceModal,
  } = useResourceDownloadSelection({
    activeTab,
    currentGlobalTab,
    isEnvLoaded,
    results,
    mcVersion,
    loaderType,
  });

  const {
    installedVersionIds,
    handleStartDownload,
    handleBatchDownloadConfirm,
  } = useResourceDownloadActions({
    activeTab,
    instanceConfig,
    instanceId,
    loaderType,
    mcVersion,
    installedMods,
    refreshInstalledMods,
    selectedProject,
    selectedProjects,
    source,
    closeBatchInstanceModal,
    clearSelection,
    t,
  });

  const [resultsScrollTop, setResultsScrollTop] = useState(0);

  const [historyStack, setHistoryStack] = useState<DownloadHistoryItem[]>([]);
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab);

  if (activeTab !== prevActiveTab) {
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
      const scrollHost = document.getElementById('resource-download-results');
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
  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent">
      {/* Main content wrapper, always mounted to prevent layout jumps and allow smooth reveal */}
      <motion.div
        key="page-content"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="h-full w-full"
      >
        <FocusBoundary id="resource-download-page" trapFocus={true} className="relative flex h-full w-full flex-col bg-transparent text-white">
          <h1 className="sr-only">{t('download.title', '资源下载')}</h1>
          <FilterBar
            activeTab={activeTab}
            tabs={tabs}
            onTabChange={setActiveTab}
            query={query}
            setQuery={setQuery}
            source={source}
            setSource={setSource}
            mcVersion={mcVersion}
            setMcVersion={setMcVersion}
            loaderType={loaderType}
            setLoaderType={setLoaderType}
            category={category}
            setCategory={setCategory}
            sort={sort}
            setSort={setSort}
            mcVersionOptions={mcVersionOptions}
            categoryOptions={categoryOptions}
            isCurseForgeAvailable={isCurseForgeAvailable}
            onSearch={handleSearchClick}
            onReset={handleResetClick}
          />

          <ResourceGrid
            key={`${source}-${activeTab}`}
            results={results}
            installedMods={installedMods}
            installedModIndex={installedModIndex}
            isLoading={isLoading && results.length === 0}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            categoryOptions={categoryOptions}
            onLoadMore={loadMore}
            onSelectProject={handleSelectProject}
            selectedProjectIds={selectionEnabled ? selectedProjectIds : undefined}
            isSelectionMode={selectionEnabled && isSelectionMode}
            onToggleProjectSelection={selectionEnabled ? handleToggleProjectSelection : undefined}
            getProjectKey={getProjectKey}
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
            scrollContainerId="resource-download-results"
            onScrollTopChange={setResultsScrollTop}
            loadMoreFailed={loadMoreFailed}
            onRetryLoadMore={retryLoadMore}
          />

          {selectionEnabled && (
            <ContextualActionBar
              selectedCount={selectedCount}
              showBulkDownload={showBulkDownload}
              onBulkDownload={openBatchInstanceModal}
              onAddFavorite={openFavoriteModal}
              onClear={clearSelection}
              focusKeyPrefix={DOWNLOAD_ACTION_BAR_FOCUS_PREFIX}
              favoriteLabel={
                activeTab === 'resourcepack'
                  ? '收藏资源包'
                  : activeTab === 'shader'
                  ? '收藏光影'
                  : '加入收藏'
              }
            />
          )}

          <DownloadDetailModal
            project={selectedProject}
            instanceConfig={instanceConfig}
            onClose={closeSelectedProject}
            onDownload={handleStartDownload}
            installedVersionIds={installedVersionIds}
            searchMcVersion={mcVersion}
            searchLoader={loaderType}
            activeTab={activeTab}
            source={source}
          />

          <FavoriteModal
            isOpen={isFavoriteModalOpen}
            projects={selectedProjects}
            onClose={closeFavoriteModal}
            resourceType={favoriteResourceType}
            defaultGameVersion={mcVersion && mcVersion !== 'all' ? mcVersion : ''}
            defaultLoader={loaderType && loaderType !== 'all' ? loaderType : ''}
            mcVersionOptions={mcVersionOptions}
            onCreated={clearSelection}
          />

          <InstanceSelectModal
            isOpen={isBatchInstanceModalOpen}
            version={batchRepresentativeVersion}
            onClose={closeBatchInstanceModal}
            onConfirm={(instanceIds) => {
              void handleBatchDownloadConfirm(instanceIds);
            }}
            ignoreLoader={activeTab !== 'mod'}
            source={source}
          />
        </FocusBoundary>
      </motion.div>
    </div>
  );
};

export default ResourceDownloadPageController;
