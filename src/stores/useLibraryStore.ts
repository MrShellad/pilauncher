import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Collection, CollectionItem, StarredItem } from '../types/library';
import { useSettingsStore } from '../store/useSettingsStore';

interface LibraryState {
  items: StarredItem[];
  collections: Collection[];
  collectionItems: CollectionItem[];
  initialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  initializeLibrary: () => Promise<void>;
  
  // Starred Items
  addStarredItem: (item: StarredItem) => Promise<void>;
  removeStarredItem: (id: string) => Promise<void>;
  
  // Collections
  createCollection: (collection: Collection) => Promise<void>;
  removeCollection: (id: string) => Promise<void>;
  updateCollection: (collection: Collection) => Promise<void>;
  
  // Collection Items
  addItemToCollection: (collectionItem: CollectionItem) => Promise<void>;
  addItemsToCollection: (collectionItems: CollectionItem[]) => Promise<void>;
  removeItemFromCollection: (collectionId: string, itemId: string) => Promise<void>;
  removeItemsFromCollection: (collectionId: string, itemIds: string[]) => Promise<void>;
  reorderCollectionItems: (collectionId: string, orderedItemIds: string[]) => Promise<void>;
  
  // Data access
  getItemsInCollection: (collectionId: string) => StarredItem[];
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

let favoriteSyncTimer: ReturnType<typeof setTimeout> | null = null;

export const useLibraryStore = create<LibraryState>((set, get) => ({
  items: [],
  collections: [],
  collectionItems: [],
  initialized: false,
  isLoading: false,
  error: null,

  initializeLibrary: async () => {
    set({ isLoading: true, error: null });
    try {
      const [items, collections, collectionItems] = await Promise.all([
        invoke<StarredItem[]>('get_starred_items'),
        invoke<Collection[]>('get_collections'),
        invoke<CollectionItem[]>('get_all_collection_items'),
      ]);

      set({
        items,
        collections,
        collectionItems,
        initialized: true,
        isLoading: false
      });
    } catch (e: unknown) {
      set({ error: getErrorMessage(e), isLoading: false });
    }
  },

  addStarredItem: async (item) => {
    try {
      const { settings } = useSettingsStore.getState();
      await invoke('save_starred_item', {
        item,
        deviceId: settings.general.deviceId,
      });
      set((state) => {
        const idx = state.items.findIndex(i => i.id === item.id);
        if (idx !== -1) {
          const newItems = [...state.items];
          newItems[idx] = item;
          return { items: newItems };
        }
        return { items: [item, ...state.items] };
      });
      scheduleFavoriteSyncIfConfigured();
    } catch (e: unknown) {
      set({ error: getErrorMessage(e) });
    }
  },

  removeStarredItem: async (id) => {
    try {
      const { settings } = useSettingsStore.getState();
      await invoke('remove_starred_item', {
        id,
        deviceId: settings.general.deviceId,
      });
      set((state) => ({
        items: state.items.filter(i => i.id !== id),
        collectionItems: state.collectionItems.filter(ci => ci.itemId !== id)
      }));
      scheduleFavoriteSyncIfConfigured();
    } catch (e: unknown) {
      set({ error: getErrorMessage(e) });
    }
  },

  createCollection: async (collection) => {
    try {
      await invoke('save_collection', { item: collection });
      set((state) => ({
        collections: [collection, ...state.collections]
      }));
    } catch (e: unknown) {
      set({ error: getErrorMessage(e) });
    }
  },

  removeCollection: async (id) => {
    try {
      await invoke('remove_collection', { id });
      set((state) => ({
        collections: state.collections.filter(c => c.id !== id),
        collectionItems: state.collectionItems.filter(ci => ci.collectionId !== id)
      }));
    } catch (e: unknown) {
      set({ error: getErrorMessage(e) });
    }
  },

  updateCollection: async (collection) => {
    try {
      await invoke('save_collection', { item: collection });
      set((state) => ({
        collections: state.collections.map(c => c.id === collection.id ? collection : c)
      }));
    } catch (e: unknown) {
      set({ error: getErrorMessage(e) });
    }
  },

  addItemToCollection: async (item) => {
    try {
      await invoke('save_collection_item', { item });
      set((state) => {
        const existing = state.collectionItems.findIndex(ci => ci.id === item.id);
        if (existing !== -1) {
          const newItems = [...state.collectionItems];
          newItems[existing] = item;
          return { collectionItems: newItems };
        }
        return { collectionItems: [...state.collectionItems, item] };
      });
    } catch (e: unknown) {
      set({ error: getErrorMessage(e) });
      throw e;
    }
  },

  addItemsToCollection: async (items) => {
    if (items.length === 0) return;

    try {
      await invoke('save_collection_items', { items });
      set((state) => {
        const nextById = new Map(state.collectionItems.map((item) => [item.id, item]));
        for (const item of items) {
          nextById.set(item.id, item);
        }
        return { collectionItems: [...nextById.values()] };
      });
    } catch (e: unknown) {
      set({ error: getErrorMessage(e) });
      throw e;
    }
  },

  removeItemFromCollection: async (collectionId, itemId) => {
    try {
      await invoke('remove_collection_item', { collectionId, itemId });
      set((state) => ({
        collectionItems: state.collectionItems.filter(ci => !(ci.collectionId === collectionId && ci.itemId === itemId))
      }));
    } catch (e: unknown) {
      set({ error: getErrorMessage(e) });
      throw e;
    }
  },

  removeItemsFromCollection: async (collectionId, itemIds) => {
    if (itemIds.length === 0) return;

    try {
      await invoke('remove_collection_items', { collectionId, itemIds });
      const removed = new Set(itemIds);
      set((state) => ({
        collectionItems: state.collectionItems.filter(
          (item) => !(item.collectionId === collectionId && removed.has(item.itemId))
        )
      }));
    } catch (e: unknown) {
      set({ error: getErrorMessage(e) });
      throw e;
    }
  },

  reorderCollectionItems: async (collectionId, orderedItemIds) => {
    try {
      await invoke('reorder_collection_items', { collectionId, orderedItemIds });
      const positionByItemId = new Map(
        orderedItemIds.map((itemId, index) => [itemId, index + 1])
      );
      set((state) => ({
        collectionItems: state.collectionItems.map((item) => {
          if (item.collectionId !== collectionId) return item;
          const position = positionByItemId.get(item.itemId);
          return position ? { ...item, position } : item;
        })
      }));
    } catch (e: unknown) {
      set({ error: getErrorMessage(e) });
      throw e;
    }
  },

  getItemsInCollection: (collectionId) => {
    const state = get();
    const relations = state.collectionItems
      .filter(ci => ci.collectionId === collectionId)
      .sort((a, b) => a.position - b.position);
      
    const resolvedItems: StarredItem[] = [];
    for (const rel of relations) {
      const found = state.items.find(i => i.id === rel.itemId);
      if (found) {
        resolvedItems.push(found);
      }
    }
    return resolvedItems;
  }
}));

const syncFavoritesIfConfigured = async () => {
  const { settings } = useSettingsStore.getState();
  const webDav = settings.general.webDav;
  if (!webDav.syncFavorites || !webDav.address.trim()) return;

  try {
    await invoke('sync_webdav_favorites', {
      config: {
        baseUrl: webDav.address.trim(),
        username: webDav.username.trim(),
        password: webDav.password,
        deviceId: settings.general.deviceId,
      },
    });
  } catch {
    // 离线或 WebDAV 暂时不可用时，操作日志已经安全落地；下次同步会继续补齐。
  }
};

const scheduleFavoriteSyncIfConfigured = () => {
  if (favoriteSyncTimer) {
    clearTimeout(favoriteSyncTimer);
  }

  favoriteSyncTimer = setTimeout(() => {
    favoriteSyncTimer = null;
    void syncFavoritesIfConfigured();
  }, 500);
};
