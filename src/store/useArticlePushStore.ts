import { create } from 'zustand';

import {
  ARTICLE_PUSH_LAST_PROMPTED_KEY,
  ARTICLE_PUSH_LATEST_API_URL,
  getArticlePushPromptKey,
  type ArticlePush,
} from '../features/home/data/articlePush';

interface RefreshLatestPushOptions {
  openIfNew?: boolean;
  signal?: AbortSignal;
}

interface ArticlePushState {
  latestPush: ArticlePush | null;
  isLoading: boolean;
  error: string | null;
  isStartupModalOpen: boolean;
  ensureSessionRefresh: () => Promise<void>;
  refreshLatestPush: (options?: RefreshLatestPushOptions) => Promise<void>;
  dismissStartupModal: () => void;
}

let sessionRefreshStarted = false;
let inFlightRefresh: Promise<void> | null = null;

const readLastPromptedKey = () => {
  if (typeof window === 'undefined') return '';

  try {
    return window.localStorage.getItem(ARTICLE_PUSH_LAST_PROMPTED_KEY) || '';
  } catch {
    return '';
  }
};

const writeLastPromptedKey = (key: string) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(ARTICLE_PUSH_LAST_PROMPTED_KEY, key);
  } catch (error) {
    console.warn('[ArticlePushStore] Failed to persist prompted key', error);
  }
};

const isValidArticlePush = (value: unknown): value is ArticlePush => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<ArticlePush>;
  return typeof record.id === 'string' && typeof record.title === 'string';
};

export const useArticlePushStore = create<ArticlePushState>((set, get) => ({
  latestPush: null,
  isLoading: false,
  error: null,
  isStartupModalOpen: false,

  ensureSessionRefresh: async () => {
    if (sessionRefreshStarted) {
      if (inFlightRefresh) {
        await inFlightRefresh;
      }
      return;
    }

    sessionRefreshStarted = true;
    const refreshTask = get().refreshLatestPush({ openIfNew: true });
    inFlightRefresh = refreshTask;

    try {
      await refreshTask;
    } finally {
      inFlightRefresh = null;
    }
  },

  refreshLatestPush: async (options) => {
    const { openIfNew = false, signal } = options || {};

    set({
      isLoading: true,
      error: null,
    });

    try {
      const response = await fetch(ARTICLE_PUSH_LATEST_API_URL, {
        signal,
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      if (response.status === 404) {
        set({
          latestPush: null,
          isLoading: false,
          isStartupModalOpen: false,
          error: null,
        });
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      if (!isValidArticlePush(payload)) {
        throw new Error('Invalid article push payload');
      }

      const promptKey = getArticlePushPromptKey(payload);
      const shouldOpen = openIfNew && promptKey !== readLastPromptedKey();

      set({
        latestPush: payload,
        isLoading: false,
        isStartupModalOpen: shouldOpen,
        error: null,
      });

      if (shouldOpen) {
        writeLastPromptedKey(promptKey);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        set({
          isLoading: false,
        });
        return;
      }

      console.warn('[ArticlePushStore] Failed to fetch article push', error);
      set({
        isLoading: false,
        error: String(error),
      });
    }
  },

  dismissStartupModal: () => {
    set({
      isStartupModalOpen: false,
    });
  },
}));
