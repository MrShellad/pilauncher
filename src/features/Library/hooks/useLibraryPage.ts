import { useEffect, useMemo, useState } from 'react';

import { useLibraryStore } from '../../../stores/useLibraryStore';
import type { Collection } from '../../../types/library';
import type { LibraryDensity, LibraryFilterId, LibrarySortId } from '../data/libraryPageData';
import {
  createLibraryStats,
  filterLibraryResources,
  getScopedItems,
  sortLibraryResources,
  toLibraryResource,
} from '../logic/libraryItems';

export const useLibraryPage = () => {
  const {
    items,
    collections,
    collectionItems,
    initialized,
    isLoading,
    error,
    initializeLibrary,
    createCollection,
  } = useLibraryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [activeFilter, setActiveFilter] = useState<LibraryFilterId>('all');
  const [sortBy, setSortBy] = useState<LibrarySortId>('recent');
  const [density, setDensity] = useState<LibraryDensity>('comfortable');

  useEffect(() => {
    if (!initialized && !isLoading) {
      void initializeLibrary();
    }
  }, [initialized, initializeLibrary, isLoading]);

  const allResources = useMemo(
    () => items.map(toLibraryResource),
    [items],
  );

  const scopedResources = useMemo(() => {
    const scopedItems = getScopedItems(selectedGroupId, items, collectionItems);
    return scopedItems.map(toLibraryResource);
  }, [collectionItems, items, selectedGroupId]);

  const visibleResources = useMemo(() => {
    const filtered = filterLibraryResources(scopedResources, searchQuery, activeFilter);
    return sortLibraryResources(filtered, sortBy);
  }, [activeFilter, scopedResources, searchQuery, sortBy]);

  const stats = useMemo(
    () => createLibraryStats(allResources),
    [allResources],
  );

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedGroupId),
    [collections, selectedGroupId],
  );

  useEffect(() => {
    if (selectedCollection && sortBy !== 'manual') {
      setSortBy('manual');
      return;
    }

    if (!selectedCollection && sortBy === 'manual') {
      setSortBy('recent');
    }
  }, [selectedCollection, sortBy]);

  const isCategoryView = selectedGroupId.startsWith('category_');
  const activeCategoryType = selectedGroupId === 'category_modpacks' ? 'modpack' : selectedGroupId === 'category_modsets' ? 'mod_set' : null;

  const visibleCollections = useMemo(() => {
    if (!isCategoryView || !activeCategoryType) return [];
    let filtered = collections.filter((c) => c.type === activeCategoryType);
    
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(lowerQuery));
    }
    
    return filtered.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [collections, isCategoryView, activeCategoryType, searchQuery]);

  const parentCategoryId = useMemo(() => {
    if (selectedCollection?.type === 'modpack') return 'category_modpacks';
    if (selectedCollection?.type === 'mod_set') return 'category_modsets';
    return null;
  }, [selectedCollection]);

  const createTagCollection = async (collection: Collection) => {
    await createCollection(collection);
  };

  return {
    collections,
    density,
    setDensity,
    error,
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
    stats,
    visibleResources,
    createTagCollection,
    isCategoryView,
    visibleCollections,
    parentCategoryId,
  };
};
