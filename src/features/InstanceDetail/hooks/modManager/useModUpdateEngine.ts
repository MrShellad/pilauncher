import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { modService, type ModMeta } from '../../logic/modService';

interface UseModUpdateEngineOptions {
  setMods: Dispatch<SetStateAction<ModMeta[]>>;
}

export const useModUpdateEngine = ({ setMods }: UseModUpdateEngineOptions) => {
  const [isCheckingModUpdates, setIsCheckingModUpdates] = useState(false);
  const updateAbortControllerRef = useRef<AbortController | null>(null);

  const cancelUpdateCheck = useCallback(() => {
    updateAbortControllerRef.current?.abort();
    updateAbortControllerRef.current = null;
    setIsCheckingModUpdates(false);
  }, []);

  const runUpdateCheck = useCallback(async (
    scopeKey: string,
    _modsToCheck: ModMeta[],
    targetMc: string,
    targetLoader: string,
    force = false,
    onProgress?: (current: number, total: number) => void
  ) => {
    cancelUpdateCheck();

    const abortController = new AbortController();
    updateAbortControllerRef.current = abortController;
    setIsCheckingModUpdates(true);

    const cfApiKey = (import.meta as any).env?.VITE_CURSEFORGE_API_KEY?.trim() || '';

    try {
      onProgress?.(0, 1);
      const updates = await modService.checkInstanceModsUpdates(
        scopeKey,
        targetMc,
        targetLoader,
        force,
        cfApiKey
      );

      if (abortController.signal.aborted) {
        return;
      }

      if (updates && updates.length > 0) {
        const updateMap = new Map(updates.map((u) => [u.fileName, u]));

        setMods((current) => current.map((item) => {
          const info = updateMap.get(item.fileName)
            || updateMap.get(item.fileName.replace(/\.disabled$/i, ''))
            || updateMap.get(`${item.fileName}.disabled`);

          if (!info) {
            return item;
          }

          return {
            ...item,
            hasUpdate: info.hasUpdate,
            updateVersionName: info.updateVersionName,
            updatePlatform: info.updatePlatform,
            updateProjectId: info.updateProjectId,
            updateFileId: info.updateFileId,
            updateFileName: info.updateFileName,
            updateDownloadUrl: info.updateDownloadUrl,
            isCheckingUpdate: false
          };
        }));
      }
      onProgress?.(1, 1);
    } catch (error) {
      console.warn('[useModUpdateEngine] Rust update check error:', error);
    } finally {
      if (updateAbortControllerRef.current === abortController) {
        updateAbortControllerRef.current = null;
        setIsCheckingModUpdates(false);
      }
    }
  }, [cancelUpdateCheck, setMods]);

  return {
    isCheckingModUpdates,
    setIsCheckingModUpdates,
    cancelUpdateCheck,
    runUpdateCheck
  };
};
