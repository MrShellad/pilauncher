import { invoke } from '@tauri-apps/api/core';

export interface SaveBackupWorld {
  name: string;
  uuid: string;
  folderName: string;
}

export interface SaveBackupGame {
  mcVersion: string;
  loader: string;
  loaderVersion: string;
}

export interface SaveBackupModEntry {
  fileName: string;
  hash: string;
}

export interface SaveBackupEnvironment {
  modsHash: string;
  configHash: string;
  modCount: number;
  mods: SaveBackupModEntry[];
}

export interface SaveBackupFiles {
  worldSize: number;
  configSize: number;
  totalSize: number;
}

export interface SaveBackupState {
  safeBackup: boolean;
}

export interface SaveBackupUser {
  note: string;
  tags: string[];
}

export interface SaveBackupMetadata {
  backupId: string;
  instanceId: string;
  backupMode: 'full' | 'differential';
  baseBackupId?: string;
  world: SaveBackupWorld;
  createdAt: number;
  trigger: string;
  game: SaveBackupGame;
  environment: SaveBackupEnvironment;
  files: SaveBackupFiles;
  state: SaveBackupState;
  user: SaveBackupUser;
  hasConfigs: boolean;
}

export interface SaveRestoreCheckResult {
  backupId: string;
  targetFolderName: string;
  warnings: string[];
  safeBackup: boolean;
  canRestoreConfigs: boolean;
  autoBackupCurrent: boolean;
  gameMatches: boolean;
  loaderMatches: boolean;
  modsMatch: boolean;
  configsMatch: boolean;
}

export interface SaveRestoreResult {
  backupId: string;
  restoredFolderName: string;
  restoredConfigs: boolean;
  guardBackupId?: string | null;
}

export interface SaveBackupProgress {
  instanceId: string;
  folderName: string;
  current: number;
  total: number;
  message: string;
  stage: string;
}

export interface SaveItem {
  folderName: string;
  worldName: string;
  worldUuid: string;
  sizeBytes: number;
  lastPlayedTime: number;
  createdTime: number;
  iconPath?: string;
}

export const saveService = {
  getSaves: (id: string) => invoke<SaveItem[]>('get_saves', { id }),

  backupSave: (id: string, folderName: string, mode: 'full' | 'differential' = 'full') =>
    invoke<SaveBackupMetadata>('backup_save', { id, folderName, mode }),

  deleteSave: (id: string, folderName: string, directDelete: boolean) =>
    invoke('delete_save', { id, folderName, directDelete }),

  deleteBackup: (id: string, backupId: string) =>
    invoke('delete_save_backup', { id, backupId }),

  verifyRestore: (id: string, backupId: string) =>
    invoke<SaveRestoreCheckResult>('verify_save_restore', { id, backupId }),

  restoreBackup: (
    id: string,
    backupId: string,
    restoreConfigs: boolean,
    autoBackupCurrent = true
  ) =>
    invoke<SaveRestoreResult>('restore_save_backup', {
      id,
      backupId,
      restoreConfigs,
      autoBackupCurrent,
    }),

  openSavesFolder: (id: string) => invoke('open_saves_folder', { id }),

  getBackups: (id: string) => invoke<SaveBackupMetadata[]>('get_save_backups', { id }),
};
