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

export class InstalledModIndex {
  public projectIds: Set<string> = new Set();
  public fileNames: string[] = [];

  constructor(mods: ModMeta[]) {
    for (const mod of mods) {
      if (mod.modId) this.projectIds.add(normalizeInstalledKey(mod.modId));
      if (mod.manifestEntry?.source.projectId) {
        this.projectIds.add(normalizeInstalledKey(mod.manifestEntry.source.projectId));
      }
      this.fileNames.push(normalizeInstalledKey(mod.fileName).toLowerCase());
    }
  }

  public isInstalled(project: ModrinthProject): boolean {
    const pId1 = normalizeInstalledKey(project.id);
    const pId2 = normalizeInstalledKey(project.project_id);
    
    if (pId1 && this.projectIds.has(pId1)) return true;
    if (pId2 && this.projectIds.has(pId2)) return true;

    const projectSlug = normalizeInstalledKey(project.slug).toLowerCase();
    if (!projectSlug) return false;
    
    for (const fileName of this.fileNames) {
      if (fileName.includes(projectSlug)) return true;
    }
    
    return false;
  }
}

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
  fileName: string;
  modId?: string | null;
  version?: string | null;
  isEnabled?: boolean | null;
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
  stateChanged: { old: ModEntry; new: ModEntry }[];
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
    invoke('open_mod_folder', { id }),

  executeModFileCleanup: (id: string, items: { originalFileName: string; suggestedFileName: string }[]) => 
    invoke<{ total: number; renamed: any[]; failed: any[]; manifestSyncError: string | null }>('execute_mod_file_cleanup', { id, items })
};
