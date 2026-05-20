import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

import { fetchCurseForgeVersions } from '../../Download/logic/curseforgeApi';
import type { DownloadSource } from '../../Download/hooks/useResourceDownload';
import {
  fetchModrinthVersions,
  type ModrinthProject,
  type OreProjectDependency,
  type OreProjectVersion
} from '../../InstanceDetail/logic/modrinthApi';
import i18n from '../../../ui/i18';

export type ModSetTrackerItemStatus = 'ready' | 'pending' | 'unknown' | 'ignored' | 'removed';
export type ModSetTrackerReadinessStatus = 'checking' | 'partial' | 'ready' | 'error';

export interface ModSetTrackerProject {
  itemId: string;
  source: DownloadSource;
  projectId: string;
  title: string;
  author?: string;
  iconUrl?: string;
}

export interface ModSetTrackerItem {
  itemId: string;
  source: DownloadSource;
  projectId: string;
  title: string;
  status: ModSetTrackerItemStatus;
  matchedVersionId?: string;
  matchedVersionNumber?: string;
  matchedFileName?: string;
  matchedDownloadUrl?: string;
  dependencies?: OreProjectDependency[];
  publishedAt?: string;
  checkedAt?: number;
  error?: string;
}

export interface ModSetTracker {
  id: string;
  collectionId: string;
  collectionName: string;
  gameVersion: string;
  loader: string;
  readinessStatus: ModSetTrackerReadinessStatus;
  readyCount: number;
  totalCount: number;
  projects: ModSetTrackerProject[];
  items: ModSetTrackerItem[];
  lastCheckedAt?: number;
  notifiedReadyAt?: number;
  createdAt: number;
  updatedAt: number;
}

interface CreateTrackerInput {
  collectionId: string;
  collectionName: string;
  gameVersion: string;
  loader: string;
  projects: ModSetTrackerProject[];
}

interface ModSetTrackerState {
  trackers: ModSetTracker[];
  isChecking: boolean;
  loadTrackers: () => Promise<void>;
  createTracker: (input: CreateTrackerInput) => ModSetTracker;
  updateTrackerTarget: (trackerId: string, gameVersion: string, loader: string) => void;
  checkTracker: (trackerId: string) => Promise<void>;
  removeTracker: (trackerId: string) => void;
  removeTrackersForCollection: (collectionId: string) => void;
  renameTrackersForCollection: (collectionId: string, collectionName: string) => void;
  removeProjectFromCollectionTrackers: (
    collectionId: string,
    item: { itemId: string; source?: string; projectId?: string },
  ) => void;
  syncCollectionTrackers: (collectionId: string, allowedKeys: string[]) => void;
}

const STORAGE_KEY = 'ore-mod-set-trackers-v1';

const nowSeconds = () => Math.floor(Date.now() / 1000);

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const persistTrackers = async (trackers: ModSetTracker[]) => {
  try {
    await invoke('replace_mod_set_trackers', { trackers });
  } catch (error) {
    console.warn('[ModSetTracker] Failed to persist trackers to SQLite', error);
  }
};

const readLegacyTrackers = (): ModSetTracker[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const clearLegacyTrackers = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore localStorage cleanup failures; SQLite is now the source of truth.
  }
};

const sortVersions = (versions: OreProjectVersion[]) =>
  [...versions].sort((a, b) => {
    const left = new Date(a.date_published).getTime();
    const right = new Date(b.date_published).getTime();
    if (Number.isFinite(left) && Number.isFinite(right) && left !== right) {
      return right - left;
    }
    return b.version_number.localeCompare(a.version_number);
  });

const fetchVersionsForProject = (
  project: ModSetTrackerProject,
  gameVersion: string,
  loader: string,
) => {
  if (project.source === 'curseforge') {
    return fetchCurseForgeVersions(project.projectId, gameVersion, loader);
  }
  return fetchModrinthVersions(project.projectId, gameVersion, loader);
};

const toTrackerItem = (
  project: ModSetTrackerProject,
  status: ModSetTrackerItemStatus,
  checkedAt: number,
  match?: OreProjectVersion,
  error?: string,
): ModSetTrackerItem => ({
  itemId: project.itemId,
  source: project.source,
  projectId: project.projectId,
  title: project.title,
  status,
  matchedVersionId: match?.id,
  matchedVersionNumber: match?.version_number,
  matchedFileName: match?.file_name,
  matchedDownloadUrl: match?.download_url,
  dependencies: match?.dependencies,
  publishedAt: match?.date_published,
  checkedAt,
  error,
});

