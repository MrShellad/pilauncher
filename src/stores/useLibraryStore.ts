import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Collection, CollectionItem, StarredItem } from '../types/library';

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
  removeItemFromCollection: (collectionId: string, itemId: string) => Promise<void>;
  
  // Data access
  getItemsInCollection: (collectionId: string) => StarredItem[];
}

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
      const items = await invoke<StarredItem[]>('get_starred_items');
      const collections = await invoke<Collection[]>('get_collections');
      
      // Load all collection items across all collections
      // (This could be optimized later, but for local sqlite it's very fast)
      let allCollectionItems: CollectionItem[] = [];
      for (const coll of collections) {
        const cItems = await invoke<CollectionItem[]>('get_collection_items', { collectionId: coll.id });
        allCollectionItems = [...allCollectionItems, ...cItems];
      }

      set({
        items,
        collections,
        collectionItems: allCollectionItems,
        initialized: true,
        isLoading: false
      });
    } catch (e: any) {
      set({ error: e.toString(), isLoading: false });
    }
  },

  addStarredItem: async (item) => {
    try {
      await invoke('save_starred_item', { item });
      set((state) => {
        const idx = state.items.findIndex(i => i.id === item.id);
        if (idx !== -1) {
          const newItems = [...state.items];
          newItems[idx] = item;
          return { items: newItems };
        }
        return { items: [item, ...state.items] };
      });
    } catch (e: any) {
      set({ error: e.toString() });
    }
  },

  removeStarredItem: async (id) => {
    try {
      await invoke('remove_starred_item', { id });
      set((state) => ({
        items: state.items.filter(i => i.id !== id),
        collectionItems: state.collectionItems.filter(ci => ci.itemId !== id)
      }));
    } catch (e: any) {
      set({ error: e.toString() });
    }
  },

  createCollection: async (collection) => {
    try {
      await invoke('save_collection', { item: collection });
      set((state) => ({
        collections: [collection, ...state.collections]
      }));
    } catch (e: any) {
      set({ error: e.toString() });
    }
  },

  removeCollection: async (id) => {
    try {
      await invoke('remove_collection', { id });
      set((state) => ({
        collections: state.collections.filter(c => c.id !== id),
        collectionItems: state.collectionItems.filter(ci => ci.collectionId !== id)
      }));
    } catch (e: any) {
      set({ error: e.toString() });
    }
  },

  updateCollection: async (collection) => {
    try {
      await invoke('save_collection', { item: collection });
      set((state) => ({
        collections: state.collections.map(c => c.id === collection.id ? collection : c)
      }));
    } catch (e: any) {
      set({ error: e.toString() });
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
    } catch (e: any) {
      set({ error: e.toString() });
    }
  },

  removeItemFromCollection: async (collectionId, itemId) => {
    try {
      await invoke('remove_collection_item', { collectionId, itemId });
      set((state) => ({
        collectionItems: state.collectionItems.filter(ci => !(ci.collectionId === collectionId && ci.itemId === itemId))
      }));
    } catch (e: any) {
      set({ error: e.toString() });
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
