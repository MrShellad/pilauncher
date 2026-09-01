// /src/features/InstanceDetail/logic/modService.ts
import { invoke } from '@tauri-apps/api/core';
import type { ModrinthProject } from './modrinthApi';

export interface ModPlatformMatch {
  projectId?: string;
  fileId?: string;
}

export interface ModPlatformMatchBatchItem {
  fileName: string;
  sourcePlatform?: string | null;
  sourceProjectId?: string | null;
  sourceFileId?: string | null;
  version?: string | null;
}

export interface ModCacheUpdateItem {
  cacheKey: string;
  name: string;
  desc: string;
  iconUrl: string;
  modId?: string | null;
  curseforgeFingerprint?: number | null;
  modrinthHash?: string | null;
  curseforgeProjectId?: string | null;
  modrinthProjectId?: string | null;
}

export type ModPlatformId = 'modrinth' | 'curseforge';
export type ModPlatformPreference = 'auto' | ModPlatformId;

export interface ModMetadataSettings {
  metadataPlatform?: ModPlatformPreference;
  updatePlatform?: ModPlatformPreference;
  metadataLocked?: boolean;
  updateLocked?: boolean;
}

export interface ModManifestEntry {
  source: {
    kind: 'externalImport' | 'launcherDownload' | 'modpackDeployment' | 'unknown';
    platform?: string;
    projectId?: string;
    fileId?: string;
  };
  hash: {
    algorithm: string;
    value: string;
  };
  fileState?: {
    size: number;
    modifiedAt: number;
  };
  icon_rel_path?: string;
  networkIconRelPath?: string;
  jarFallbackIconRelPath?: string;
  curseforgeFingerprint?: number;
  matchedPlatforms?: Record<string, ModPlatformMatch>;
  metadataSettings?: ModMetadataSettings;
  dependencies?: string[];
  aliases?: string[];
}

export interface ModMeta {
  fileName: string;
  modId?: string;
  name?: string;
  version?: string;
  description?: string;
  iconAbsolutePath?: string;
  offlineJarIconAbsolutePath?: string;
  networkIconUrl?: string; 
  curseforgeFingerprint?: number;
  sha1?: string;
  fileSize: number;
  isEnabled: boolean; 
  modifiedAt: number;
  networkInfo?: ModrinthProject | null;
  isFetchingNetwork?: boolean;
  manifestEntry?: ModManifestEntry;
  // Update fields
  hasUpdate?: boolean;
  updateVersionName?: string;
  updatePlatform?: ModPlatformId;
  updateProjectId?: string;
  updateFileId?: string;
  updateFileName?: string;
  updateDownloadUrl?: string;
  isCheckingUpdate?: boolean;
  isUpdatingMod?: boolean;
  cacheKey?: string;
  dependencies?: string[];
  aliases?: string[];
  dependentsCount?: number;
}

export type ModVersionInstallAction = 'install' | 'upgrade' | 'downgrade' | 'reinstall';
export type ModMetadataPurpose = 'metadata' | 'update';

export const resolveInstanceGameVersion = (config: any): string => {
  return config?.game_version || config?.gameVersion || config?.mcVersion || '';
};

export const resolveInstanceLoader = (config: any): string => {
  const rawLoader = config?.loader;
  const loader = typeof rawLoader === 'string'
    ? rawLoader
    : rawLoader?.type || config?.loaderType || config?.loader_type || '';

  return loader && loader.toLowerCase() !== 'vanilla' ? loader.toLowerCase() : '';
};

const normalizeInstalledKey = (value?: string | null) => String(value || '').trim();

const GENERIC_MOD_STOPWORDS = new Set([
  'api', 'core', 'lib', 'library', 'mod', 'mods', 'client', 'server', 'addon',
  'addons', 'tool', 'tools', 'utils', 'util', 'utility', 'config', 'configuration',
  'gui', 'ui', 'hud', 'fps', 'fix', 'fixes', 'plus', 'extra', 'extras',
  'fabric', 'forge', 'neoforge', 'quilt', 'liteloader', 'vanilla',
  'optifine', 'patch', 'port', 'edition', 'reforged', 'fork', 'v1', 'v2', 'v3'
]);

const normalizeModIdentity = (value?: string | null): string => {
  let normalized = normalizeInstalledKey(value).toLowerCase();
  normalized = normalized.replace(/\.disabled$/i, '').replace(/\.(jar|zip)$/i, '');
  normalized = normalized.replace(/[-_+](?:fabric|forge|neoforge|quilt)(?=[-_+]|$).*$/i, '');
  normalized = normalized.replace(/[-_+]v?\d+(?:[._+-]\w+)*.*$/i, '');
  return normalized.replace(/[^a-z0-9]/g, '');
};

