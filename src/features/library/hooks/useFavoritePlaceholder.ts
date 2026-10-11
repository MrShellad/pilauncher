import { useEffect, useMemo, useState } from 'react';

import type { ModrinthProject } from '@/features/resource-catalog';
import type { Collection, CollectionItem } from '../../../types/library';
import type { DropdownOption } from '../../../ui/primitives/OreDropdown';
import {
  buildFavoriteCollectionRelation,
  createFavoriteId,
  getFavoritePlaceholderCopy,
  toFavoriteStarredItem,
  type FavoriteResourceType,
} from '../components/favoritePlaceholderModel';
import { useLibraryStore } from '../stores/useLibraryStore';
import { toModSetTrackerProject, useModSetTrackerStore } from '../stores/useModSetTrackerStore';

interface UseFavoritePlaceholderOptions {
  isOpen: boolean;
  projects: ModrinthProject[];
  resourceType: FavoriteResourceType;
  defaultGameVersion: string;
  defaultLoader: string;
  mcVersionOptions: DropdownOption[];
  onClose: () => void;
  onCreated?: () => void;
}

export const useFavoritePlaceholder = ({
  isOpen,
  projects,
  resourceType,
  defaultGameVersion,
  defaultLoader,
  mcVersionOptions,
  onClose,
  onCreated,
}: UseFavoritePlaceholderOptions) => {
  const {
    collections,
    initialized,
    initializeLibrary,
    addStarredItem,
    createCollection,
    addItemsToCollection,
  } = useLibraryStore();
  const loadTrackers = useModSetTrackerStore((state) => state.loadTrackers);
  const createTracker = useModSetTrackerStore((state) => state.createTracker);
  const checkTracker = useModSetTrackerStore((state) => state.checkTracker);
  const trackers = useModSetTrackerStore((state) => state.trackers);

  const tagCollections = useMemo(
    () => collections
      .filter((collection) => collection.type === 'group')
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [collections],
  );
  const modSetCollections = useMemo(
    () => collections
      .filter((collection) => collection.type === 'mod_set')
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [collections],
  );
  const trackingVersionOptions = useMemo(() => {
    const normalized = mcVersionOptions
      .filter((option) => option.value && option.value !== 'all')
      .map((option) => ({ label: option.label, value: option.value }));

    if (defaultGameVersion && !normalized.some((option) => option.value === defaultGameVersion)) {
      normalized.unshift({ label: defaultGameVersion, value: defaultGameVersion });
    }

    return normalized;
  }, [defaultGameVersion, mcVersionOptions]);

  const [selectedTagId, setSelectedTagId] = useState('');
  const [includeCollection, setIncludeCollection] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [trackingEnabled, setTrackingEnabled] = useState(Boolean(defaultGameVersion && defaultLoader));
  const [targetGameVersion, setTargetGameVersion] = useState(defaultGameVersion);
  const [targetLoader, setTargetLoader] = useState(defaultLoader);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const isModFavorite = resourceType === 'mod';
  const copy = getFavoritePlaceholderCopy(resourceType);

  useEffect(() => {
    if (isOpen) {
      if (!initialized) {
        void initializeLibrary();
      }
      void loadTrackers();
    }
  }, [initializeLibrary, initialized, isOpen, loadTrackers]);

  useEffect(() => {
    if (!isOpen) return;
    const fallbackName = projects.length === 1
      ? `${projects[0].title} 相关模组`
      : `模组集 ${new Date().toLocaleDateString()}`;

    setSelectedTagId(tagCollections[0]?.id || '');
    setIncludeCollection(false);
    setCollectionName(fallbackName);
    setTrackingEnabled(isModFavorite && Boolean(defaultGameVersion && defaultLoader));
    setTargetGameVersion(defaultGameVersion);
    setTargetLoader(defaultLoader);
    setNotice('');
  }, [defaultGameVersion, defaultLoader, isModFavorite, isOpen, modSetCollections, projects, tagCollections]);

  const normalizedCollectionName = collectionName.trim();
  const matchedCollection = useMemo(
    () => modSetCollections.find(
      (collection) => collection.name.trim().toLowerCase() === normalizedCollectionName.toLowerCase(),
    ),
    [modSetCollections, normalizedCollectionName],
  );

  useEffect(() => {
    if (!isOpen) return;
    if (matchedCollection) {
      const existingTracker = trackers.find((tracker) => tracker.collectionId === matchedCollection.id);
      if (existingTracker) {
        setTargetGameVersion(existingTracker.gameVersion);
        setTargetLoader(existingTracker.loader);
        setTrackingEnabled(true);
      } else {
        setTargetGameVersion(defaultGameVersion);
        setTargetLoader(defaultLoader);
        setTrackingEnabled(false);
      }
    } else {
      setTargetGameVersion(defaultGameVersion);
      setTargetLoader(defaultLoader);
      setTrackingEnabled(Boolean(defaultGameVersion && defaultLoader));
    }
  }, [defaultGameVersion, defaultLoader, isOpen, matchedCollection?.id, trackers]);

  const modSetOptions = useMemo(
    () => modSetCollections.map((collection) => ({
      label: collection.name,
      value: collection.id,
    })),
    [modSetCollections],
  );

  const needsCollectionTarget = isModFavorite && includeCollection && normalizedCollectionName.length === 0;
  const needsTrackingTarget = isModFavorite
    && includeCollection
    && trackingEnabled
    && (targetGameVersion.trim().length === 0 || targetLoader.trim().length === 0);
  const canSave = projects.length > 0 && !needsCollectionTarget && !needsTrackingTarget;

  const handleSave = async () => {
    if (!canSave || isSaving) return;

    setIsSaving(true);
    setNotice('');

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const starredItems = projects.map((project) => toFavoriteStarredItem(project, resourceType));
      const collectionRelations: CollectionItem[] = [];

      for (const item of starredItems) {
        await addStarredItem(item);
      }

      if (selectedTagId) {
        for (let index = 0; index < starredItems.length; index += 1) {
          collectionRelations.push(buildFavoriteCollectionRelation(
            selectedTagId,
            starredItems[index],
            timestamp + index,
            timestamp,
          ));
        }
      }

      let collection: Collection | undefined;
      if (isModFavorite && includeCollection) {
        collection = matchedCollection;
        if (!collection) {
          collection = {
            id: createFavoriteId('modset'),
            name: normalizedCollectionName,
            description: '',
            type: 'mod_set',
            sortOrder: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          await createCollection(collection);
        }

        if (!collection) return;

        for (let index = 0; index < starredItems.length; index += 1) {
          collectionRelations.push(buildFavoriteCollectionRelation(
            collection.id,
            starredItems[index],
            timestamp + index,
            timestamp,
          ));
        }

        if (trackingEnabled) {
          await loadTrackers();
          const trackerProjects = projects
            .map(toModSetTrackerProject)
            .filter((item): item is NonNullable<typeof item> => Boolean(item));
          if (trackerProjects.length > 0) {
            const tracker = createTracker({
              collectionId: collection.id,
              collectionName: collection.name,
              gameVersion: targetGameVersion.trim(),
              loader: targetLoader.trim().toLowerCase(),
              projects: trackerProjects,
            });
            void checkTracker(tracker.id);
          }
        }
      }

      await addItemsToCollection(collectionRelations);

      onCreated?.();
      onClose();
    } catch (error) {
      console.error('[FavoriteModal] save failed', error);
      setNotice(`保存失败：${String(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    canSave,
    collectionName,
    copy,
    handleSave,
    includeCollection,
    isModFavorite,
    isSaving,
    matchedCollection,
    modSetOptions,
    notice,
    selectedTagId,
    setCollectionName,
    setIncludeCollection,
    setSelectedTagId,
    setTargetGameVersion,
    setTargetLoader,
    setTrackingEnabled,
    tagCollections,
    targetGameVersion,
    targetLoader,
    trackingEnabled,
    trackingVersionOptions,
  };
};

export type FavoritePlaceholderController = ReturnType<typeof useFavoritePlaceholder>;
