// /src/features/InstanceDetail/logic/modService.ts
import { invoke } from '@tauri-apps/api/core';
import type { ModrinthProject } from './modrinthApi';

export interface ModManifestEntry {
  platform: string;
  projectId: string; // Will come from Rust as project_id
  fileId: string;    // Will come from Rust as file_id
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

export const modService = {
  getInstanceDetail: (id: string) => 
    invoke<any>('get_instance_detail', { id }),
    
  getMods: (id: string) => 
    invoke<ModMeta[]>('get_instance_mods', { id }),
    
  toggleMod: (id: string, fileName: string, enable: boolean) => 
    invoke('toggle_resource', { id, resType: 'mod', fileName, enable }),
    
  deleteMod: (id: string, fileName: string) => 
    invoke('delete_resource', { id, resType: 'mod', fileName }),
    
  createSnapshot: (id: string, desc: string) => 
    invoke('create_resource_snapshot', { id, resType: 'mod', desc }),
    
  updateModCache: (cacheKey: string, name: string, desc: string, iconUrl: string) => 
    invoke('update_mod_cache', { cacheKey, name, desc, iconUrl }),

  openModFolder: (id: string) =>  
    invoke('open_mod_folder', { id })
};