const getModIdentityVariants = (value?: string | null): string[] => {
  const normalized = normalizeModIdentity(value);
  if (!normalized || normalized.length <= 3 || GENERIC_MOD_STOPWORDS.has(normalized)) return [];

  const variants = new Set([normalized]);
  if (normalized.endsWith('v2') && normalized.length > 5) {
    const base = normalized.slice(0, -2);
    if (!GENERIC_MOD_STOPWORDS.has(base) && base.length > 3) variants.add(base);
  } else if (normalized.endsWith('2') && normalized.length > 4) {
    const base = normalized.slice(0, -1);
    if (!GENERIC_MOD_STOPWORDS.has(base) && base.length > 3) variants.add(base);
  }
  return [...variants];
};

export interface ModDependencyIdentity {
  projectId: string;
  slug?: string | null;
  name?: string | null;
}

export type InstalledDependencyStatus = 'installed' | 'disabled' | 'missing';

export interface InstalledDependencyMatch {
  status: InstalledDependencyStatus;
  matchedBy?: 'projectId' | 'alias';
}

export const getModPlatformReference = (
  mod: ModMeta,
  platform: ModPlatformId
): ModPlatformMatch | undefined => {
  const source = mod.manifestEntry?.source;
  const matched = mod.manifestEntry?.matchedPlatforms?.[platform];
  const sourcePlatform = source?.platform?.trim().toLowerCase();

  if (sourcePlatform === platform && (source?.projectId || source?.fileId)) {
    return {
      projectId: source.projectId || matched?.projectId,
      fileId: source.fileId || matched?.fileId
    };
  }

  return matched;
};

export const getModIdentityKey = (mod: ModMeta): string => {
  const source = mod.manifestEntry?.source;
  const references = [
    source,
    { platform: 'modrinth', ...mod.manifestEntry?.matchedPlatforms?.modrinth },
    { platform: 'curseforge', ...mod.manifestEntry?.matchedPlatforms?.curseforge }
  ];

  for (const reference of references) {
    if (reference?.platform && reference.projectId) {
      return `project:${reference.platform}:${reference.projectId}`;
    }
  }

  if (mod.modId) {
    return `mod:${mod.modId}`;
  }

  if (mod.cacheKey && !mod.cacheKey.startsWith('file_')) {
    return `cache:${mod.cacheKey}`;
  }

  return `file:${mod.fileName.replace(/\.disabled$/i, '').toLowerCase()}`;
};

export const isCompleteModPlatformReference = (
  mod: ModMeta,
  platform: ModPlatformId
) => {
  const reference = getModPlatformReference(mod, platform);
  return !!reference?.projectId && !!reference.fileId;
};

export const getModPreferredPlatform = (
  mod: ModMeta,
  purpose: ModMetadataPurpose,
  requireCompleteReference = false
): ModPlatformId | undefined => {
  const settings = mod.manifestEntry?.metadataSettings;
  const preference = purpose === 'metadata'
    ? settings?.metadataPlatform
    : settings?.updatePlatform;
  const locked = purpose === 'metadata'
    ? !!settings?.metadataLocked
    : !!settings?.updateLocked;

  const hasReference = (platform: ModPlatformId) => (
    requireCompleteReference ? isCompleteModPlatformReference(mod, platform) : true
  );

  if ((preference === 'modrinth' || preference === 'curseforge')) {
    if (hasReference(preference)) return preference;
    if (locked) return undefined;
  }

  const sourcePlatform = mod.manifestEntry?.source?.platform;
  if (
    (sourcePlatform === 'modrinth' || sourcePlatform === 'curseforge')
    && hasReference(sourcePlatform)
  ) {
    return sourcePlatform;
  }

  if (hasReference('modrinth') && getModPlatformReference(mod, 'modrinth')?.projectId) {
    return 'modrinth';
  }

  if (hasReference('curseforge') && getModPlatformReference(mod, 'curseforge')?.projectId) {
    return 'curseforge';
  }

  return undefined;
};

export const getModPreferredPlatformReference = (
  mod: ModMeta,
  purpose: ModMetadataPurpose
): { platform: ModPlatformId; reference: ModPlatformMatch } | null => {
  const platform = getModPreferredPlatform(mod, purpose, true);
  if (!platform) return null;

  const reference = getModPlatformReference(mod, platform);
  if (!reference?.projectId || !reference.fileId) return null;

  return { platform, reference };
};

export const buildAutomaticUpdateMetadataSettings = (
  previous?: ModMetadataSettings
): ModMetadataSettings => ({
  ...(previous || {}),
  updatePlatform: 'auto',
  updateLocked: false
});

