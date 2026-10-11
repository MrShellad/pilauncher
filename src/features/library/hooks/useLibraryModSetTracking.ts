import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Collection, CollectionItem, StarredItem } from '../../../types/library';
import { toLibraryResource, type LibraryResourceViewModel } from '../logic/libraryItems';
import { getCollectionItemTrackerKeys } from '../logic/libraryPageUtils';
import {
  useModSetTrackerStore,
  type ModSetTrackerItemStatus,
} from '../stores/useModSetTrackerStore';

interface UseLibraryModSetTrackingOptions {
  collections: Collection[];
  collectionItems: CollectionItem[];
  starredItems: StarredItem[];
  selectedCollection: Collection | undefined;
}

export function useLibraryModSetTracking({
  collections,
  collectionItems,
  starredItems,
  selectedCollection,
}: UseLibraryModSetTrackingOptions) {
  const trackers = useModSetTrackerStore((state) => state.trackers);
  const isCheckingTrackers = useModSetTrackerStore((state) => state.isChecking);
  const loadTrackers = useModSetTrackerStore((state) => state.loadTrackers);
  const checkTracker = useModSetTrackerStore((state) => state.checkTracker);
  const removeTracker = useModSetTrackerStore((state) => state.removeTracker);
  const syncCollectionTrackers = useModSetTrackerStore((state) => state.syncCollectionTrackers);
  const [isTrackerModalOpen, setIsTrackerModalOpen] = useState(false);
  const [directInstallTrackerId, setDirectInstallTrackerId] = useState<string | null>(null);

  const selectedCollectionTrackers = useMemo(() => {
    if (selectedCollection?.type !== 'mod_set') return [];
    return trackers
      .filter((tracker) => tracker.collectionId === selectedCollection.id)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [selectedCollection, trackers]);

  const selectedModSetTracker =
    selectedCollectionTrackers.find((tracker) => tracker.readyCount > 0) ||
    selectedCollectionTrackers[0] ||
    null;

  const selectedTrackerStatusByKey = useMemo(() => {
    const statusByKey = new Map<string, ModSetTrackerItemStatus>();
    selectedModSetTracker?.items.forEach((item) => {
      statusByKey.set(item.itemId.toLowerCase(), item.status);
      statusByKey.set(`${item.source}:${item.projectId}`.toLowerCase(), item.status);
      statusByKey.set(item.projectId.toLowerCase(), item.status);
    });
    return statusByKey;
  }, [selectedModSetTracker]);

  const getTrackerStatusForResource = useCallback(
    (item: LibraryResourceViewModel) => {
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
    },
    [selectedTrackerStatusByKey]
  );

  const trackerSyncTargets = useMemo(
    () =>
      collections
        .filter((collection) => collection.type === 'mod_set')
        .map((collection) => ({
          collectionId: collection.id,
          keys: collectionItems
            .filter((relation) => relation.collectionId === collection.id)
            .flatMap(getCollectionItemTrackerKeys)
            .sort(),
        })),
    [collectionItems, collections]
  );

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
    trackerSyncTargets.forEach((target) => {
      syncCollectionTrackers(target.collectionId, target.keys);
    });
  }, [syncCollectionTrackers, trackerSyncTargets]);

  return {
    trackers,
    isCheckingTrackers,
    checkTracker,
    removeTracker,
    isTrackerModalOpen,
    closeTrackerModal: () => setIsTrackerModalOpen(false),
    directInstallTrackerId,
    setDirectInstallTrackerId,
    selectedModSetTracker,
    selectedModSetResources,
    showModSetDeployAction: selectedCollection?.type === 'mod_set',
    getTrackerStatusForResource,
  };
}