const normalizeKey = (value?: string | null) => value?.trim().toLowerCase() || '';

const getProjectKeys = (item: {
  itemId?: string;
  source?: string;
  projectId?: string;
}) => {
  const keys = new Set<string>();
  const itemId = normalizeKey(item.itemId);
  const source = normalizeKey(item.source);
  const projectId = normalizeKey(item.projectId);

  if (itemId) keys.add(itemId);
  if (projectId) keys.add(projectId);
  if (source && projectId) keys.add(`${source}:${projectId}`);

  return keys;
};

const hasMatchingKey = (
  item: { itemId?: string; source?: string; projectId?: string },
  keys: Set<string>,
) => {
  for (const key of getProjectKeys(item)) {
    if (keys.has(key)) return true;
  }
  return false;
};

const getTrackerCounts = (items: ModSetTrackerItem[]) => {
  const totalCount = items.filter((item) => item.status !== 'ignored' && item.status !== 'removed').length;
  const readyCount = items.filter((item) => item.status === 'ready').length;
  return { readyCount, totalCount };
};

const getReadinessStatus = (items: ModSetTrackerItem[]): ModSetTrackerReadinessStatus => {
  const { readyCount, totalCount } = getTrackerCounts(items);
  const hasUnknown = items.some((item) => item.status === 'unknown');

  if (totalCount > 0 && readyCount === totalCount) return 'ready';
  if (hasUnknown && readyCount === 0) return 'error';
  return 'partial';
};

const refreshTrackerCounts = (tracker: ModSetTracker, updatedAt: number): ModSetTracker => {
  const { readyCount, totalCount } = getTrackerCounts(tracker.items);
  return {
    ...tracker,
    readyCount,
    totalCount,
    readinessStatus: getReadinessStatus(tracker.items),
    notifiedReadyAt:
      readyCount > 0 && readyCount === totalCount
        ? (tracker.notifiedReadyAt || updatedAt)
        : undefined,
    updatedAt,
  };
};

export const toModSetTrackerProject = (project: ModrinthProject): ModSetTrackerProject | null => {
  const source = (project.source || 'modrinth') as DownloadSource;
  const projectId = project.id || project.project_id || project.slug;
  if (!projectId) return null;

  return {
    itemId: `${source}:${projectId}`,
    source,
    projectId,
    title: project.title || projectId,
    author: project.author,
    iconUrl: project.icon_url,
  };
};