export const getInstalledProjectIds = (mods: ModMeta[]): string[] => {
  const ids = new Set<string>();

  for (const mod of mods) {
    const directId = normalizeInstalledKey(mod.modId);
    const manifestProjectId = normalizeInstalledKey(mod.manifestEntry?.source?.projectId);
    const modrinthProjectId = normalizeInstalledKey(getModPlatformReference(mod, 'modrinth')?.projectId);
    const curseforgeProjectId = normalizeInstalledKey(getModPlatformReference(mod, 'curseforge')?.projectId);

    if (directId) ids.add(directId);
    if (manifestProjectId) ids.add(manifestProjectId);
    if (modrinthProjectId) ids.add(modrinthProjectId);
    if (curseforgeProjectId) ids.add(curseforgeProjectId);
  }

  return [...ids];
};

export const getInstalledVersionIds = (mods: ModMeta[]): string[] => {
  const ids = new Set<string>();

  for (const mod of mods) {
    const manifestFileId = normalizeInstalledKey(mod.manifestEntry?.source?.fileId);
    const modrinthFileId = normalizeInstalledKey(getModPlatformReference(mod, 'modrinth')?.fileId);
    const curseforgeFileId = normalizeInstalledKey(getModPlatformReference(mod, 'curseforge')?.fileId);
    const fileName = normalizeInstalledKey(mod.fileName);
    const baseFileName = normalizeInstalledKey(mod.fileName?.replace(/\.disabled$/i, ''));

    if (manifestFileId) ids.add(manifestFileId);
    if (modrinthFileId) ids.add(modrinthFileId);
    if (curseforgeFileId) ids.add(curseforgeFileId);
    if (fileName) ids.add(fileName);
    if (baseFileName) ids.add(baseFileName);
  }

  return [...ids];
};

export class InstalledModIndex {
  public projectIds: Set<string> = new Set();
  public fileNames: string[] = [];
  private enabledProjectIdsByPlatform = new Map<string, Set<string>>();
  private disabledProjectIdsByPlatform = new Map<string, Set<string>>();
  private enabledAliases = new Set<string>();
  private disabledAliases = new Set<string>();

  constructor(mods: ModMeta[]) {
    for (const mod of mods) {
      const aliasTarget = mod.isEnabled ? this.enabledAliases : this.disabledAliases;
      const projectTarget = mod.isEnabled
        ? this.enabledProjectIdsByPlatform
        : this.disabledProjectIdsByPlatform;
      const registerAlias = (value?: string | null) => {
        getModIdentityVariants(value).forEach((identity) => aliasTarget.add(identity));
      };
      const registerProject = (platform: string, projectId?: string | null) => {
        const normalizedProjectId = normalizeInstalledKey(projectId).toLowerCase();
        if (!normalizedProjectId) return;
        const platformKey = platform.trim().toLowerCase();
        if (!projectTarget.has(platformKey)) projectTarget.set(platformKey, new Set());
        projectTarget.get(platformKey)!.add(normalizedProjectId);
        this.projectIds.add(normalizedProjectId);
      };

      registerAlias(mod.modId);
      registerAlias(mod.name);
      registerAlias(mod.fileName);
      registerAlias(mod.cacheKey?.replace(/^(?:local|file|modrinth|curseforge)_/i, ''));
      mod.aliases?.forEach(registerAlias);
      mod.manifestEntry?.aliases?.forEach(registerAlias);

      const source = mod.manifestEntry?.source;
      if (source?.platform) registerProject(source.platform, source.projectId);
      registerProject('modrinth', getModPlatformReference(mod, 'modrinth')?.projectId);
      registerProject('curseforge', getModPlatformReference(mod, 'curseforge')?.projectId);

      if (mod.modId) this.projectIds.add(normalizeInstalledKey(mod.modId).toLowerCase());
      this.fileNames.push(normalizeInstalledKey(mod.fileName).toLowerCase());
    }
  }

  public matchDependency(
    dependency: ModDependencyIdentity,
    platform: ModPlatformId
  ): InstalledDependencyMatch {
    const projectId = normalizeInstalledKey(dependency.projectId).toLowerCase();
    const platformKey = platform.toLowerCase();

    if (projectId && this.enabledProjectIdsByPlatform.get(platformKey)?.has(projectId)) {
      return { status: 'installed', matchedBy: 'projectId' };
    }
    if (projectId && this.disabledProjectIdsByPlatform.get(platformKey)?.has(projectId)) {
      return { status: 'disabled', matchedBy: 'projectId' };
    }

    const aliases = new Set<string>();
    [dependency.slug, dependency.name, dependency.projectId].forEach((value) => {
      getModIdentityVariants(value).forEach((identity) => aliases.add(identity));
    });

    for (const alias of aliases) {
      if (this.enabledAliases.has(alias)) {
        return { status: 'installed', matchedBy: 'alias' };
      }
    }
    for (const alias of aliases) {
      if (this.disabledAliases.has(alias)) {
        return { status: 'disabled', matchedBy: 'alias' };
      }
    }

    return { status: 'missing' };
  }

