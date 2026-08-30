import { useCallback } from 'react';
import { modService, type ModMeta } from '../../logic/modService';

interface SyncCloudMetadataOptions {
  force?: boolean;
  onProgress?: (current: number, total: number) => void;
  onIncrementalUpdate?: (updatedModsMap: Map<string, Partial<ModMeta>>) => void;
  globalMetadataPlatform?: string;
}

export const useModCloudSync = (instanceId: string) => {
  const syncCloudMetadata = useCallback(async (
    modsToSync: ModMeta[],
    options: SyncCloudMetadataOptions = {}
  ): Promise<ModMeta[]> => {
    if (modsToSync.length === 0) {
      return modsToSync;
    }

    const {
      force = false,
      globalMetadataPlatform
    } = options;

    const cfApiKey = (import.meta as any).env?.VITE_CURSEFORGE_API_KEY?.trim() || '';

    try {
      const syncedMods = await modService.syncInstanceModsCloudMetadata(
        instanceId,
        force,
        globalMetadataPlatform,
        cfApiKey
      );
      if (syncedMods && syncedMods.length > 0) {
        return syncedMods;
      }
    } catch (e) {
      console.warn('[useModCloudSync] Rust backend cloud sync error:', e);
    }

    return modsToSync;
  }, [instanceId]);

  return { syncCloudMetadata };
};
