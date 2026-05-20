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
