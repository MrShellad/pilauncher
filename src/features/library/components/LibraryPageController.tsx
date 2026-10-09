import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'motion/react';
import { AddLibraryResourceModal } from './modals/AddLibraryResourceModal';
import { ManageLinkageModal } from './modals/ManageLinkageModal';
import { EditLibraryResourceModal } from './modals/EditLibraryResourceModal';
import { useTranslation } from 'react-i18next';

import { useLibraryStore } from '../stores/useLibraryStore';
import { DownloadDetailModal } from '@/features/download';
import { CollectionSidebar } from './CollectionSidebar';
import { CollectionCard } from './CollectionCard';
import { CollectionMetadataModal } from './CollectionMetadataModal';
import { LibraryEmptyState } from './LibraryEmptyState';
import { LibraryContextMenu } from './LibraryContextMenu';
import { LibraryHeader, type LibraryHeaderView } from './LibraryHeader';
import { LibraryResourceList } from './LibraryResourceList';
import { LibraryToolbar } from './LibraryToolbar';
import { ModSetTrackerPanel } from './ModSetTrackerPanel';
import { DeleteModSetModal } from './modals/DeleteModSetModal';
import { FavoriteDeleteModal } from './modals/FavoriteDeleteModal';
import { LibraryCloudSyncModal } from './modals/LibraryCloudSyncModal';
import { LibraryImportPreviewModal } from './modals/LibraryImportPreviewModal';
import { LibraryTagModal } from './modals/LibraryTagModal';
import {
  LIBRARY_EMPTY_ACTIONS,
} from '../data/libraryPageData';
import { useLibraryPage } from '../hooks/useLibraryPage';
import { useLibraryBackup } from '../hooks/useLibraryBackup';
import { useLibraryCollectionOrdering } from '../hooks/useLibraryCollectionOrdering';
import { useLibraryContextMenu } from '../hooks/useLibraryContextMenu';
import { useLibraryFocusNavigation } from '../hooks/useLibraryFocusNavigation';
import { useLibraryRelations } from '../hooks/useLibraryRelations';
import { useLibraryResourceDetail } from '../hooks/useLibraryResourceDetail';
import { LibraryInstanceSelectModal } from './modals/LibraryInstanceSelectModal';

import { useModSetTrackerStore, type ModSetTrackerItemStatus } from '../stores/useModSetTrackerStore';
import { useLauncherStore } from '@/app/stores/useLauncherStore';
import { FocusBoundary } from '@/ui/focus/FocusBoundary';
import { ControlHint } from '@/ui/components/ControlHint';
import type { DropdownOption } from '@/ui/primitives/OreDropdown';
import { OreOverlayScrollArea } from '@/ui/primitives/OreOverlayScrollArea';
import type { VersionGroup } from '@/features/instances';
import type { Collection } from '@/types/library';
import {
  toLibraryResource,
  type LibraryResourceViewModel,
} from '../logic/libraryItems';
import {
  LIBRARY_COLLECTION_FOCUS_PREFIX,
  LOADER_OPTIONS,
  getCollectionItemTrackerKeys,
} from '../logic/libraryPageUtils';

