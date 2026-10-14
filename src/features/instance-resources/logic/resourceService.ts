import { invoke } from '@tauri-apps/api/core';

// 严格对应 Rust 后端的 ResourceType
export type ResourceType = 'mod' | 'save' | 'shader' | 'resourcePack';

export interface ResourceSourceMetadata {
  resourceType: ResourceType;
  fileName: string;
  sourceKind: string;
  platform: 'modrinth' | 'curseforge';
  projectId: string;
  fileId: string;
  version?: string | null;
  updatedAt: number;
}

export interface ResourceUpdateInfo {
  fileId: string;
  fileName: string;
  version: string;
  downloadUrl: string;
}

export interface ResourceFileIdentifiers {
  fileName: string;
  sha1?: string | null;
  curseforgeFingerprint?: number | null;
}

export interface ResourceItem {
  fileName: string;
  isEnabled: boolean;
  isDirectory: boolean;
  fileSize: number;
  modifiedAt: number;
  /** 提取的图标绝对路径（由 extract_resourcepack_icon 命令异步填充） */
  iconAbsolutePath?: string;
  /** 由资源平台项目元数据解析出的远程图标。 */
  networkIconUrl?: string | null;
  meta?: ResourceSourceMetadata | null;
  update?: ResourceUpdateInfo;
}

export const resourceService = {
  list: (id: string, resType: ResourceType) => 
    invoke<ResourceItem[]>('list_resources', { id, resType }),

  calculateFileIdentifiers: (
    id: string,
    resType: ResourceType,
    fileNames: string[],
    options: { includeSha1: boolean; includeCurseforge: boolean },
  ) => invoke<ResourceFileIdentifiers[]>('calculate_resource_file_identifiers', {
    id,
    resType,
    fileNames,
    includeSha1: options.includeSha1,
    includeCurseforge: options.includeCurseforge,
  }),

  updateManifest: (params: {
    instanceId: string;
    resType: ResourceType;
    fileName: string;
    sourceKind: string;
    platform: 'modrinth' | 'curseforge';
    projectId: string;
    fileId: string;
    version?: string;
  }) => invoke<void>('update_resource_manifest', params),
    
  toggle: (id: string, resType: ResourceType, fileName: string, enable: boolean) => 
    invoke('toggle_resource', { id, resType, fileName, enable }),
    
  delete: (id: string, resType: ResourceType, fileName: string) => 
    invoke('delete_resource', { id, resType, fileName }),
    
  openFolder: (id: string, resType: ResourceType) => 
    invoke('open_resource_folder', { id, resType }),

  /** 提取离线资源图标（支持资源包、光影包等），存入分桶并返回路径 */
  ensureOfflineResourceIcon: (instanceId: string, resType: ResourceType, fileName: string) =>
    invoke<string | null>('ensure_offline_resource_icon', { instanceId, resType, fileName }),

  /** 提取资源包图标（兼容旧接口） */
  extractResourcepackIcon: (instanceId: string, fileName: string) =>
    invoke<string | null>('ensure_offline_resource_icon', { instanceId, resType: 'resourcePack', fileName }),
};
