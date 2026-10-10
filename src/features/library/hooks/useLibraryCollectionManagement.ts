import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import type { VersionGroup } from '@/features/instances';
import type { Collection } from '@/types/library';
import type { DropdownOption } from '@/ui/primitives/OreDropdown';

import type { LibraryResourceViewModel } from '../logic/libraryItems';
import { useLibraryStore } from '../stores/useLibraryStore';
import {
  useModSetTrackerStore,
  type ModSetTracker,
} from '../stores/useModSetTrackerStore';

interface UseLibraryCollectionManagementOptions {
  selectedCollection: Collection | null | undefined;
  selectedModSetTracker: ModSetTracker | null;
  selectedModSetResources: LibraryResourceViewModel[];
  trackers: ModSetTracker[];
  setSelectedGroupId: (groupId: string) => void;
  setError: (message: string) => void;
}

export const useLibraryCollectionManagement = ({
  selectedCollection,
  selectedModSetTracker,
  selectedModSetResources,
  trackers,
  setSelectedGroupId,
  setError,
}: UseLibraryCollectionManagementOptions) => {
  const removeCollection = useLibraryStore((state) => state.removeCollection);
  const updateCollection = useLibraryStore((state) => state.updateCollection);
  const removeStarredItem = useLibraryStore((state) => state.removeStarredItem);
  const initializeLibrary = useLibraryStore((state) => state.initializeLibrary);
  const updateTrackerTarget = useModSetTrackerStore((state) => state.updateTrackerTarget);
  const removeTrackersForCollection = useModSetTrackerStore((state) => state.removeTrackersForCollection);
  const renameTrackersForCollection = useModSetTrackerStore((state) => state.renameTrackersForCollection);
  const checkTracker = useModSetTrackerStore((state) => state.checkTracker);

  const [minecraftVersionOptions, setMinecraftVersionOptions] = useState<DropdownOption[]>([]);
  const [editingCollectionMetadata, setEditingCollectionMetadata] = useState<Collection | null>(null);
  const [isSavingCollectionMetadata, setIsSavingCollectionMetadata] = useState(false);
  const [isDeleteModSetOpen, setIsDeleteModSetOpen] = useState(false);
  const [isDeletingModSet, setIsDeletingModSet] = useState(false);
  const [removeFavoritesWithModSet, setRemoveFavoritesWithModSet] = useState(true);
  const [deleteModSetSelectedItemIds, setDeleteModSetSelectedItemIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [favoriteDeleteTarget, setFavoriteDeleteTarget] = useState<LibraryResourceViewModel | null>(null);
  const [isDeletingFavoriteItem, setIsDeletingFavoriteItem] = useState(false);

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

  const editingCollectionTrackingInfo = useMemo(() => {
    if (editingCollectionMetadata?.type !== 'mod_set') return null;
    const tracker = trackers
      .filter((item) => item.collectionId === editingCollectionMetadata.id)
      .sort((left, right) => right.updatedAt - left.updatedAt)[0];
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

  const closeCollectionMetadataEdit = () => {
    if (!isSavingCollectionMetadata) setEditingCollectionMetadata(null);
  };

  const saveCollectionMetadata = async (nextCollection: Collection) => {
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

  const saveTracking = (gameVersion: string, loader: string) => {
    if (!selectedModSetTracker) return;
    updateTrackerTarget(selectedModSetTracker.id, gameVersion, loader);
    void checkTracker(selectedModSetTracker.id);
  };

  const openDeleteModSetModal = () => {
    setRemoveFavoritesWithModSet(true);
    setDeleteModSetSelectedItemIds(new Set(selectedModSetResources.map((item) => item.id)));
    setIsDeleteModSetOpen(true);
  };

  const closeDeleteModSetModal = () => {
    if (!isDeletingModSet) setIsDeleteModSetOpen(false);
  };

  const deleteModSet = async () => {
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

  const toggleDeleteModSetItem = (itemId: string) => {
    setDeleteModSetSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
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

  const closeFavoriteDelete = () => {
    if (!isDeletingFavoriteItem) setFavoriteDeleteTarget(null);
  };

  const deleteFavoriteItem = async () => {
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
    } catch (error) {
      console.error(error);
      setError(`删除失败: ${String(error)}`);
    } finally {
      setIsDeletingFavoriteItem(false);
    }
  };

  return {
    minecraftVersionOptions,
    editingCollectionMetadata,
    editingCollectionTrackingInfo,
    isSavingCollectionMetadata,
    openCollectionMetadataEdit,
    closeCollectionMetadataEdit,
    saveCollectionMetadata,
    saveTracking,
    isDeleteModSetOpen,
    isDeletingModSet,
    removeFavoritesWithModSet,
    deleteModSetSelectedItemIds,
    openDeleteModSetModal,
    closeDeleteModSetModal,
    deleteModSet,
    toggleRemoveFavoritesWithModSet: () => setRemoveFavoritesWithModSet((current) => !current),
    toggleDeleteModSetItem,
    selectAllDeleteModSetItems,
    invertDeleteModSetItems,
    favoriteDeleteTarget,
    isDeletingFavoriteItem,
    openFavoriteDelete: setFavoriteDeleteTarget,
    closeFavoriteDelete,
    deleteFavoriteItem,
  };
};
