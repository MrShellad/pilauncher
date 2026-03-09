// /src/features/InstanceDetail/logic/saveService.ts
import { invoke } from '@tauri-apps/api/core';

export interface ModSignature {
  fileName: string;
  signature: string;
}

export interface SaveBackupMetadata {
  uuid: string;
  worldName: string;
  instanceId: string;
  instanceName: string;
  mcVersion: string;
  loaderVersion: string;
  backupTime: number;
  originalCreatedTime: number;
  originalLastPlayedTime: number;
  sizeBytes: number;
  modsState: ModSignature[];
}

export interface SaveItem {
  folderName: string;
  worldName: string;
  sizeBytes: number;
  lastPlayedTime: number;
  createdTime: number;
  iconPath?: string;
}

export const saveService = {
  getSaves: (id: string) => 
    invoke<SaveItem[]>('get_saves', { id }),
    
  backupSave: (id: string, folderName: string) => 
    invoke<SaveBackupMetadata>('backup_save', { id, folderName }),
    
  deleteSave: (id: string, folderName: string, directDelete: boolean) => 
    invoke('delete_save', { id, folderName, directDelete }),
    
  verifyRestore: (id: string, backupUuid: string) => 
    invoke<string[]>('verify_save_restore', { id, backupUuid }),

  // 找到这段代码并替换为调用新指令
  openSavesFolder: (id: string) => 
    invoke('open_saves_folder', { id }),

  getBackups: (id: string) => 
    invoke<SaveBackupMetadata[]>('get_save_backups', { id }),
};