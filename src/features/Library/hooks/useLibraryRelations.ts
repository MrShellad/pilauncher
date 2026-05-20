import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLibraryStore } from '../../../stores/useLibraryStore';
import type { Collection } from '../../../types/library';
import type { LibraryResourceViewModel } from '../logic/libraryItems';
import {
  createCollectionItemId,
  getErrorMessage,
  getRelationPendingKey,
  nowSeconds,
} from '../logic/libraryPageUtils';
import { useModSetTrackerStore } from '../stores/useModSetTrackerStore';

export const useLibraryRelations = () => {
  const { t } = useTranslation();
  const collections = useLibraryStore((state) => state.collections);
  const collectionItems = useLibraryStore((state) => state.collectionItems);
  const addItemToCollection = useLibraryStore((state) => state.addItemToCollection);
  const removeItemFromCollection = useLibraryStore((state) => state.removeItemFromCollection);
  const removeProjectFromCollectionTrackers = useModSetTrackerStore((state) => state.removeProjectFromCollectionTrackers);

  const [pendingRelationKeys, setPendingRelationKeys] = useState<Set<string>>(() => new Set());
  const [relationError, setRelationError] = useState('');
  const [tagTargetItem, setTagTargetItem] = useState<LibraryResourceViewModel | null>(null);
  const pendingRelationKeysRef = useRef<Set<string>>(new Set());

  const tagCollections = useMemo(
    () => collections
      .filter((collection) => collection.type === 'group')
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [collections],
  );

  const tagTargetTagIds = useMemo(() => {
    if (!tagTargetItem) return new Set<string>();
    return new Set(
      collectionItems
        .filter((relation) => relation.itemId === tagTargetItem.id)
        .map((relation) => relation.collectionId),
    );
  }, [collectionItems, tagTargetItem]);

  const tagTargetHasPendingRelation = useMemo(() => {
    if (!tagTargetItem) return false;
    return tagCollections.some((tag) =>
      pendingRelationKeys.has(getRelationPendingKey(tag.id, tagTargetItem.id)),
    );
  }, [pendingRelationKeys, tagCollections, tagTargetItem]);

  const buildCollectionItem = (collectionId: string, item: LibraryResourceViewModel) => {
    const maxPosition = collectionItems
      .filter((relation) => relation.collectionId === collectionId)
      .reduce((currentMax, relation) => Math.max(currentMax, relation.position), 0);

    return {
      id: createCollectionItemId(collectionId, item.id),
      collectionId,
      itemId: item.id,
      position: maxPosition + 1,
      extra: JSON.stringify({ source: item.source, projectId: item.item.projectId }),
      createdAt: nowSeconds(),
    };
  };

  const runRelationMutation = async (pendingKey: string, mutation: () => Promise<void>) => {
    if (pendingRelationKeysRef.current.has(pendingKey)) return false;

    setRelationError('');
    pendingRelationKeysRef.current = new Set(pendingRelationKeysRef.current);
    pendingRelationKeysRef.current.add(pendingKey);
    setPendingRelationKeys((current) => {
      const next = new Set(current);
      next.add(pendingKey);
      return next;
    });

    try {
      await mutation();
      return true;
    } catch (error) {
      setRelationError(t('libraryPage.messages.operationFailed', { error: getErrorMessage(error) }));
      return false;
    } finally {
      pendingRelationKeysRef.current = new Set(pendingRelationKeysRef.current);
      pendingRelationKeysRef.current.delete(pendingKey);
      setPendingRelationKeys((current) => {
        const next = new Set(current);
        next.delete(pendingKey);
        return next;
      });
    }
  };

  const openTagModal = (item: LibraryResourceViewModel) => {
    setRelationError('');
    setTagTargetItem(item);
  };

  const closeTagModal = () => {
    if (!tagTargetHasPendingRelation) {
      setTagTargetItem(null);
    }
  };

  const removeItemFromCollectionWithTracking = async (
    collection: Collection,
    item: LibraryResourceViewModel,
  ) => {
    const pendingKey = getRelationPendingKey(collection.id, item.id);

    await runRelationMutation(pendingKey, async () => {
      await removeItemFromCollection(collection.id, item.id);
      if (collection.type === 'mod_set') {
        removeProjectFromCollectionTrackers(collection.id, {
          itemId: item.id,
          source: item.source,
          projectId: item.item.projectId,
        });
      }
    });
  };

  const toggleItemTag = async (tagId: string) => {
    if (!tagTargetItem) return;
    const item = tagTargetItem;
    const pendingKey = getRelationPendingKey(tagId, item.id);

    const existing = collectionItems.find(
      (relation) => relation.collectionId === tagId && relation.itemId === item.id,
    );

    await runRelationMutation(pendingKey, async () => {
      if (existing) {
        await removeItemFromCollection(tagId, item.id);
        return;
      }

      await addItemToCollection(buildCollectionItem(tagId, item));
    });
  };

  return {
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
  };
};
