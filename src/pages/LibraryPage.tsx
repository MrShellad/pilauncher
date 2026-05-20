import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { motion } from 'framer-motion';
import { Eye, Tags, Trash2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useLibraryStore } from '../stores/useLibraryStore';
import { DownloadDetailModal } from '../features/Download/components/DownloadDetailModal';
import { CollectionSidebar } from '../features/Library/components/CollectionSidebar';
import { CollectionCard } from '../features/Library/components/CollectionCard';
import { CollectionMetadataModal } from '../features/Library/components/CollectionMetadataModal';
import { LibraryEmptyState } from '../features/Library/components/LibraryEmptyState';
import {
  LibraryContextMenu,
  type LibraryContextMenuAction,
  type LibraryContextMenuAnchor,
  type LibraryContextMenuPoint,
} from '../features/Library/components/LibraryContextMenu';
import { LibraryHeader, type LibraryHeaderView } from '../features/Library/components/LibraryHeader';
import { LibraryResourceList } from '../features/Library/components/LibraryResourceList';
import { LibraryToolbar } from '../features/Library/components/LibraryToolbar';
import { ModSetTrackerPanel } from '../features/Library/components/ModSetTrackerPanel';
import { DeleteModSetModal } from '../features/Library/components/modals/DeleteModSetModal';
import { FavoriteDeleteModal } from '../features/Library/components/modals/FavoriteDeleteModal';
import { LibraryCloudSyncModal } from '../features/Library/components/modals/LibraryCloudSyncModal';
import { LibraryImportPreviewModal } from '../features/Library/components/modals/LibraryImportPreviewModal';
import { LibraryTagModal } from '../features/Library/components/modals/LibraryTagModal';
import {
  LIBRARY_EMPTY_ACTIONS,
} from '../features/Library/data/libraryPageData';
import { useLibraryPage } from '../features/Library/hooks/useLibraryPage';
import { useLibraryBackup } from '../features/Library/hooks/useLibraryBackup';
import { useLibraryCollectionOrdering } from '../features/Library/hooks/useLibraryCollectionOrdering';
import { useLibraryRelations } from '../features/Library/hooks/useLibraryRelations';
import { useLibraryResourceDetail } from '../features/Library/hooks/useLibraryResourceDetail';
import { useModSetTrackerStore, type ModSetTrackerItemStatus } from '../features/Library/stores/useModSetTrackerStore';
import { useLauncherStore } from '../store/useLauncherStore';
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { useInputMode } from '../ui/focus/FocusProvider';
import { useInputAction } from '../ui/focus/InputDriver';
import type { DropdownOption } from '../ui/primitives/OreDropdown';
import { OreOverlayScrollArea } from '../ui/primitives/OreOverlayScrollArea';
import type { VersionGroup } from '../features/Instances/logic/environmentSelection';
import type { Collection } from '../types/library';
import {
  toLibraryResource,
  type LibraryResourceViewModel,
} from '../features/Library/logic/libraryItems';
import {
  LIBRARY_COLLECTION_FOCUS_PREFIX,
  LIBRARY_RESOURCE_FOCUS_PREFIX,
  LOADER_OPTIONS,
  getCollectionItemTrackerKeys,
  getRelationPendingKey,
  getRemoveContextLabel,
  toDetailProject,
} from '../features/Library/logic/libraryPageUtils';

