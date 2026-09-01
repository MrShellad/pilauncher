import { useCallback } from 'react';
import { modService, type ModMeta } from '../../logic/modService';

interface SyncCloudMetadataOptions {
  force?: boolean;
  onProgress?: (current: number, total: number) => void;
  onIncrementalUpdate?: (updatedModsMap: Map<string, Partial<ModMeta>>) => void;
  globalMetadataPlatform?: string;
  throwOnError?: boolean;
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
      globalMetadataPlatform,
      throwOnError = false
    } = options;

    const cfApiKey = (import.meta as any).env?.VITE_CURSEFORGE_API_KEY?.trim() || '';

    try {
      const syncedMods = await modService.syncInstanceModsCloudMetadata(
        instanceId,
        force,
        globalMetadataPlatform,
        cfApiKey,
        modsToSync.map((mod) => mod.fileName)
      );
      if (syncedMods && syncedMods.length > 0) {
        // The backend syncs the complete instance and returns its full, filename-sorted
        // list. Keep this helper's contract scoped to the mods requested by its caller;
        // otherwise a single-mod refresh would receive the first mod in the instance.
        const syncedByFileName = new Map(
          syncedMods.map((syncedMod) => [syncedMod.fileName, syncedMod])
        );
        return modsToSync.map(
          (requestedMod) => syncedByFileName.get(requestedMod.fileName) ?? requestedMod
        );
      }
    } catch (e) {
      console.warn('[useModCloudSync] Rust backend cloud sync error:', e);
      if (throwOnError) {
        throw e;
      }
    }

    return modsToSync;
  }, [instanceId]);

  return { syncCloudMetadata };
};