export const LibraryPageController: React.FC = () => {
  const { t } = useTranslation();
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const currentGlobalTab = useLauncherStore((state) => state.activeTab);
  const trackers = useModSetTrackerStore((state) => state.trackers);
  const isCheckingTrackers = useModSetTrackerStore((state) => state.isChecking);
  const loadTrackers = useModSetTrackerStore((state) => state.loadTrackers);
  const checkTracker = useModSetTrackerStore((state) => state.checkTracker);
  const removeTracker = useModSetTrackerStore((state) => state.removeTracker);
  const updateTrackerTarget = useModSetTrackerStore((state) => state.updateTrackerTarget);
  const removeTrackersForCollection = useModSetTrackerStore((state) => state.removeTrackersForCollection);
  const syncCollectionTrackers = useModSetTrackerStore((state) => state.syncCollectionTrackers);
  const renameTrackersForCollection = useModSetTrackerStore((state) => state.renameTrackersForCollection);
  const removeCollection = useLibraryStore((state) => state.removeCollection);
  const updateCollection = useLibraryStore((state) => state.updateCollection);
  const starredItems = useLibraryStore((state) => state.items);
  const collectionItems = useLibraryStore((state) => state.collectionItems);
  const removeStarredItem = useLibraryStore((state) => state.removeStarredItem);
  const initializeLibrary = useLibraryStore((state) => state.initializeLibrary);
  const {
    collections,
    density,
    isLoading,
    initialized,
    searchQuery,
    setSearchQuery,
    selectedGroupId,
    setSelectedGroupId,
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    selectedCollection,
    visibleResources,
    createTagCollection,
    isCategoryView,
    visibleCollections,
    parentCategoryId,
  } = useLibraryPage();


  const [isLibraryInstanceSelectOpen, setIsLibraryInstanceSelectOpen] = useState(false);
  const [pendingLibraryResource, setPendingLibraryResource] = useState<LibraryResourceViewModel | null>(null);

  const [isTrackerModalOpen, setIsTrackerModalOpen] = useState(false);
  const [directInstallTrackerId, setDirectInstallTrackerId] = useState<string | null>(null);
  const [minecraftVersionOptions, setMinecraftVersionOptions] = useState<DropdownOption[]>([]);
  const [isDeleteModSetOpen, setIsDeleteModSetOpen] = useState(false);
  const [isDeletingModSet, setIsDeletingModSet] = useState(false);
  const [removeFavoritesWithModSet, setRemoveFavoritesWithModSet] = useState(true);
  const [deleteModSetSelectedItemIds, setDeleteModSetSelectedItemIds] = useState<Set<string>>(() => new Set());
  const [favoriteDeleteTarget, setFavoriteDeleteTarget] = useState<LibraryResourceViewModel | null>(null);
  const [isDeletingFavoriteItem, setIsDeletingFavoriteItem] = useState(false);
  const [editingCollectionMetadata, setEditingCollectionMetadata] = useState<Collection | null>(null);
  const [isSavingCollectionMetadata, setIsSavingCollectionMetadata] = useState(false);
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);
  const [selectedLibraryResource, setSelectedLibraryResource] = useState<LibraryResourceViewModel | null>(null);
  const [isManageLinkageOpen, setIsManageLinkageOpen] = useState(false);
  const [isEditResourceOpen, setIsEditResourceOpen] = useState(false);
  const {
    pendingRelationKeys,
    relationError,
    setRelationError,
    tagCollections,
    tagTargetItem,
    tagTargetTagIds,
    tagTargetHasPendingRelation,
    closeTagModal,
    openTagModal,
    removeItemFromCollectionWithTracking,
    toggleItemTag,
  } = useLibraryRelations();
  const {
    detailProject,
    detailSource,
    detailTab,
    directInstallInstanceIds,
    searchMcVersion,
    searchLoader,
    openResourceDetail,
    openResourceDetailWithInstances,
    closeResourceDetail,
    handleLibraryDetailDownload,
  } = useLibraryResourceDetail();
  const {
    isBusy: isLibraryBackupBusy,
    isCloudModalOpen: isLibraryCloudModalOpen,
    isSyncingWebDav: isLibraryWebDavSyncing,
    syncHistory: librarySyncHistory,
    importDraft: libraryImportDraft,
    closeImportPreview,
    openCloudModal,
    closeCloudModal,
    exportLibrary,
    openImportLibrary,
    syncWebDavFavorites,
    toggleImportTagMerge,
    confirmImportLibrary,
  } = useLibraryBackup({ onMessage: setRelationError });
  const selectedCollectionTrackers = useMemo(() => {
    if (selectedCollection?.type !== 'mod_set') return [];
    return trackers
      .filter((tracker) => tracker.collectionId === selectedCollection.id)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [selectedCollection, trackers]);
  const selectedModSetTracker =
    selectedCollectionTrackers.find((tracker) => tracker.readyCount > 0) || selectedCollectionTrackers[0] || null;
  const showModSetDeployAction = selectedCollection?.type === 'mod_set';
  const canEditSelectedCollectionMetadata =
    selectedCollection?.type === 'mod_set' || selectedCollection?.type === 'modpack';
  const canSortSelectedCollection = Boolean(
    selectedCollection &&
    (selectedCollection.type === 'group' || selectedCollection.type === 'mod_set' || selectedCollection.type === 'modpack'),
  );
  const collectionSortModeDisabled =
    !canSortSelectedCollection || Boolean(searchQuery.trim()) || activeFilter !== 'all' || sortBy !== 'manual';
  const {
    isCollectionSortMode,
    isCollectionReordering,
    moveItem: handleMoveCollectionItem,
    placeItem: handlePlaceCollectionItem,
  } = useLibraryCollectionOrdering({
    selectedCollection,
    collectionItems,
    disabled: collectionSortModeDisabled,
    onError: setRelationError,
  });
  const selectedTrackerStatusByKey = useMemo(() => {
    const statusByKey = new Map<string, ModSetTrackerItemStatus>();
    selectedModSetTracker?.items.forEach((item) => {
      statusByKey.set(item.itemId.toLowerCase(), item.status);
      statusByKey.set(`${item.source}:${item.projectId}`.toLowerCase(), item.status);
      statusByKey.set(item.projectId.toLowerCase(), item.status);
    });
    return statusByKey;
  }, [selectedModSetTracker]);

  const getTrackerStatusForResource = (item: typeof visibleResources[number]) => {
    const keys = [
      item.id,
      item.item.projectId,
      item.item.projectId ? `${item.source}:${item.item.projectId}` : undefined,
    ]
      .filter((key): key is string => Boolean(key))
      .map((key) => key.toLowerCase());

    for (const key of keys) {
      const status = selectedTrackerStatusByKey.get(key);
      if (status) return status;
    }
    return undefined;
  };

  const finalVisibleResources = visibleResources;

  const finalHighlightedItems = useMemo(() => {
    return finalVisibleResources.filter((item) => item.hasUpdate || item.pinned);
  }, [finalVisibleResources]);

  const hasQuery = searchQuery.trim() !== '' || activeFilter !== 'all';
  const isInitialLoading = !initialized && isLoading;
  const activeHeaderView: LibraryHeaderView = selectedGroupId === 'category_modsets' || selectedCollection?.type === 'mod_set'
    ? 'mod_set'
    : selectedGroupId === 'category_modpacks' || selectedCollection?.type === 'modpack'
      ? 'modpack'
      : activeFilter === 'mod'
        ? 'mod'
        : activeFilter === 'external'
          ? 'external'
          : 'all';

  const handleHeaderViewChange = (view: LibraryHeaderView) => {
    if (view === 'mod_set') {
      setSelectedGroupId('category_modsets');
      setActiveFilter('all');
      return;
    }

    if (view === 'modpack') {
      setSelectedGroupId('category_modpacks');
      setActiveFilter('all');
      return;
    }

    setSelectedGroupId('all');
    setActiveFilter(view === 'all' ? 'all' : view);
  };

  const activeHeaderViewLabel: Record<LibraryHeaderView, string> = {
    all: t('libraryPage.views.all'),
    mod: t('libraryPage.views.mod'),
    mod_set: t('libraryPage.views.modSet'),
    modpack: t('libraryPage.views.modpack'),
    external: t('libraryPage.views.external'),
  };
  const modSetTrackerSyncTargets = useMemo(() => (
    collections
      .filter((collection) => collection.type === 'mod_set')
      .map((collection) => ({
        collectionId: collection.id,
        keys: collectionItems
          .filter((relation) => relation.collectionId === collection.id)
          .flatMap(getCollectionItemTrackerKeys)
          .sort(),
      }))
  ), [collectionItems, collections]);
  const selectedModSetResources = useMemo(() => {
    if (selectedCollection?.type !== 'mod_set') return [];

    const itemMap = new Map(starredItems.map((item) => [item.id, item]));
    return collectionItems
      .filter((relation) => relation.collectionId === selectedCollection.id)
      .sort((a, b) => a.position - b.position)
      .map((relation) => itemMap.get(relation.itemId))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map(toLibraryResource);
  }, [collectionItems, selectedCollection, starredItems]);
  useEffect(() => {
    void loadTrackers();
  }, [loadTrackers]);

  useEffect(() => {
    const isEditingModSet = editingCollectionMetadata?.type === 'mod_set';
    if (!isEditingModSet || minecraftVersionOptions.length > 0) return;

    invoke<VersionGroup[]>('get_minecraft_versions', { force: false })
      .then((groups) => {
        const options = groups
          .flatMap((group) => group.versions)
          .filter((version) => version.type === 'release')
          .map((version) => ({ label: version.id, value: version.id }));
        setMinecraftVersionOptions(options);
      })
      .catch((error) => {
        console.error('[LibraryPage] failed to load Minecraft versions for tracker edit', error);
      });
  }, [editingCollectionMetadata, minecraftVersionOptions.length]);

  useEffect(() => {
    modSetTrackerSyncTargets.forEach((target) => {
      syncCollectionTrackers(target.collectionId, target.keys);
    });
  }, [modSetTrackerSyncTargets, syncCollectionTrackers]);

  const handleEntryAction = (id: string) => {
    if (id === 'browse' || id === 'download') {
      setActiveTab('downloads');
    }
  };

  const handleSaveTracking = (gameVersion: string, loader: string) => {
    if (!selectedModSetTracker) return;
    updateTrackerTarget(selectedModSetTracker.id, gameVersion, loader);
    void checkTracker(selectedModSetTracker.id);
  };

  const editingCollectionTrackingInfo = useMemo(() => {
    if (editingCollectionMetadata?.type !== 'mod_set') return null;
    const tracker = trackers
      .filter((t) => t.collectionId === editingCollectionMetadata.id)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!tracker) return null;
    return {
      gameVersion: tracker.gameVersion,
      loader: tracker.loader,
      trackerId: tracker.id,
    };
  }, [editingCollectionMetadata, trackers]);

  const openCollectionMetadataEdit = (collection?: Collection | null) => {
    if (!collection || (collection.type !== 'mod_set' && collection.type !== 'modpack')) return;
    setEditingCollectionMetadata(collection);
  };

  const handleSaveCollectionMetadata = async (nextCollection: Collection) => {
    if (isSavingCollectionMetadata) return;

    setIsSavingCollectionMetadata(true);
    try {
      await updateCollection(nextCollection);
      if (nextCollection.type === 'mod_set') {
        renameTrackersForCollection(nextCollection.id, nextCollection.name);
      }
      setEditingCollectionMetadata(null);
    } finally {
      setIsSavingCollectionMetadata(false);
    }
  };

  const handleDeleteModSet = async () => {
    if (!selectedCollection || selectedCollection.type !== 'mod_set' || isDeletingModSet) return;

    setIsDeletingModSet(true);
    try {
      if (removeFavoritesWithModSet) {
        for (const itemId of deleteModSetSelectedItemIds) {
          await removeStarredItem(itemId);
        }
      }
      await removeCollection(selectedCollection.id);
      removeTrackersForCollection(selectedCollection.id);
      setIsDeleteModSetOpen(false);
      setSelectedGroupId('category_modsets');
    } finally {
      setIsDeletingModSet(false);
    }
  };

  const openDeleteModSetModal = () => {
    setRemoveFavoritesWithModSet(true);
    setDeleteModSetSelectedItemIds(new Set(selectedModSetResources.map((item) => item.id)));
    setIsDeleteModSetOpen(true);
  };

  const toggleDeleteModSetItem = (itemId: string) => {
    setDeleteModSetSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const selectAllDeleteModSetItems = () => {
    setDeleteModSetSelectedItemIds(new Set(selectedModSetResources.map((item) => item.id)));
  };

  const invertDeleteModSetItems = () => {
    setDeleteModSetSelectedItemIds((current) => {
      const next = new Set<string>();
      selectedModSetResources.forEach((item) => {
        if (!current.has(item.id)) next.add(item.id);
      });
      return next;
    });
  };

  const handleDeleteFavoriteItem = async () => {
    if (!favoriteDeleteTarget || isDeletingFavoriteItem) return;

    setIsDeletingFavoriteItem(true);
    try {
      if (favoriteDeleteTarget.type === 'shader' || favoriteDeleteTarget.type === 'resourcepack') {
        await invoke('delete_library_resource', { resourceId: favoriteDeleteTarget.id });
        void initializeLibrary();
      } else {
        await removeStarredItem(favoriteDeleteTarget.id);
      }
      setFavoriteDeleteTarget(null);
    } catch (e) {
      console.error(e);
      setRelationError(`删除失败: ${String(e)}`);
    } finally {
      setIsDeletingFavoriteItem(false);
    }
  };

  const {
    contextMenu,
    setContextMenu,
    contextMenuActions,
    handleItemContextMenu,
    handleCollectionContextMenu,
    handleOpenItem,
    handleOpenFocusedResourceContextMenu,
  } = useLibraryContextMenu({
    visibleResources,
    visibleCollections,
    selectedCollection,
    selectedGroupId,
    selectedModSetResources,
    pendingRelationKeys,
    setSelectedGroupId,
    removeItemFromCollectionWithTracking,
    openTagModal,
    openResourceDetail,
    openCollectionMetadataEdit,
    setFavoriteDeleteTarget,
    setPendingLibraryResource,
    setIsLibraryInstanceSelectOpen,
    setSelectedLibraryResource,
    setIsManageLinkageOpen,
    setIsEditResourceOpen,
    setDeleteModSetSelectedItemIds,
    setIsDeleteModSetOpen,
  });

  const hasBlockingOverlay = Boolean(
    contextMenu ||
    tagTargetItem ||
    detailProject ||
    favoriteDeleteTarget ||
    isDeleteModSetOpen ||
    isTrackerModalOpen ||
    editingCollectionMetadata ||
    libraryImportDraft ||
    isAddResourceModalOpen ||
    isManageLinkageOpen ||
    isEditResourceOpen ||
    isLibraryInstanceSelectOpen
  );

  const { activeSection, handleContentArrow } = useLibraryFocusNavigation({
    currentGlobalTab,
    hasBlockingOverlay,
    isCollectionSortMode,
    isCategoryView,
    parentCategoryId,
    visibleResourceCount: finalVisibleResources.length,
    visibleCollectionCount: visibleCollections.length,
    setSelectedGroupId,
    onOpenFocusedResourceContextMenu: handleOpenFocusedResourceContextMenu,
  });

  return (
    <FocusBoundary
      id="library-page"
      defaultFocusKey="library-search"
      className="flex h-full w-full flex-col overflow-hidden bg-[rgba(18,18,19,0.86)] font-sans text-[var(--ore-color-text-primary-default)]"
    >
      <h1 className="sr-only">{t('nav.library', '收藏库')}</h1>
      <LibraryHeader
        activeView={activeHeaderView}
        onViewChange={handleHeaderViewChange}
      />

      <ModSetTrackerPanel
        isOpen={isTrackerModalOpen}
        onClose={() => setIsTrackerModalOpen(false)}
        trackers={trackers}
        isChecking={isCheckingTrackers}
        onCheck={(trackerId) => { void checkTracker(trackerId); }}
        onRemove={removeTracker}
        directInstallTrackerId={directInstallTrackerId}
        onDirectInstallHandled={() => setDirectInstallTrackerId(null)}
      />

      <CollectionMetadataModal
        collection={editingCollectionMetadata}
        isSaving={isSavingCollectionMetadata}
        onClose={() => {
          if (!isSavingCollectionMetadata) {
            setEditingCollectionMetadata(null);
          }
        }}
        onSave={handleSaveCollectionMetadata}
        trackingInfo={editingCollectionTrackingInfo}
        onSaveTracking={handleSaveTracking}
        trackingVersionOptions={minecraftVersionOptions}
        trackingLoaderOptions={LOADER_OPTIONS}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="w-[272px] shrink-0 overflow-hidden border-r-2 border-[var(--ore-library-sidebar-panel-border)] bg-[var(--ore-color-background-surface-raised)]">
          <CollectionSidebar
            focusable={activeSection === 'sidebar'}
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
            collections={collections}
            onCreateCollection={createTagCollection}
            onUpdateCollection={updateCollection}
            onRemoveCollection={removeCollection}
          />
        </div>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <LibraryToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterOptions={[]}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            visibleCount={isCategoryView ? visibleCollections.length : finalVisibleResources.length}
            selectedCollectionName={
              isCategoryView
                ? selectedGroupId === 'category_modpacks'
                  ? t('libraryPage.views.modpack')
                  : t('libraryPage.views.modSet')
                : selectedCollection?.name ?? activeHeaderViewLabel[activeHeaderView]
            }
            highlightedItems={finalHighlightedItems}
            onBack={parentCategoryId ? () => setSelectedGroupId(parentCategoryId) : undefined}
            showDeployAction={showModSetDeployAction}
            deployDisabled={!selectedModSetTracker || selectedModSetTracker.readyCount <= 0}
            trackerCount={selectedModSetTracker?.totalCount ?? 0}
            readyTrackerCount={selectedModSetTracker?.readyCount ?? 0}
            onOpenModSetDeploy={() => {
              if (selectedModSetTracker) {
                setDirectInstallTrackerId(selectedModSetTracker.id);
              }
            }}
            showCollectionEditAction={canEditSelectedCollectionMetadata}
            collectionEditLabel={selectedCollection?.type === 'modpack' ? t('libraryPage.toolbar.editModpack') : t('libraryPage.toolbar.editModSet')}
            onEditCollectionMetadata={() => openCollectionMetadataEdit(selectedCollection)}
            showBackupActions
            backupActionDisabled={isLibraryBackupBusy || isLibraryWebDavSyncing}
            onOpenBackupActions={openCloudModal}
            showModSetManageActions={showModSetDeployAction}
            onDeleteModSet={openDeleteModSetModal}
            showAddResource={activeFilter === 'external'}
            onAddResource={() => setIsAddResourceModalOpen(true)}
          />

          {relationError && !tagTargetItem && (
            <div className="shrink-0 border-b-2 border-[var(--ore-color-border-danger-subtle)] bg-[var(--ore-color-background-danger-muted)] px-5 py-2 font-minecraft text-sm text-[var(--ore-color-text-danger-soft)]">
              {relationError}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-hidden">
            {isInitialLoading || (isCategoryView ? visibleCollections.length === 0 : finalVisibleResources.length === 0) ? (
              <OreOverlayScrollArea className="h-full">
                <div className="p-5">
                  <LibraryEmptyState
                    isLoading={isInitialLoading}
                    hasQuery={hasQuery}
                    actions={LIBRARY_EMPTY_ACTIONS}
                    onAction={handleEntryAction}
                  />
                </div>
              </OreOverlayScrollArea>
            ) : isCategoryView ? (
              <OreOverlayScrollArea className="h-full">
                <div className="p-5">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-[repeat(auto-fill,216px)] gap-5 justify-start"
                  >
                    {visibleCollections.map((collection, index) => (
                      <CollectionCard
                        key={collection.id}
                        collection={collection}
                        onClick={() => setSelectedGroupId(collection.id)}
                        onContextMenu={handleCollectionContextMenu}
                        focusKey={`${LIBRARY_COLLECTION_FOCUS_PREFIX}${index}`}
                        onArrowPress={(direction) => handleContentArrow(index, direction)}
                        onEdit={
                          collection.type === 'mod_set' || collection.type === 'modpack'
                            ? openCollectionMetadataEdit
                            : undefined
                        }
                      />
                    ))}
                  </motion.div>
                </div>
              </OreOverlayScrollArea>
            ) : (
              <LibraryResourceList
                items={finalVisibleResources}
                density={density}
                getTrackerStatus={showModSetDeployAction ? getTrackerStatusForResource : undefined}
                onContextMenu={handleItemContextMenu}
                onOpenItem={handleOpenItem}
                onItemArrowPress={handleContentArrow}
                activeContextItemId={contextMenu?.type === 'resource' ? contextMenu?.item?.id : undefined}
                sortMode={isCollectionSortMode && !collectionSortModeDisabled && !isCollectionReordering}
                onMoveItem={handleMoveCollectionItem}
                onPlaceItem={handlePlaceCollectionItem}
              />
            )}
          </div>

          <div className="flex h-10 shrink-0 items-center justify-between border-t-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] px-5 text-xs text-[var(--ore-color-text-muted-default)]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <ControlHint label="Y" variant="face" tone="yellow" />
                <span className="font-minecraft">{t('libraryPage.hints.switchSection')}</span>
              </div>
              {!isCategoryView && visibleResources.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <ControlHint label="X" variant="face" tone="blue" />
                  <span className="font-minecraft">{t('libraryPage.hints.contextMenu')}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <ControlHint label="LT" variant="trigger" tone="neutral" />
                <ControlHint label="RT" variant="trigger" tone="neutral" />
                <span className="font-minecraft">{t('libraryPage.hints.switchTab')}</span>
              </div>
            </div>
          </div>
        </main>
      </div>

      {contextMenu && contextMenuActions.length > 0 && (
        <LibraryContextMenu
          anchorRect={contextMenu.anchorRect}
          triggerPoint={contextMenu.triggerPoint}
          actions={contextMenuActions}
          onClose={() => setContextMenu(null)}
        />
      )}

      <LibraryCloudSyncModal
        isOpen={isLibraryCloudModalOpen}
        isBusy={isLibraryBackupBusy}
        isSyncingWebDav={isLibraryWebDavSyncing}
        records={librarySyncHistory}
        onClose={closeCloudModal}
        onExportLibrary={() => {
          closeCloudModal();
          void exportLibrary();
        }}
        onImportLibrary={() => {
          closeCloudModal();
          void openImportLibrary();
        }}
        onSyncWebDav={() => {
          void syncWebDavFavorites();
        }}
      />

      <LibraryImportPreviewModal
        draft={libraryImportDraft}
        isBusy={isLibraryBackupBusy}
        errorMessage={relationError}
        onClose={closeImportPreview}
        onToggleMergeTags={() => { void toggleImportTagMerge(); }}
        onConfirm={() => { void confirmImportLibrary(); }}
      />

      <LibraryTagModal
        item={tagTargetItem}
        tags={tagCollections}
        activeTagIds={tagTargetTagIds}
        pendingRelationKeys={pendingRelationKeys}
        relationError={relationError}
        hasPendingRelation={tagTargetHasPendingRelation}
        onClose={closeTagModal}
        onToggleTag={(tagId) => { void toggleItemTag(tagId); }}
      />

      <DownloadDetailModal
        project={detailProject}
        instanceConfig={null}
        onClose={closeResourceDetail}
        onDownload={handleLibraryDetailDownload}
        installedVersionIds={[]}
        activeTab={detailTab}
        source={detailSource}
        directInstallInstanceIds={directInstallInstanceIds}
        searchMcVersion={searchMcVersion}
        searchLoader={searchLoader}
      />

      <LibraryInstanceSelectModal
        isOpen={isLibraryInstanceSelectOpen}
        onClose={() => {
          setIsLibraryInstanceSelectOpen(false);
          setPendingLibraryResource(null);
        }}
        resource={pendingLibraryResource}
        onConfirm={(instanceIds) => {
          if (pendingLibraryResource) {
            openResourceDetailWithInstances(pendingLibraryResource, instanceIds);
          }
        }}
      />

      <FavoriteDeleteModal
        target={favoriteDeleteTarget}
        isDeleting={isDeletingFavoriteItem}
        onClose={() => {
          if (!isDeletingFavoriteItem) setFavoriteDeleteTarget(null);
        }}
        onConfirm={() => { void handleDeleteFavoriteItem(); }}
      />

      <AddLibraryResourceModal
        isOpen={isAddResourceModalOpen}
        onClose={() => setIsAddResourceModalOpen(false)}
        onSuccess={() => void initializeLibrary()}
      />

      <ManageLinkageModal
        isOpen={isManageLinkageOpen}
        onClose={() => {
          setIsManageLinkageOpen(false);
          setSelectedLibraryResource(null);
        }}
        resource={selectedLibraryResource}
      />

      <EditLibraryResourceModal
        isOpen={isEditResourceOpen}
        onClose={() => {
          setIsEditResourceOpen(false);
          setSelectedLibraryResource(null);
        }}
        resource={selectedLibraryResource}
        onSuccess={() => void initializeLibrary()}
      />

      <DeleteModSetModal
        isOpen={isDeleteModSetOpen}
        collectionName={selectedCollection?.name || ''}
        isDeleting={isDeletingModSet}
        removeFavoritesWithModSet={removeFavoritesWithModSet}
        selectedItemIds={deleteModSetSelectedItemIds}
        resources={selectedModSetResources}
        onClose={() => {
          if (!isDeletingModSet) setIsDeleteModSetOpen(false);
        }}
        onConfirm={() => { void handleDeleteModSet(); }}
        onToggleRemoveFavorites={() => setRemoveFavoritesWithModSet((current) => !current)}
        onToggleItem={toggleDeleteModSetItem}
        onSelectAll={selectAllDeleteModSetItems}
        onInvert={invertDeleteModSetItems}
      />
    </FocusBoundary>
  );
};

export default LibraryPageController;
