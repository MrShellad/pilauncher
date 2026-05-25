import { fetchCurseForgeVersions, hasCurseForgeApiKey } from '../../../Download/logic/curseforgeApi';
import { getModPlatformReference, type ModMeta } from '../../logic/modService';
import { fetchModrinthVersions, type OreProjectVersion } from '../../logic/modrinthApi';

export type ModSortType = 'time' | 'name' | 'fileName' | 'version' | 'update';
export type ModSortOrder = 'asc' | 'desc';

export interface LoadModsOptions {
  checkUpdates?: boolean;
  forceUpdateCheck?: boolean;
}

export interface ModUpdateCacheEntry {
  hasUpdate: boolean;
  updateVersionName?: string;
  updateFileId?: string;
  updateFileName?: string;
  updateDownloadUrl?: string;
  checkedAt: number;
}

export interface ModScanProgressPayload {
  instanceId: string;
  requestId?: string;
  mods: ModMeta[];
  complete: boolean;
}

export interface ModScanContext {
  cache?: Map<string, ModUpdateCacheEntry>;
}

export const autoUpdateCheckedKeys = new Set<string>();
export const updateCacheByInstance = new Map<string, Map<string, ModUpdateCacheEntry>>();

export const UPDATE_CACHE_TTL_MS = 30 * 60 * 1000;
export const UPDATE_CHECK_CONCURRENCY = 6;
export const UPDATE_STATE_FLUSH_SIZE = 12;
export const UPDATE_STATE_FLUSH_INTERVAL_MS = 1200;
export const SCAN_STATE_FLUSH_INTERVAL_MS = 100;
export const LOADING_EXIT_DELAY_MS = 180;

export const getUpdateScopeKey = (instanceId: string, gameVersion: string, loader: string) => {
  return `${instanceId}|${gameVersion || 'unknown'}|${loader || 'unknown'}`;
};

export const getModUpdateCacheKey = (mod: ModMeta) => {
  const modrinthReference = getModPlatformReference(mod, 'modrinth');
  const curseForgeReference = getModPlatformReference(mod, 'curseforge');

  if (modrinthReference?.projectId && modrinthReference.fileId) {
    return `modrinth:${modrinthReference.projectId}:${modrinthReference.fileId}`;
  }

  if (curseForgeReference?.projectId && curseForgeReference.fileId) {
    return `curseforge:${curseForgeReference.projectId}:${curseForgeReference.fileId}`;
  }

  return `file:${mod.fileName.replace(/\.disabled$/i, '')}`;
};

export const canCheckManagedUpdate = (mod: ModMeta) => {
  const source = mod.manifestEntry?.source;
  const modrinthReference = getModPlatformReference(mod, 'modrinth');
  const curseForgeReference = getModPlatformReference(mod, 'curseforge');

  if (source?.platform === 'curseforge') {
    return !!curseForgeReference?.projectId && !!curseForgeReference.fileId && hasCurseForgeApiKey();
  }

  if (source?.platform === 'modrinth') {
    return !!modrinthReference?.projectId && !!modrinthReference.fileId;
  }

  if (modrinthReference?.projectId && modrinthReference.fileId) return true;
  if (curseForgeReference?.projectId && curseForgeReference.fileId) return hasCurseForgeApiKey();

  return false;
};

export const fetchManagedVersions = (
  platform: string | undefined,
  projectId: string,
  gameVersion: string,
  loader: string
) => {
  if (platform === 'curseforge') {
    return fetchCurseForgeVersions(projectId, gameVersion, loader);
  }

  return fetchModrinthVersions(projectId, gameVersion, loader);
};

export const getOrCreateUpdateCache = (scopeKey: string) => {
  let cache = updateCacheByInstance.get(scopeKey);

  if (!cache) {
    cache = new Map<string, ModUpdateCacheEntry>();
    updateCacheByInstance.set(scopeKey, cache);
  }

  return cache;
};

export const isFreshUpdateCacheEntry = (entry?: ModUpdateCacheEntry) => {
  return !!entry && Date.now() - entry.checkedAt < UPDATE_CACHE_TTL_MS;
};

export const compareText = (left?: string, right?: string) => {
  return (left || '').localeCompare(right || '', undefined, {
    numeric: true,
    sensitivity: 'base'
  });
};

export const buildUpdateCacheEntry = (
  latest: OreProjectVersion | undefined,
  currentFileId: string
): ModUpdateCacheEntry => {
  if (!latest || latest.id === currentFileId) {
    return {
      hasUpdate: false,
      checkedAt: Date.now()
    };
  }

  return {
    hasUpdate: true,
    updateVersionName: latest.name || latest.version_number,
    updateDownloadUrl: latest.download_url,
    updateFileId: latest.id,
    updateFileName: latest.file_name,
    checkedAt: Date.now()
  };
};

export const applyCachedUpdateState = (
  mod: ModMeta,
  cache: Map<string, ModUpdateCacheEntry> | undefined
): ModMeta => {
  const cached = cache?.get(getModUpdateCacheKey(mod));

  return {
    ...mod,
    hasUpdate: cached?.hasUpdate ?? false,
    updateVersionName: cached?.updateVersionName,
    updateDownloadUrl: cached?.updateDownloadUrl,
    updateFileId: cached?.updateFileId,
    updateFileName: cached?.updateFileName,
    isFetchingNetwork: false,
    isCheckingUpdate: false,
    isUpdatingMod: false
  };
};

export const mergeModBatch = (current: ModMeta[], batch: ModMeta[]) => {
  if (batch.length === 0) {
    return current;
  }

  const byFileName = new Map(current.map((mod) => [mod.fileName, mod]));
  batch.forEach((mod) => {
    byFileName.set(mod.fileName, mod);
  });
  return Array.from(byFileName.values());
};

export const mergeSyncedModMetadata = (
  current: ModMeta[],
  previousMods: ModMeta[],
  syncedMods: ModMeta[]
) => {
  if (syncedMods.length === 0) {
    return current;
  }

  const changedByFileName = new Map<string, ModMeta>();
  syncedMods.forEach((mod, index) => {
    if (mod !== previousMods[index]) {
      changedByFileName.set(mod.fileName, mod);
    }
  });

  if (changedByFileName.size === 0) {
    return current;
  }

  return current.map((mod) => {
    const synced = changedByFileName.get(mod.fileName);

    if (!synced) {
      return mod;
    }

    return {
      ...synced,
      hasUpdate: mod.hasUpdate,
      updateVersionName: mod.updateVersionName,
      updateDownloadUrl: mod.updateDownloadUrl,
      updateFileId: mod.updateFileId,
      updateFileName: mod.updateFileName,
      isUpdatingMod: mod.isUpdatingMod
    };
  });
};

export const needsCloudSourceMatch = (mod: ModMeta) => {
  return !getModPlatformReference(mod, 'modrinth')?.fileId
    || !getModPlatformReference(mod, 'curseforge')?.fileId;
};
