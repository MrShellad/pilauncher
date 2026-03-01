// /src/features/InstanceDetail/logic/resourceService.ts
import { invoke } from '@tauri-apps/api/core';

// 严格对应 Rust 后端的 ResourceType
export type ResourceType = 'mod' | 'save' | 'shader' | 'resourcePack';

export interface ResourceItem {
  fileName: string;
  isEnabled: boolean;
  isDirectory: boolean;
  fileSize: number;
  modifiedAt: number;
}

export const resourceService = {
  list: (id: string, resType: ResourceType) => 
    invoke<ResourceItem[]>('list_resources', { id, resType }),
    
  toggle: (id: string, resType: ResourceType, fileName: string, enable: boolean) => 
    invoke('toggle_resource', { id, resType, fileName, enable }),
    
  delete: (id: string, resType: ResourceType, fileName: string) => 
    invoke('delete_resource', { id, resType, fileName }),
    
  openFolder: (id: string, resType: ResourceType) => 
    invoke('open_resource_folder', { id, resType })
};