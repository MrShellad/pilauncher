import { create } from 'zustand';

const DB_NAME = 'icon-cache-db';
const STORE_NAME = 'icons';
const DB_VERSION = 1;
const CACHE_VALIDITY_MS = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };
  });
}

interface CacheEntry {
  url: string;
  blob: Blob;
  timestamp: number;
}

async function getCache(url: string): Promise<CacheEntry | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(url);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

async function setCache(url: string, blob: Blob): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({
      url,
      blob,
      timestamp: Date.now(),
    });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

interface IconCacheState {
  cachedUrls: Record<string, string>;
  loadIcon: (url: string) => Promise<string>;
  refreshIcon: (url: string) => Promise<string>;
}

export const useIconCacheStore = create<IconCacheState>((set, get) => ({
  cachedUrls: {},
  loadIcon: async (url: string) => {
    if (!url) return '';

    // 1. Check if already loaded in memory
    const existing = get().cachedUrls[url];
    if (existing) return existing;

    try {
      // 2. Check IndexedDB cache
      const cached = await getCache(url);
      const isExpired = cached ? (Date.now() - cached.timestamp > CACHE_VALIDITY_MS) : true;

      if (cached && !isExpired) {
        const objectUrl = URL.createObjectURL(cached.blob);
        set((state) => ({
          cachedUrls: { ...state.cachedUrls, [url]: objectUrl }
        }));
        return objectUrl;
      }

      // 3. Not found or expired: Fetch and cache
      return await get().refreshIcon(url);
    } catch (e) {
      console.error('Failed to load cached icon, fallback to original URL:', e);
      return url;
    }
  },
  refreshIcon: async (url: string) => {
    if (!url) return '';
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch icon');
      const blob = await response.blob();

      // Save to IndexedDB
      await setCache(url, blob);

      // Create new Object URL
      const objectUrl = URL.createObjectURL(blob);

      // Revoke old URL if it exists in memory to free memory
      const oldUrl = get().cachedUrls[url];
      if (oldUrl && oldUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(oldUrl);
        } catch (err) {
          console.error('Failed to revoke object URL:', err);
        }
      }

      set((state) => ({
        cachedUrls: { ...state.cachedUrls, [url]: objectUrl }
      }));
      return objectUrl;
    } catch (e) {
      console.error('Failed to refresh icon:', e);
      return url;
    }
  }
}));
