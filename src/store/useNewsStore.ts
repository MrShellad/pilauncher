import { create } from 'zustand';
import {
  MC_UPDATES_API_URL,
  MC_UPDATES_CACHE_KEY,
  MC_UPDATES_LAST_PROMPTED_KEY,
  MC_UPDATES_LAST_READ_KEY,
  getLatestUnreadNewsItem,
  getNewsItemTimestamp,
  getNewsLatestTimestamp,
  getUnreadNewsCount,
  type MinecraftUpdateApiItem,
} from '../features/home/data/newsItems';

interface NewsCachePayload {
  timestamp: number;
  items: MinecraftUpdateApiItem[];
}

interface RefreshNewsOptions {
  background?: boolean;
  signal?: AbortSignal;
}

interface NewsState {
  rawItems: MinecraftUpdateApiItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  unreadCount: number;
  startupItem: MinecraftUpdateApiItem | null;
  isStartupModalOpen: boolean;
  ensureSessionRefresh: () => Promise<void>;
  refreshNews: (options?: RefreshNewsOptions) => Promise<void>;
  markAllRead: () => void;
  dismissStartupModal: () => void;
}

let sessionRefreshStarted = false;
let inFlightRefresh: Promise<void> | null = null;

const readCache = (): NewsCachePayload | null => {
  if (typeof window === 'undefined') return null;

  try {
    const cachedRaw = window.localStorage.getItem(MC_UPDATES_CACHE_KEY);
    if (!cachedRaw) return null;

    const cached = JSON.parse(cachedRaw) as NewsCachePayload;
    if (!Array.isArray(cached.items)) return null;
    return cached;
  } catch (error) {
    console.warn('[NewsStore] Failed to read MC updates cache', error);
    return null;
  }
};

const writeCache = (items: MinecraftUpdateApiItem[]) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      MC_UPDATES_CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        items,
      } satisfies NewsCachePayload)
    );
  } catch (error) {
    console.warn('[NewsStore] Failed to write MC updates cache', error);
  }
};

const readNumericStorage = (key: string) => {
  if (typeof window === 'undefined') return 0;

  const raw = window.localStorage.getItem(key);
  if (!raw) return 0;

  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
};

const writeNumericStorage = (key: string, value: number) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, String(value));
  } catch (error) {
    console.warn(`[NewsStore] Failed to persist ${key}`, error);
  }
};

const initialCache = readCache();
const initialItems = initialCache?.items || [];
const initialLatestTimestamp = getNewsLatestTimestamp(initialItems);

let initialLastReadTimestamp = readNumericStorage(MC_UPDATES_LAST_READ_KEY);
if (!initialLastReadTimestamp && initialLatestTimestamp > 0) {
  initialLastReadTimestamp = initialLatestTimestamp;
  writeNumericStorage(MC_UPDATES_LAST_READ_KEY, initialLastReadTimestamp);
}

const computeUnreadCount = (items: MinecraftUpdateApiItem[]) =>
  getUnreadNewsCount(items, readNumericStorage(MC_UPDATES_LAST_READ_KEY));

export const useNewsStore = create<NewsState>((set, get) => ({
  rawItems: initialItems,
  isLoading: false,
  isRefreshing: false,
  error: null,
  lastFetchedAt: initialCache?.timestamp || null,
  unreadCount: computeUnreadCount(initialItems),
  startupItem: null,
  isStartupModalOpen: false,

  ensureSessionRefresh: async () => {
    if (sessionRefreshStarted) {
      if (inFlightRefresh) {
        await inFlightRefresh;
      }
      return;
    }

    sessionRefreshStarted = true;
    const refreshTask = get().refreshNews({ background: true });
    inFlightRefresh = refreshTask;

    try {
      await refreshTask;
    } finally {
      inFlightRefresh = null;
    }
  },

  refreshNews: async (options) => {
    const { background = false, signal } = options || {};
    const previousItems = get().rawItems;
    const previousLatestTimestamp = getNewsLatestTimestamp(previousItems);
    const hasExistingItems = previousItems.length > 0;
    const shouldBackgroundRefresh = background && hasExistingItems;

    set({
      isLoading: !shouldBackgroundRefresh,
      isRefreshing: shouldBackgroundRefresh,
      error: null,
    });

    try {
      const response = await fetch(MC_UPDATES_API_URL, {
        signal,
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as MinecraftUpdateApiItem[];
      const items = Array.isArray(payload) ? payload : [];
      const fetchedAt = Date.now();
      const latestTimestamp = getNewsLatestTimestamp(items);
      const lastReadTimestamp = readNumericStorage(MC_UPDATES_LAST_READ_KEY);
      const lastPromptedTimestamp = readNumericStorage(MC_UPDATES_LAST_PROMPTED_KEY);
      const unreadCount = getUnreadNewsCount(items, lastReadTimestamp);
      const latestUnreadItem = getLatestUnreadNewsItem(items, lastReadTimestamp);
      const shouldOpenStartupModal =
        previousLatestTimestamp > 0 &&
        !!latestUnreadItem &&
        getNewsItemTimestamp(latestUnreadItem) > lastPromptedTimestamp;

      set({
        rawItems: items,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastFetchedAt: fetchedAt,
        unreadCount,
        startupItem: shouldOpenStartupModal ? latestUnreadItem : null,
        isStartupModalOpen: shouldOpenStartupModal,
      });

      if (shouldOpenStartupModal && latestUnreadItem) {
        writeNumericStorage(MC_UPDATES_LAST_PROMPTED_KEY, getNewsItemTimestamp(latestUnreadItem));
      }

      if (!lastReadTimestamp && latestTimestamp > 0) {
        writeNumericStorage(MC_UPDATES_LAST_READ_KEY, latestTimestamp);
        set({
          unreadCount: 0,
          startupItem: null,
          isStartupModalOpen: false,
        });
      }

      writeCache(items);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        set({
          isLoading: false,
          isRefreshing: false,
        });
        return;
      }

      console.error('[NewsStore] Failed to fetch MC updates', error);

      const cached = readCache();
      if (cached?.items?.length) {
        set({
          rawItems: get().rawItems.length > 0 ? get().rawItems : cached.items,
          isLoading: false,
          isRefreshing: false,
          error: String(error),
          lastFetchedAt: get().lastFetchedAt || cached.timestamp,
          unreadCount: computeUnreadCount(get().rawItems.length > 0 ? get().rawItems : cached.items),
        });
        return;
      }

      set({
        isLoading: false,
        isRefreshing: false,
        error: String(error),
      });
    }
  },

  markAllRead: () => {
    const latestTimestamp = getNewsLatestTimestamp(get().rawItems);
    if (latestTimestamp > 0) {
      writeNumericStorage(MC_UPDATES_LAST_READ_KEY, latestTimestamp);
      writeNumericStorage(MC_UPDATES_LAST_PROMPTED_KEY, latestTimestamp);
    }

    set({
      unreadCount: 0,
      startupItem: null,
      isStartupModalOpen: false,
    });
  },

  dismissStartupModal: () => {
    set({
      isStartupModalOpen: false,
    });
  },
}));