  public isInstalled(project: ModrinthProject): boolean {
    const pId1 = normalizeInstalledKey(project.id).toLowerCase();
    const pId2 = normalizeInstalledKey(project.project_id).toLowerCase();
    
    if (pId1 && this.projectIds.has(pId1)) return true;
    if (pId2 && this.projectIds.has(pId2)) return true;

    const slug = normalizeInstalledKey(project.slug).toLowerCase();
    if (slug && this.projectIds.has(slug)) return true;

    const projectAliases = new Set<string>();
    if (project.slug) {
      getModIdentityVariants(project.slug).forEach((identity) => projectAliases.add(identity));
    }

    // Only fallback to title if slug didn't produce any alias and title is distinctive
    if (projectAliases.size === 0 && project.title) {
      getModIdentityVariants(project.title).forEach((identity) => projectAliases.add(identity));
    }

    return [...projectAliases].some((alias) => (
      this.enabledAliases.has(alias) || this.disabledAliases.has(alias)
    ));
  }
}

const modManifestCache = new Map<string, ModMeta[]>();

const cloneModList = (mods: ModMeta[]) => mods.map((mod) => ({ ...mod }));

export const isProjectInstalled = (
  project: ModrinthProject, 
  installedMods: ModMeta[] | InstalledModIndex
): boolean => {
  if (installedMods instanceof InstalledModIndex) {
    return installedMods.isInstalled(project);
  }
  return new InstalledModIndex(installedMods).isInstalled(project);
};

export interface ModEntry {
  hash: string;
  hashAlgorithm?: string;
  fileName: string;
  modId?: string | null;
  version?: string | null;
  isEnabled?: boolean | null;
}

export interface InstanceSnapshot {
  schemaVersion?: number;
  id: string;
  timestamp: number;
  trigger: string;
  message: string;
  mods: ModEntry[];
}

export interface SnapshotDiff {
  added: ModEntry[];
  removed: ModEntry[];
  updated: { old: ModEntry; new: ModEntry }[];
  stateChanged: { old: ModEntry; new: ModEntry }[];
}

export interface SnapshotRollbackResult {
  restoredSnapshotId: string;
  preRollbackSnapshotId: string;
}

export interface SnapshotProgressEvent {
  instanceId?: string;
  current: number;
  total: number;
  phase: string;
  file: string;
  operationId?: string;
}

export const modService = {
  getInstanceDetail: (id: string) => 
    invoke<any>('get_instance_detail', { id }),
    
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
      updates: updates.map((u) => ({
        file_name: u.fileName,
        source_platform: u.sourcePlatform ?? null,
        source_project_id: u.sourceProjectId ?? null,
        source_file_id: u.sourceFileId ?? null,
        version: u.version ?? null,
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
    return invoke<{ total: number; renamed: any[]; failed: any[]; manifestSyncError: string | null }>('execute_mod_file_cleanup', { id, items })
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

export interface ModUpdateInfo {
  fileName: string;
  hasUpdate: boolean;
  updateVersionName?: string;
  updatePlatform?: ModPlatformId;
  updateProjectId?: string;
  updateFileId?: string;
  updateFileName?: string;
  updateDownloadUrl?: string;
}

export interface MissingDependencyInfo {
  targetIdentifier: string;
  targetNameHint?: string;
  versionRequirement?: string;
  relationType: string;
}

export interface DependencySummaryInfo {
  targetIdentifier: string;
  targetType: string;
  sourceProvider: string;
  targetNameHint?: string;
  relationType: string;
  isInstalledInInstance: boolean;
}

export interface ConflictPairInfo {
  modAFileName: string;
  modBFileName: string;
  reason?: string;
}

export interface InstanceDependencyHealth {
  missingDependencies: Record<string, MissingDependencyInfo[]>;
  instanceDependents: Record<string, string[]>;
  declaredDependencies: Record<string, DependencySummaryInfo[]>;
  conflicts: ConflictPairInfo[];
}

export interface ModRelationRecord {
  sourceIdentifier: string;
  sourceType: string;
  targetIdentifier: string;
  targetType: string;
  relationType: string;
  versionRequirement?: string;
  targetNameHint?: string;
  sourceProvider: string;
}
