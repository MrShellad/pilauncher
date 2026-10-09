export interface WebDavFavoriteSyncResult {
  remoteRoot: string;
  remoteCreated: boolean;
  uploadedOperations: number;
  downloadedOperations: number;
  mergedFavorites: number;
  totalOperations: number;
  snapshotUpdated: boolean;
  compactedOperations: number;
}

export interface WebDavSkinSyncResult {
  remoteRoot: string;
  remoteCreated: boolean;
  uploadedFiles: number;
  downloadedFiles: number;
  localFiles: number;
  remoteFiles: number;
  archiveUpdated: boolean;
  restored: boolean;
}

export interface WebDavSaveBackupSyncResult {
  remoteRoot: string;
  remoteCreated: boolean;
  mode: 'sync' | 'backup';
  uploadedFiles: number;
  downloadedFiles: number;
  localFiles: number;
  remoteFiles: number;
  localBackups: number;
  remoteBackups: number;
  archiveUpdated: boolean;
  restored: boolean;
  verified: boolean;
}

export interface WebDavRemoteSaveBackup {
  backupId: string;
  remoteInstanceId: string;
  remoteWorldKey: string;
  remotePrefix: string;
  fileCount: number;
  totalSize: number;
  metadata: import('@/features/instances').SaveBackupMetadata;
}

export interface WebDavSaveBackupDownloadResult {
  backupId: string;
  targetInstanceId: string;
  downloadedBackups: number;
  downloadedFiles: number;
  restored: boolean;
  restoreResult?: import('@/features/instances').SaveRestoreResult | null;
}

export interface WebDavSaveBackupDeleteResult {
  backupId: string;
  deletedFiles: number;
  remainingBackups: number;
}

export interface WebDavSyncResult {
  favorites?: WebDavFavoriteSyncResult;
  skins?: WebDavSkinSyncResult;
  saveBackups?: WebDavSaveBackupSyncResult;
}
