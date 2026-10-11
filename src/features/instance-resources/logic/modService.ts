import { invoke } from '@tauri-apps/api/core';

import type {
  InstanceDependencyHealth,
  InstanceSnapshot,
  InstanceVersionConfig,
  ModCacheUpdateItem,
  ModFileCleanupResult,
  ModMeta,
  ModMetadataSettings,
  ModPlatformMatch,
  ModPlatformMatchBatchItem,
  ModRelationRecord,
  ModUpdateInfo,
  SnapshotDiff,
  SnapshotRollbackResult,
} from './modTypes';

const modManifestCache = new Map<string, ModMeta[]>();

const cloneModList = (mods: ModMeta[]) => mods.map((mod) => ({ ...mod }));

export const modService = {
  getInstanceDetail: (id: string) =>
    invoke<InstanceVersionConfig>('get_instance_detail', { id }),

  getMods: (id: string, requestId?: string) =>
    invoke<ModMeta[]>('get_instance_mods', { id, requestId }),

  getManifestModsSnapshot: (id: string) => {
    const cached = modManifestCache.get(id);
    return cached ? cloneModList(cached) : null;
  },

  getCachedModManifest: async (id: string, forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = modManifestCache.get(id);
      if (cached) return cloneModList(cached);
    }

    const mods = forceRefresh
      ? await invoke<ModMeta[]>('get_instance_mods', { id, requestId: null })
      : await invoke<ModMeta[]>('get_instance_mod_manifest_cache', { id });
    modManifestCache.set(id, mods || []);
    return cloneModList(mods || []);
  },

  invalidateModManifestCache: (id: string) => {
    modManifestCache.delete(id);
  },

  toggleMod: (id: string, fileName: string, enable: boolean) =>
    invoke('toggle_resource', { id, resType: 'mod', fileName, enable }),

  deleteMod: (id: string, fileName: string) => {
    modManifestCache.delete(id);
    return invoke('delete_resource', { id, resType: 'mod', fileName })
      .finally(() => {
        modManifestCache.delete(id);
      });
  },

  takeSnapshot: (id: string, trigger: string, message: string) =>
    invoke<InstanceSnapshot>('take_snapshot', { instanceId: id, trigger, message }),

  getSnapshotHistory: (id: string) =>
    invoke<InstanceSnapshot[]>('get_snapshot_history', { instanceId: id }),

  calculateSnapshotDiff: (id: string, oldId: string, newId: string) =>
    invoke<SnapshotDiff>('calculate_snapshot_diff', { instanceId: id, oldId, newId }),

  rollbackInstance: (id: string, snapshotId: string) =>
    invoke<SnapshotRollbackResult>('rollback_instance', { instanceId: id, snapshotId }),

  updateModCacheBatch: (items: ModCacheUpdateItem[]): Promise<Record<string, string | null>> =>
    invoke<Record<string, string | null>>('update_mod_cache_batch', { items }),

  updateModCache: (
    cacheKey: string,
    name: string,
    desc: string,
    iconUrl: string,
    modId?: string,
    curseforgeFingerprint?: number,
    modrinthHash?: string,
    curseforgeProjectId?: string,
    modrinthProjectId?: string
  ) =>
    invoke<string | null>('update_mod_cache', {
      cacheKey,
      name,
      desc,
      iconUrl,
      modId,
      curseforgeFingerprint,
      modrinthHash,
      curseforgeProjectId,
      modrinthProjectId
    }),

  ensureOfflineJarIcon: (instanceId: string, fileName: string) =>
    invoke<string | null>('ensure_offline_jar_icon', { instanceId, fileName }),

  updateModManifest: (
    instanceId: string,
    fileName: string,
    sourceKind: string,
    platform: string,
    projectId: string,
    fileId: string,
    version?: string,
    oldFileName?: string
  ) => {
    modManifestCache.delete(instanceId);
    return invoke('update_mod_manifest', {
      instanceId,
      fileName,
      sourceKind,
      platform,
      projectId,
      fileId,
      version,
      oldFileName
    })
      .finally(() => {
        modManifestCache.delete(instanceId);
      });
  },

  updateAllModsMetadataSettings: (
    instanceId: string,
    settings: ModMetadataSettings
  ) => {
    modManifestCache.delete(instanceId);
    return invoke('update_all_mods_metadata_settings', { instanceId, settings })
      .finally(() => {
        modManifestCache.delete(instanceId);
      });
  },

  resetAllModsPlatformMetadata: (instanceId: string) => {
    modManifestCache.delete(instanceId);
    return invoke('reset_all_mods_platform_metadata', { instanceId })
      .finally(() => {
        modManifestCache.delete(instanceId);
      });
  },

  updateModPlatformMatches: (
    instanceId: string,
    fileName: string,
    matches: Record<string, ModPlatformMatch>
  ) => {
    modManifestCache.delete(instanceId);
    return invoke('update_mod_platform_matches', { instanceId, fileName, matches })
      .finally(() => {
        modManifestCache.delete(instanceId);
      });
  },

  updateModPlatformMatchesBatch: (
    instanceId: string,
    updates: ModPlatformMatchBatchItem[]
  ) => {
    if (!updates || updates.length === 0) return Promise.resolve();
    modManifestCache.delete(instanceId);
    return invoke('update_mod_platform_matches_batch', {
      instanceId,
      updates: updates.map((update) => ({
        file_name: update.fileName,
        source_platform: update.sourcePlatform ?? null,
        source_project_id: update.sourceProjectId ?? null,
        source_file_id: update.sourceFileId ?? null,
        version: update.version ?? null,
      })),
    })
      .finally(() => {
        modManifestCache.delete(instanceId);
      });
  },

  updateModMetadataSettings: (
    instanceId: string,
    fileName: string,
    settings: ModMetadataSettings
  ) => {
    modManifestCache.delete(instanceId);
    return invoke('update_mod_metadata_settings', { instanceId, fileName, settings })
      .finally(() => {
        modManifestCache.delete(instanceId);
      });
  },

  resetModPlatformMetadata: (instanceId: string, fileName: string) => {
    modManifestCache.delete(instanceId);
    return invoke('reset_mod_platform_metadata', { instanceId, fileName })
      .finally(() => {
        modManifestCache.delete(instanceId);
      });
  },

  downloadResource: (url: string, fileName: string, instanceId: string, subFolder: string, taskId?: string) =>
    invoke('download_resource', { url, fileName, instanceId, subFolder, taskId }),

  openModFolder: (id: string) =>
    invoke('open_mod_folder', { id }),

  executeModFileCleanup: (id: string, items: { originalFileName: string; suggestedFileName: string }[]) => {
    modManifestCache.delete(id);
    return invoke<ModFileCleanupResult>('execute_mod_file_cleanup', { id, items })
      .finally(() => {
        modManifestCache.delete(id);
      });
  },

  getInstanceDependencyHealth: (id: string): Promise<InstanceDependencyHealth> =>
    invoke<InstanceDependencyHealth>('get_instance_dependency_health', { id }),

  getCascadingDependents: (id: string, fileName: string): Promise<string[]> =>
    invoke<string[]>('get_cascading_dependents', { id, fileName }),

  getCascadingDependentsBatch: (id: string, fileNames: string[]): Promise<string[]> =>
    invoke<string[]>('get_cascading_dependents_batch', { id, fileNames }),

  toggleModsCascading: (id: string, fileNames: string[], enable: boolean): Promise<Array<[string, string]>> =>
    invoke<Array<[string, string]>>('toggle_mods_cascading', { id, fileNames, enable }),

  syncInstanceModsCloudMetadata: (id: string, force?: boolean, globalPlatform?: string, curseforgeKey?: string, fileNames?: string[]): Promise<ModMeta[]> =>
    invoke<ModMeta[]>('sync_instance_mods_cloud_metadata', { id, force, globalPlatform, curseforgeKey, fileNames }),

  checkInstanceModsUpdates: (id: string, gameVersion: string, loader: string, force?: boolean, curseforgeKey?: string): Promise<ModUpdateInfo[]> =>
    invoke<ModUpdateInfo[]>('check_instance_mods_updates', { id, gameVersion, loader, force, curseforgeKey }),

  saveModRelations: (relations: ModRelationRecord[]): Promise<void> =>
    invoke('save_mod_relations', { relations })
};
