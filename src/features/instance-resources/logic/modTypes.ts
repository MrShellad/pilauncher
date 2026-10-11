import type { ModrinthProject } from '../../resource-catalog';

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

export interface InstanceVersionConfig {
  game_version?: string;
  gameVersion?: string;
  mcVersion?: string;
  loader?: string | { type?: string } | null;
  loaderType?: string;
  loader_type?: string;
  globalMetadataSettings?: ModMetadataSettings;
  [key: string]: unknown;
}

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

export interface ModFileCleanupResult {
  total: number;
  renamed: unknown[];
  failed: unknown[];
  manifestSyncError: string | null;
}

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