const LibraryPage: React.FC = () => {
  const { t } = useTranslation();
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const currentGlobalTab = useLauncherStore((state) => state.activeTab);
  const inputMode = useInputMode();
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
  const didInitialControllerFocusRef = useRef(false);
  const [contextMenu, setContextMenu] = useState<{
    item: LibraryResourceViewModel;
    anchorRect: LibraryContextMenuAnchor;
    triggerPoint: LibraryContextMenuPoint;
  } | null>(null);
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
    openResourceDetail,
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

  const hasQuery = searchQuery.trim() !== '' || activeFilter !== 'all';
  const highlightedItems = visibleResources.filter((item) => item.hasUpdate || item.pinned);
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
  const canRemoveContextItemFromCurrentCollection = Boolean(
    contextMenu?.item &&
    selectedCollection &&
    collectionItems.some(
      (relation) =>
        relation.collectionId === selectedCollection.id &&
        relation.itemId === contextMenu.item.id,
    ),
  );
  const contextRemoveRelationKey =
    contextMenu?.item && selectedCollection
      ? getRelationPendingKey(selectedCollection.id, contextMenu.item.id)
      : '';
  const isContextRemovePending = Boolean(
    contextRemoveRelationKey && pendingRelationKeys.has(contextRemoveRelationKey),
  );
  const getFocusedResource = () => {
    const currentFocus = getCurrentFocusKey();
    if (!currentFocus?.startsWith(LIBRARY_RESOURCE_FOCUS_PREFIX)) return null;

    const index = Number(currentFocus.slice(LIBRARY_RESOURCE_FOCUS_PREFIX.length));
    if (!Number.isInteger(index) || index < 0) return null;
    return visibleResources[index] ?? null;
  };
  const getFocusedCollection = () => {
    const currentFocus = getCurrentFocusKey();
    if (!currentFocus?.startsWith(LIBRARY_COLLECTION_FOCUS_PREFIX)) return null;

    const index = Number(currentFocus.slice(LIBRARY_COLLECTION_FOCUS_PREFIX.length));
    if (!Number.isInteger(index) || index < 0) return null;
    return visibleCollections[index] ?? null;
  };
  const getControllerAnchorForFocusKey = (focusKey: string) => {
    const element = document.querySelector<HTMLElement>(
      `[data-library-resource-focus-key="${focusKey}"]`,
    );
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    return {
      anchorRect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      },
      triggerPoint: {
        x: rect.right - Math.min(28, rect.width / 4),
        y: rect.top + Math.min(28, rect.height / 3),
      },
    };
  };

  const handleItemContextMenu = (
    event: React.MouseEvent<HTMLElement>,
    item: LibraryResourceViewModel,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    setContextMenu({
      item,
      anchorRect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      },
      triggerPoint: {
        x: event.clientX,
        y: event.clientY,
      },
    });
  };

  const handleRemoveContextItemFromCollection = async () => {
    if (!contextMenu?.item || !selectedCollection) return;
    const item = contextMenu.item;
    const collection = selectedCollection;

    setContextMenu(null);
    await removeItemFromCollectionWithTracking(collection, item);
  };

  const handleOpenTagModal = () => {
    if (!contextMenu?.item) return;
    openTagModal(contextMenu.item);
    setContextMenu(null);
  };

  const handleOpenFavoriteDeleteModal = () => {
    if (!contextMenu?.item) return;
    setFavoriteDeleteTarget(contextMenu.item);
    setContextMenu(null);
  };

  const handleOpenDetail = () => {
    if (!contextMenu?.item) return;
    openResourceDetail(contextMenu.item);
    setContextMenu(null);
  };

  const handleOpenFocusedResourceContextMenu = () => {
    const currentFocus = getCurrentFocusKey();
    if (!currentFocus?.startsWith(LIBRARY_RESOURCE_FOCUS_PREFIX)) return;

    const item = getFocusedResource();
    const anchor = getControllerAnchorForFocusKey(currentFocus);
    if (!item || !anchor) return;

    setContextMenu({
      item,
      ...anchor,
    });
  };

  const contextMenuActions: LibraryContextMenuAction[] = [];
  if (contextMenu) {
    if (toDetailProject(contextMenu.item)) {
      contextMenuActions.push({
        id: 'detail',
        label: t('libraryPage.context.detail'),
        icon: Eye,
        group: 'primary',
        onSelect: handleOpenDetail,
      });
    }

    contextMenuActions.push({
      id: 'tags',
      label: t('libraryPage.context.tags'),
      icon: Tags,
      group: 'secondary',
      onSelect: handleOpenTagModal,
    });

    if (canRemoveContextItemFromCurrentCollection && !isContextRemovePending) {
      contextMenuActions.push({
        id: 'remove',
        label: t(getRemoveContextLabel(selectedCollection?.type)),
        icon: XCircle,
        group: 'danger',
        onSelect: () => { void handleRemoveContextItemFromCollection(); },
      });
    }

    contextMenuActions.push({
      id: 'delete-favorite',
      label: t('libraryPage.context.deleteFavorite'),
      icon: Trash2,
      group: 'danger',
      onSelect: handleOpenFavoriteDeleteModal,
    });
  }

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
      await removeStarredItem(favoriteDeleteTarget.id);
      setFavoriteDeleteTarget(null);
    } finally {
      setIsDeletingFavoriteItem(false);
    }
  };

  const handleHeaderArrow = (direction: string) => {
    if (direction === 'down' && doesFocusableExist('library-search')) {
      setFocus('library-search');
      return false;
    }
    return true;
  };

  const handleContentArrow = (index: number, direction: string) => {
    if (direction === 'up' && index === 0) {
      const target = ['library-search', 'library-sort', 'library-view-toggle-0'].find((key) =>
        doesFocusableExist(key),
      );
      if (target) {
        setFocus(target);
        return false;
      }
    }
    return true;
  };

  const hasBlockingOverlay = Boolean(
    contextMenu ||
    tagTargetItem ||
    detailProject ||
    favoriteDeleteTarget ||
    isDeleteModSetOpen ||
    isTrackerModalOpen ||
    editingCollectionMetadata ||
    libraryImportDraft,
  );

  useInputAction('ACTION_X', () => {
    if (currentGlobalTab !== 'library' || hasBlockingOverlay || isCollectionSortMode) return;
    handleOpenFocusedResourceContextMenu();
  });

  useInputAction('ACTION_Y', () => {
    if (currentGlobalTab !== 'library' || hasBlockingOverlay) return;

    const resource = getFocusedResource();
    if (resource) {
      openResourceDetail(resource);
      return;
    }

    const collection = getFocusedCollection();
    if (collection?.type === 'mod_set' || collection?.type === 'modpack') {
      openCollectionMetadataEdit(collection);
    }
  });

  useInputAction('CANCEL', () => {
    if (currentGlobalTab !== 'library' || hasBlockingOverlay) return;

    if (parentCategoryId) {
      setSelectedGroupId(parentCategoryId);
      return;
    }

    if (isCategoryView) {
      setSelectedGroupId('all');
    }
  });

  useEffect(() => {
    if (currentGlobalTab !== 'library' || inputMode !== 'controller') {
      didInitialControllerFocusRef.current = false;
      return;
    }
    if (hasBlockingOverlay) return;

    const currentFocus = getCurrentFocusKey();
    if (currentFocus && currentFocus !== 'SN:ROOT' && doesFocusableExist(currentFocus)) {
      didInitialControllerFocusRef.current = true;
      return;
    }

    const preferredTarget = isCategoryView
      ? `${LIBRARY_COLLECTION_FOCUS_PREFIX}0`
      : visibleResources.length > 0
        ? `${LIBRARY_RESOURCE_FOCUS_PREFIX}0`
        : 'library-view-toggle-0';

    if (didInitialControllerFocusRef.current && !doesFocusableExist(preferredTarget)) return;

    const timer = window.setTimeout(() => {
      const target = [
        preferredTarget,
        'library-search',
        'library-view-toggle-0',
        'library-tags-manage',
      ].find((key) => doesFocusableExist(key));
      if (target) {
        setFocus(target);
        didInitialControllerFocusRef.current = true;
      }
    }, 80);

    return () => window.clearTimeout(timer);
  }, [
    currentGlobalTab,
    hasBlockingOverlay,
    inputMode,
    isCategoryView,
    visibleResources.length,
    visibleCollections.length,
  ]);

  return (
    <FocusBoundary
      id="library-page"
      defaultFocusKey="library-view-toggle-0"
      className="flex h-full w-full flex-col overflow-hidden bg-[rgba(18,18,19,0.86)] font-sans text-[var(--ore-color-text-primary-default)]"
    >
      <LibraryHeader
        activeView={activeHeaderView}
        onViewChange={handleHeaderViewChange}
        onArrowPress={handleHeaderArrow}
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
            visibleCount={isCategoryView ? visibleCollections.length : visibleResources.length}
            selectedCollectionName={
              isCategoryView
                ? selectedGroupId === 'category_modpacks'
                  ? t('libraryPage.views.modpack')
                  : t('libraryPage.views.modSet')
                : selectedCollection?.name ?? activeHeaderViewLabel[activeHeaderView]
            }
            highlightedItems={highlightedItems}
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
          />

          {relationError && !tagTargetItem && (
            <div className="shrink-0 border-b-2 border-[var(--ore-color-border-danger-subtle)] bg-[var(--ore-color-background-danger-muted)] px-5 py-2 font-minecraft text-sm text-[var(--ore-color-text-danger-soft)]">
              {relationError}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-hidden">
            {isInitialLoading || (isCategoryView ? visibleCollections.length === 0 : visibleResources.length === 0) ? (
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
                    className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5"
                  >
                    {visibleCollections.map((collection, index) => (
                      <CollectionCard
                        key={collection.id}
                        collection={collection}
                        onClick={() => setSelectedGroupId(collection.id)}
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
                items={visibleResources}
                density={density}
                getTrackerStatus={showModSetDeployAction ? getTrackerStatusForResource : undefined}
                onContextMenu={handleItemContextMenu}
                onOpenItem={openResourceDetail}
                onItemArrowPress={handleContentArrow}
                activeContextItemId={contextMenu?.item.id}
                sortMode={isCollectionSortMode && !collectionSortModeDisabled && !isCollectionReordering}
                onMoveItem={handleMoveCollectionItem}
                onPlaceItem={handlePlaceCollectionItem}
              />
            )}
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
      />

      <FavoriteDeleteModal
        target={favoriteDeleteTarget}
        isDeleting={isDeletingFavoriteItem}
        onClose={() => {
          if (!isDeletingFavoriteItem) setFavoriteDeleteTarget(null);
        }}
        onConfirm={() => { void handleDeleteFavoriteItem(); }}
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

export default LibraryPage;
