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

  // 预留：打开存档所在目录
  openSavesFolder: (id: string) => 
    invoke('open_mod_folder', { id }), // 你可以复用之前写的打开目录指令，或者后端新建一个 open_saves_folder

  getBackups: (id: string) => 
    invoke<SaveBackupMetadata[]>('get_save_backups', { id }),
};