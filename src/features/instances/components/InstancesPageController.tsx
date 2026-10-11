import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGroup } from 'motion/react';

import { useScreenDensity } from '@/hooks/ui/useScreenDensity';
import { FocusBoundary } from '@/ui/focus/FocusBoundary';
import { focusManager } from '@/ui/focus/FocusManager';
import { OreOverlayScrollArea } from '@/ui/primitives/OreOverlayScrollArea';
import { useInstances } from '../hooks/useInstances';
import { useThirdPartyImport } from '../hooks/useThirdPartyImport';
import { InstanceCardView } from './InstanceCardView';
import { InstanceListView } from './InstanceListView';
import { InstancesPageOverlays } from './InstancesPageOverlays';
import { InstancesToolbar } from './InstancesToolbar';
import { ThirdPartyImportPanel } from './third-party-import/ThirdPartyImportPanel';

export const InstancesPageController: React.FC = () => {
  const { t } = useTranslation();
  const density = useScreenDensity();
  const cardTier =
    density === 'compact' || density === 'deck'
      ? 'sm'
      : density === 'wide' || density === 'tv'
        ? 'lg'
        : 'md';
  const {
    instances,
    filteredInstances,
    availableTags,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    selectedTags,
    setSelectedTags,
    loadInstances,
    handleCreate,
    handleEdit,
    handleCardClick,
  } = useInstances();

  const {
    isPanelOpen,
    setIsPanelOpen,
    importSources,
    isDetectingSources,
    importState,
    isImporting,
    closeImportModal,
    confirmDownloadMissing,
    refreshImportSources,
    inspectThirdPartySource,
    handleImportSource,
  } = useThirdPartyImport({ onImportSuccess: () => loadInstances(true) });

  const [isDirModalOpen, setIsDirModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isImportOptionModalOpen, setIsImportOptionModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('ore-instance-view-mode') as 'list' | 'grid') || 'grid';
  });

  const hasAutoFocused = React.useRef(false);

  useEffect(() => {
    localStorage.setItem('ore-instance-view-mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (hasAutoFocused.current) return;

    const timer = setTimeout(() => {
      if (filteredInstances.length > 0) {
        hasAutoFocused.current = true;
        const firstInstanceFocusKey =
          viewMode === 'list'
            ? `list-play-${filteredInstances[0].id}`
            : `card-play-${filteredInstances[0].id}`;
        focusManager.focus(firstInstanceFocusKey);
      } else if (instances.length === 0) {
        hasAutoFocused.current = true;
        focusManager.focus('action-new');
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [filteredInstances, instances, viewMode]);

  const handleSelectDirectory = (path: string) => {
    setIsDirModalOpen(false);
    setTimeout(() => {
      void inspectThirdPartySource(path);
    }, 150);
  };

  const handleChooseManualImport = () => {
    setIsImportOptionModalOpen(false);
    setIsDirModalOpen(true);
  };

  const handleDetectSources = () => {
    setIsImportOptionModalOpen(false);
    void refreshImportSources();
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags((previousTags) =>
      previousTags.includes(tag)
        ? previousTags.filter((currentTag) => currentTag !== tag)
        : [...previousTags, tag]
    );
  };

  return (
    <FocusBoundary
      id="instances-page"
      isActive={!isDirModalOpen}
      className="flex h-full w-full flex-col overflow-hidden px-6 pb-6 pt-1 sm:px-8 sm:pb-8 sm:pt-2 md:pt-4"
    >
      <h1 className="sr-only">{t('nav.instances', '实例')}</h1>

      <InstancesToolbar
        density={density}
        viewMode={viewMode}
        searchQuery={searchQuery}
        sortBy={sortBy}
        selectedTagCount={selectedTags.length}
        isDetectingSources={isDetectingSources}
        isImporting={isImporting}
        onToggleView={() => setViewMode((current) => (current === 'grid' ? 'list' : 'grid'))}
        onSearchChange={setSearchQuery}
        onSortChange={setSortBy}
        onOpenTags={() => setIsTagModalOpen(true)}
        onCreate={handleCreate}
        onOpenImport={() => setIsImportOptionModalOpen(true)}
      />

      <ThirdPartyImportPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        importSources={importSources}
        isDetectingSources={isDetectingSources}
        isImporting={isImporting}
        handleImportSource={handleImportSource}
      />

      <OreOverlayScrollArea
        className="min-h-0 flex-1"
        role="list"
        aria-label={t('instancesPage.listLabel', '我的游戏实例列表')}
        viewportClassName="px-1.5 pb-10 pt-3 sm:px-2"
        safeInsetTop={6}
        contentSafePaddingRight={0}
        contentClassName={`
          ${
            viewMode === 'grid'
              ? cardTier === 'sm'
                ? 'grid grid-cols-[repeat(auto-fill,288px)] content-start justify-center gap-4 w-full'
                : cardTier === 'lg'
                  ? 'grid grid-cols-[repeat(auto-fill,400px)] content-start justify-center gap-6 w-full'
                  : 'grid grid-cols-[repeat(auto-fill,336px)] content-start justify-center gap-5 w-full'
              : 'grid grid-cols-1 content-start gap-3 auto-rows-max'
          }
        `}
      >
        <LayoutGroup id="instances-layout-group">
          {filteredInstances.map((instance) =>
            viewMode === 'list' ? (
              <InstanceListView
                key={instance.id}
                instance={instance}
                onClick={() => handleCardClick(instance.id)}
                onEdit={() => handleEdit(instance.id)}
              />
            ) : (
              <InstanceCardView
                key={instance.id}
                instance={instance}
                onClick={() => handleCardClick(instance.id)}
                onEdit={() => handleEdit(instance.id)}
                tier={cardTier}
              />
            )
          )}
        </LayoutGroup>
      </OreOverlayScrollArea>

      <InstancesPageOverlays
        isDirModalOpen={isDirModalOpen}
        isImportOptionModalOpen={isImportOptionModalOpen}
        isTagModalOpen={isTagModalOpen}
        importState={importState}
        isImporting={isImporting}
        availableTags={availableTags}
        selectedTags={selectedTags}
        onCloseDirectoryBrowser={() => setIsDirModalOpen(false)}
        onSelectDirectory={handleSelectDirectory}
        onCloseImportModal={closeImportModal}
        onConfirmDownloadMissing={confirmDownloadMissing}
        onCloseImportOptions={() => setIsImportOptionModalOpen(false)}
        onChooseManualImport={handleChooseManualImport}
        onDetectSources={handleDetectSources}
        onCloseTagModal={() => setIsTagModalOpen(false)}
        onToggleTag={handleToggleTag}
        onClearTags={() => setSelectedTags([])}
      />
    </FocusBoundary>
  );
};

export default InstancesPageController;
