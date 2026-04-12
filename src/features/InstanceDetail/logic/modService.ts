// /src/features/InstanceDetail/logic/modService.ts
import { invoke } from '@tauri-apps/api/core';
import type { ModrinthProject } from './modrinthApi';

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
}

export interface ModMeta {
  fileName: string;
  modId?: string;
  name?: string;
  version?: string;
  description?: string;
  iconAbsolutePath?: string;
  networkIconUrl?: string; 
  fileSize: number;
  isEnabled: boolean; 
  modifiedAt: number;
  networkInfo?: ModrinthProject | null;
  isFetchingNetwork?: boolean;
  manifestEntry?: ModManifestEntry;
  // Update fields
  hasUpdate?: boolean;
  updateVersionName?: string;
  updateFileId?: string;
  updateDownloadUrl?: string;
  isCheckingUpdate?: boolean;
  cacheKey?: string;
}

const normalizeInstalledKey = (value?: string | null) => String(value || '').trim();

export const getInstalledProjectIds = (mods: ModMeta[]): string[] => {
  const ids = new Set<string>();

  for (const mod of mods) {
    const directId = normalizeInstalledKey(mod.modId);
    const manifestProjectId = normalizeInstalledKey(mod.manifestEntry?.source.projectId);

    if (directId) ids.add(directId);
    if (manifestProjectId) ids.add(manifestProjectId);
  }

  return [...ids];
};

export const getInstalledVersionIds = (mods: ModMeta[]): string[] => {
  const ids = new Set<string>();

  for (const mod of mods) {
    const manifestFileId = normalizeInstalledKey(mod.manifestEntry?.source.fileId);
    const fileName = normalizeInstalledKey(mod.fileName);
    const baseFileName = normalizeInstalledKey(mod.fileName?.replace(/\.disabled$/i, ''));
    const version = normalizeInstalledKey(mod.version);

    if (manifestFileId) ids.add(manifestFileId);
    if (fileName) ids.add(fileName);
    if (baseFileName) ids.add(baseFileName);
    if (version) ids.add(version);
  }

  return [...ids];
};

export const isProjectInstalled = (project: ModrinthProject, installedMods: ModMeta[]): boolean => {
  const projectIds = new Set(
    [normalizeInstalledKey(project.id), normalizeInstalledKey(project.project_id)].filter(Boolean)
  );
  const projectSlug = normalizeInstalledKey(project.slug).toLowerCase();

  return installedMods.some((mod) => {
    const installedIds = [
      normalizeInstalledKey(mod.modId),
      normalizeInstalledKey(mod.manifestEntry?.source.projectId),
    ].filter(Boolean);

    if (installedIds.some((id) => projectIds.has(id))) {
      return true;
    }

    const fileName = normalizeInstalledKey(mod.fileName).toLowerCase();
    return !!projectSlug && fileName.includes(projectSlug);
  });
};

export interface ModEntry {
  hash: string;
  fileName: string;
  modId?: string | null;
  version?: string | null;
}

export interface InstanceSnapshot {
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
}

export interface SnapshotProgressEvent {
  current: number;
  total: number;
  phase: string;
  file: string;
}

export interface ModEntry {
  hash: string;
  fileName: string;
  modId?: string | null;
  version?: string | null;
}

export interface InstanceSnapshot {
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
}

export interface SnapshotProgressEvent {
  current: number;
  total: number;
  phase: string;
  file: string;
}

export const modService = {
  getInstanceDetail: (id: string) => 
    invoke<any>('get_instance_detail', { id }),
    
  getMods: (id: string) => 
    invoke<ModMeta[]>('get_instance_mods', { id }),
    
  toggleMod: (id: string, fileName: string, enable: boolean) => 
    invoke('toggle_resource', { id, resType: 'mod', fileName, enable }),
    
  deleteMod: (id: string, fileName: string) => 
    invoke('delete_resource', { id, resType: 'mod', fileName }),
    
  takeSnapshot: (id: string, trigger: string, message: string) => 
    invoke<InstanceSnapshot>('take_snapshot', { instanceId: id, trigger, message }),

  getSnapshotHistory: (id: string) => 
    invoke<InstanceSnapshot[]>('get_snapshot_history', { instanceId: id }),

  calculateSnapshotDiff: (id: string, oldId: string, newId: string) => 
    invoke<SnapshotDiff>('calculate_snapshot_diff', { instanceId: id, oldId, newId }),

  rollbackInstance: (id: string, snapshotId: string) => 
    invoke<void>('rollback_instance', { instanceId: id, snapshotId }),
    
  updateModCache: (cacheKey: string, name: string, desc: string, iconUrl: string) => 
    invoke('update_mod_cache', { cacheKey, name, desc, iconUrl }),

  openModFolder: (id: string) =>  
    invoke('open_mod_folder', { id })
};
