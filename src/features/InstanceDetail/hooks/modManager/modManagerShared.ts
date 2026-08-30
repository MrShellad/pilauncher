import { fetchCurseForgeVersions, hasCurseForgeApiKey } from '../../../Download/logic/curseforgeApi';
import {
  getModPlatformReference,
  getModIdentityKey,
  isCompleteModPlatformReference,
  type ModMeta,
  type ModPlatformId
} from '../../logic/modService';
import { fetchModrinthVersions, type OreProjectVersion } from '../../logic/modrinthApi';

export type ModSortType = 'time' | 'name' | 'fileName' | 'version' | 'update';
export type ModSortOrder = 'asc' | 'desc';

export interface LoadModsOptions {
  checkUpdates?: boolean;
  forceUpdateCheck?: boolean;
  silent?: boolean;
}

export interface ModUpdateCacheEntry {
  hasUpdate: boolean;
  updateVersionName?: string;
  updatePlatform?: ModPlatformId;
  updateProjectId?: string;
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

export const getManagedUpdateReferences = (mod: ModMeta) => {
  const references: Array<{ platform: ModPlatformId; reference: NonNullable<ReturnType<typeof getModPlatformReference>> }> = [];

  for (const platform of ['modrinth', 'curseforge'] as ModPlatformId[]) {
    if (!isCompleteModPlatformReference(mod, platform)) continue;
    if (platform === 'curseforge' && !hasCurseForgeApiKey()) continue;

    const reference = getModPlatformReference(mod, platform);
    if (reference?.projectId && reference.fileId) {
      references.push({ platform, reference });
    }
  }

  return references;
};

export const getModUpdateCacheKey = (mod: ModMeta) => {
  const updateReferences = getManagedUpdateReferences(mod);
  if (updateReferences.length > 0) {
    return updateReferences
      .map(({ platform, reference }) => `${platform}:${reference.projectId}:${reference.fileId}`)
      .sort()
      .join('|');
  }

  const modrinthReference = getModPlatformReference(mod, 'modrinth');
  if (modrinthReference?.projectId && modrinthReference.fileId) {
    return `modrinth:${modrinthReference.projectId}:${modrinthReference.fileId}`;
  }

  const curseForgeReference = getModPlatformReference(mod, 'curseforge');
  if (curseForgeReference?.projectId && curseForgeReference.fileId) {
    return `curseforge:${curseForgeReference.projectId}:${curseForgeReference.fileId}`;
  }

  return `file:${mod.fileName.replace(/\.disabled$/i, '')}`;
};

export const canCheckManagedUpdate = (mod: ModMeta) => {
  return getManagedUpdateReferences(mod).length > 0;
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
  currentFileId: string,
  platform?: ModPlatformId,
  projectId?: string,
  currentVersionNumber?: string
): ModUpdateCacheEntry => {
  const isSameVersion =
    !latest ||
    latest.id === currentFileId ||
    (Boolean(currentVersionNumber) &&
      Boolean(latest.version_number) &&
      latest.version_number.trim().toLowerCase() === String(currentVersionNumber).trim().toLowerCase());

  if (isSameVersion) {
    return {
      hasUpdate: false,
      checkedAt: Date.now()
    };
  }

  return {
    hasUpdate: true,
    // `name` 经常是“MOD 名称 + 版本号”的展示文案；列表标签应只使用版本号。
    updateVersionName: latest.version_number || latest.name,
    updatePlatform: platform,
    updateProjectId: projectId,
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

  if (!cached) {
    return {
      ...mod,
      isFetchingNetwork: false,
      isCheckingUpdate: false,
      isUpdatingMod: mod.isUpdatingMod ?? false
    };
  }

  return {
    ...mod,
    hasUpdate: cached.hasUpdate,
    updateVersionName: cached.updateVersionName,
    updatePlatform: cached.updatePlatform,
    updateProjectId: cached.updateProjectId,
    updateDownloadUrl: cached.updateDownloadUrl,
    updateFileId: cached.updateFileId,
    updateFileName: cached.updateFileName,
    isFetchingNetwork: false,
    isCheckingUpdate: false,
    isUpdatingMod: mod.isUpdatingMod ?? false
  };
};

const mergePlatformMatches = (
  current: ModMeta['manifestEntry'],
  incoming: ModMeta['manifestEntry']
) => {
  const merged = { ...(current?.matchedPlatforms || {}) };
  Object.entries(incoming?.matchedPlatforms || {}).forEach(([platform, reference]) => {
    const previous = merged[platform];
    merged[platform] = {
      ...previous,
      ...reference,
      projectId: reference.projectId || previous?.projectId,
      fileId: reference.fileId || previous?.fileId
    };
  });
  return merged;
};

export const mergeModManifestEntry = (
  current: ModMeta['manifestEntry'],
  incoming: ModMeta['manifestEntry']
): ModMeta['manifestEntry'] => {
  if (!current) return incoming;
  if (!incoming) return current;

  const currentSource = current.source;
  const incomingSource = incoming.source;
  const incomingKind = incomingSource?.kind;

  return {
    ...current,
    ...incoming,
    source: {
      ...currentSource,
      ...incomingSource,
      kind: incomingKind && incomingKind !== 'unknown' ? incomingKind : currentSource.kind,
      platform: incomingSource?.platform || currentSource.platform,
      projectId: incomingSource?.projectId || currentSource.projectId,
      fileId: incomingSource?.fileId || currentSource.fileId
    },
    matchedPlatforms: mergePlatformMatches(current, incoming)
  };
};

const isCleanVersion = (v?: string) =>
  !!v && !v.endsWith('.jar') && !v.endsWith('.disabled') && !v.startsWith('${') && !v.includes('+');

export const mergeModMetadataIdentity = (current: ModMeta, incoming: ModMeta): ModMeta => {
  const archiveChanged = !!current.sha1 && !!incoming.sha1 && current.sha1 !== incoming.sha1;
  if (archiveChanged) return incoming;

  const finalVersion = (isCleanVersion(current.version) && !isCleanVersion(incoming.version))
    ? current.version
    : (incoming.version || current.version);

  return {
    ...current,
    name: incoming.name || current.name,
    description: incoming.description || current.description,
    version: finalVersion,
    iconAbsolutePath: incoming.iconAbsolutePath || current.iconAbsolutePath,
    offlineJarIconAbsolutePath: incoming.offlineJarIconAbsolutePath || current.offlineJarIconAbsolutePath,
    networkIconUrl: incoming.networkIconUrl || current.networkIconUrl,
    networkInfo: incoming.networkInfo || current.networkInfo,
    isFetchingNetwork: incoming.isFetchingNetwork ?? current.isFetchingNetwork,
    cacheKey: incoming.cacheKey || current.cacheKey,
    curseforgeFingerprint: incoming.curseforgeFingerprint || current.curseforgeFingerprint,
    sha1: incoming.sha1 || current.sha1,
    dependencies: incoming.dependencies || current.dependencies,
    dependentsCount: incoming.dependentsCount ?? current.dependentsCount,
    aliases: incoming.aliases || current.aliases,
    hasUpdate: incoming.hasUpdate ?? current.hasUpdate,
    updateVersionName: incoming.updateVersionName ?? current.updateVersionName,
    updatePlatform: incoming.updatePlatform ?? current.updatePlatform,
    updateProjectId: incoming.updateProjectId ?? current.updateProjectId,
    updateDownloadUrl: incoming.updateDownloadUrl ?? current.updateDownloadUrl,
    updateFileId: incoming.updateFileId ?? current.updateFileId,
    updateFileName: incoming.updateFileName ?? current.updateFileName,
    isUpdatingMod: incoming.isUpdatingMod ?? current.isUpdatingMod,
    manifestEntry: mergeModManifestEntry(current.manifestEntry, incoming.manifestEntry)
  };
};

export const mergeModBatch = (current: ModMeta[], batch: ModMeta[]) => {
  if (batch.length === 0) {
    return current;
  }

  const next = [...current];
  batch.forEach((mod) => {
    const identityKey = getModIdentityKey(mod);
    const index = next.findIndex((currentMod) => (
      getModIdentityKey(currentMod) === identityKey
      || currentMod.fileName === mod.fileName
      || currentMod.fileName.replace(/\.disabled$/i, '') === mod.fileName.replace(/\.disabled$/i, '')
    ));

    if (index >= 0) {
      next[index] = mergeModMetadataIdentity(next[index], mod);
    } else {
      next.push(mod);
    }
  });
  return next;
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
      updatePlatform: mod.updatePlatform,
      updateProjectId: mod.updateProjectId,
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
