import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLibraryStore } from '../../../stores/useLibraryStore';
import type { Collection, CollectionItem } from '../../../types/library';
import { getErrorMessage } from '../logic/libraryPageUtils';

interface UseLibraryCollectionOrderingOptions {
  selectedCollection: Collection | undefined;
  collectionItems: CollectionItem[];
  disabled: boolean;
  onError: (message: string) => void;
}

export const useLibraryCollectionOrdering = ({
  selectedCollection,
  collectionItems,
  disabled,
  onError,
}: UseLibraryCollectionOrderingOptions) => {
  const { t } = useTranslation();
  const reorderCollectionItems = useLibraryStore((state) => state.reorderCollectionItems);
  const [isCollectionSortMode, setIsCollectionSortMode] = useState(false);
  const [isCollectionReordering, setIsCollectionReordering] = useState(false);

  const selectedCollectionOrderedItemIds = useMemo(() => {
    if (!selectedCollection) return [];
    return collectionItems
      .filter((relation) => relation.collectionId === selectedCollection.id)
      .sort((a, b) => a.position - b.position)
      .map((relation) => relation.itemId);
  }, [collectionItems, selectedCollection]);

  useEffect(() => {
    if (isCollectionSortMode && disabled) {
      setIsCollectionSortMode(false);
    }
  }, [disabled, isCollectionSortMode]);

  const reorderItems = async (orderedItemIds: string[]) => {
    if (!selectedCollection || isCollectionReordering) return;

    setIsCollectionReordering(true);
    onError('');
    try {
      await reorderCollectionItems(selectedCollection.id, orderedItemIds);
    } catch (error) {
      onError(t('libraryPage.messages.reorderFailed', { error: getErrorMessage(error) }));
    } finally {
      setIsCollectionReordering(false);
    }
  };

  const moveItem = (itemId: string, direction: 'up' | 'down') => {
    if (!selectedCollection || disabled) return;

    const currentIndex = selectedCollectionOrderedItemIds.indexOf(itemId);
    if (currentIndex < 0) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= selectedCollectionOrderedItemIds.length) return;

    const nextOrder = [...selectedCollectionOrderedItemIds];
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]];
    void reorderItems(nextOrder);
  };

  const placeItem = (draggedItemId: string, targetItemId: string) => {
    if (!selectedCollection || disabled || draggedItemId === targetItemId) return;

    const sourceIndex = selectedCollectionOrderedItemIds.indexOf(draggedItemId);
    const targetIndex = selectedCollectionOrderedItemIds.indexOf(targetItemId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const nextOrder = [...selectedCollectionOrderedItemIds];
    const [movedItemId] = nextOrder.splice(sourceIndex, 1);
    const nextTargetIndex = nextOrder.indexOf(targetItemId);
    nextOrder.splice(nextTargetIndex, 0, movedItemId);
    void reorderItems(nextOrder);
  };

  return {
    isCollectionSortMode,
    isCollectionReordering,
    setIsCollectionSortMode,
    moveItem,
    placeItem,
  };
};