export const useModSetTrackerStore = create<ModSetTrackerState>((set, get) => ({
  trackers: [],
  isChecking: false,
  loadTrackers: async () => {
    try {
      const trackers = await invoke<ModSetTracker[]>('get_mod_set_trackers');
      if (trackers.length > 0) {
        set({ trackers });
        clearLegacyTrackers();
        return;
      }

      const legacyTrackers = readLegacyTrackers();
      if (legacyTrackers.length > 0) {
        await persistTrackers(legacyTrackers);
        clearLegacyTrackers();
        set({ trackers: legacyTrackers });
        return;
      }

      set({ trackers: [] });
    } catch (error) {
      console.warn('[ModSetTracker] Failed to load trackers from SQLite', error);
      const legacyTrackers = readLegacyTrackers();
      set({ trackers: legacyTrackers });
    }
  },
  createTracker: (input) => {
    const timestamp = nowSeconds();
    const existing = get().trackers.filter((tracker) =>
      !(
        tracker.collectionId === input.collectionId &&
        tracker.gameVersion === input.gameVersion &&
        tracker.loader === input.loader
      )
    );
    const tracker: ModSetTracker = {
      id: createId('tracker'),
      collectionId: input.collectionId,
      collectionName: input.collectionName,
      gameVersion: input.gameVersion,
      loader: input.loader,
      readinessStatus: 'checking',
      readyCount: 0,
      totalCount: input.projects.length,
      projects: input.projects,
      items: input.projects.map((project) => toTrackerItem(project, 'unknown', timestamp)),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const next = [tracker, ...existing];
    void persistTrackers(next);
    set({ trackers: next });
    return tracker;
  },
  updateTrackerTarget: (trackerId, gameVersion, loader) => {
    const timestamp = nowSeconds();
    const next = get().trackers.map((tracker) => {
      if (tracker.id !== trackerId) return tracker;

      return {
        ...tracker,
        gameVersion,
        loader,
        readinessStatus: 'checking' as ModSetTrackerReadinessStatus,
        readyCount: 0,
        totalCount: tracker.projects.length,
        items: tracker.projects.map((project) => toTrackerItem(project, 'unknown', timestamp)),
        lastCheckedAt: undefined,
        notifiedReadyAt: undefined,
        updatedAt: timestamp,
      };
    });

    void persistTrackers(next);
    set({ trackers: next });
  },
  checkTracker: async (trackerId) => {
    const tracker = get().trackers.find((item) => item.id === trackerId);
    if (!tracker) return;

    set({ isChecking: true });
    const checkedAt = nowSeconds();

    const settled = await Promise.allSettled(
      tracker.projects.map(async (project) => {
        const versions = await fetchVersionsForProject(project, tracker.gameVersion, tracker.loader);
        const match = sortVersions(versions).find((version) => {
          const gameOk = version.game_versions.includes(tracker.gameVersion);
          const loaderOk = version.loaders.some((loader) => loader.toLowerCase() === tracker.loader.toLowerCase());
          return gameOk && loaderOk && version.download_url && version.file_name;
        });
        return toTrackerItem(project, match ? 'ready' : 'pending', checkedAt, match);
      })
    );

    const items = tracker.projects.map((project, index) => {
      const result = settled[index];
      if (result?.status === 'fulfilled') return result.value;
      return toTrackerItem(project, 'unknown', checkedAt, undefined, String(result?.reason || i18n.t('libraryPage.tracker.checkFailed')));
    });
    const { readyCount, totalCount } = getTrackerCounts(items);
    const readinessStatus = getReadinessStatus(items);

    const nextTrackers = get().trackers.map((item) => item.id === trackerId
      ? {
        ...item,
        items,
        readyCount,
        totalCount,
        readinessStatus,
        lastCheckedAt: checkedAt,
        notifiedReadyAt: readinessStatus === 'ready' ? (item.notifiedReadyAt || checkedAt) : item.notifiedReadyAt,
        updatedAt: checkedAt,
      }
      : item
    );

    void persistTrackers(nextTrackers);
    set({ trackers: nextTrackers, isChecking: false });
  },
  removeTracker: (trackerId) => {
    const next = get().trackers.filter((tracker) => tracker.id !== trackerId);
    void persistTrackers(next);
    set({ trackers: next });
  },
  removeTrackersForCollection: (collectionId) => {
    const next = get().trackers.filter((tracker) => tracker.collectionId !== collectionId);
    void persistTrackers(next);
    set({ trackers: next });
  },
  renameTrackersForCollection: (collectionId, collectionName) => {
    const normalizedName = collectionName.trim();
    if (!normalizedName) return;

    const timestamp = nowSeconds();
    let changed = false;
    const next = get().trackers.map((tracker) => {
      if (tracker.collectionId !== collectionId || tracker.collectionName === normalizedName) return tracker;

      changed = true;
      return {
        ...tracker,
        collectionName: normalizedName,
        updatedAt: timestamp,
      };
    });

    if (!changed) return;
    void persistTrackers(next);
    set({ trackers: next });
  },
  removeProjectFromCollectionTrackers: (collectionId, item) => {
    const removalKeys = getProjectKeys(item);
    if (removalKeys.size === 0) return;

    const timestamp = nowSeconds();
    let changed = false;
    const next = get().trackers.map((tracker) => {
      if (tracker.collectionId !== collectionId) return tracker;

      const projects = tracker.projects.filter((project) => !hasMatchingKey(project, removalKeys));
      const items = tracker.items.filter((trackerItem) => !hasMatchingKey(trackerItem, removalKeys));
      if (projects.length === tracker.projects.length && items.length === tracker.items.length) return tracker;

      changed = true;
      return refreshTrackerCounts({ ...tracker, projects, items }, timestamp);
    });

    if (!changed) return;
    void persistTrackers(next);
    set({ trackers: next });
  },
  syncCollectionTrackers: (collectionId, allowedKeys) => {
    const allowed = new Set(allowedKeys.map(normalizeKey).filter(Boolean));
    const timestamp = nowSeconds();
    let changed = false;

    const next = get().trackers.map((tracker) => {
      if (tracker.collectionId !== collectionId) return tracker;

      const projects = tracker.projects.filter((project) => hasMatchingKey(project, allowed));
      const items = tracker.items.filter((trackerItem) => hasMatchingKey(trackerItem, allowed));
      if (projects.length === tracker.projects.length && items.length === tracker.items.length) return tracker;

      changed = true;
      return refreshTrackerCounts({ ...tracker, projects, items }, timestamp);
    });

    if (!changed) return;
    void persistTrackers(next);
    set({ trackers: next });
  },
}));
