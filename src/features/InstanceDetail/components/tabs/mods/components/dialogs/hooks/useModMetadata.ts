// src/features/InstanceDetail/components/tabs/mods/components/dialogs/hooks/useModMetadata.ts
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchModrinthInfo,
  fetchModrinthProjectById
} from '../../../../../../logic/modrinthApi';
import { getCurseForgeProjectDetails } from '../../../../../../../Download/logic/curseforgeApi';
import {
  getModPreferredPlatform,
  modService,
  type ModMeta,
  type ModPlatformId
} from '../../../../../../logic/modService';
import {
  getPlatformFileId,
  getPlatformProjectId,
  resolveProjectIdByHash,
  toNetworkInfo
} from '../utils/modDetailUtils';

export const useModMetadata = (
  mod: ModMeta | null,
  onMetadataResolved?: (mod: ModMeta) => void,
  instanceConfig?: any
) => {
  const [displayMod, setDisplayMod] = useState<ModMeta | null>(null);
  const lastOpenedFileNameRef = useRef<string | null>(null);
  const fetchedMetadataKeysRef = useRef<Set<string>>(new Set());
  const modRef = useRef<ModMeta | null>(mod);

  const initialMetadataPlatform = useMemo<ModPlatformId>(() => {
    if (!mod) return 'modrinth';
    const sourcePlatform = getModPreferredPlatform(mod, 'metadata') 
      || mod.manifestEntry?.source.platform
      || instanceConfig?.globalMetadataSettings?.metadataPlatform;
    return sourcePlatform === 'curseforge' ? 'curseforge' : 'modrinth';
  }, [mod, instanceConfig]);

  const metadataRequestKey = useMemo(() => {
    if (!mod) return '';

    return [
      mod.fileName,
      mod.cacheKey || '',
      initialMetadataPlatform,
      getPlatformProjectId(mod, initialMetadataPlatform) || '',
      getPlatformFileId(mod, initialMetadataPlatform) || '',
      mod.manifestEntry?.hash?.algorithm || '',
      mod.manifestEntry?.hash?.value || '',
      mod.curseforgeFingerprint ?? '',
      mod.modId || ''
    ].join('|');
  }, [initialMetadataPlatform, mod]);

  // Sync displayMod when mod changes
  useEffect(() => {
    if (!mod) {
      setDisplayMod(null);
      lastOpenedFileNameRef.current = null;
      return;
    }

    setDisplayMod((current) => {
      const nextMod = {
        ...mod,
        networkInfo: mod.networkInfo || current?.networkInfo,
        networkIconUrl: mod.networkIconUrl || current?.networkIconUrl
      };

      if (
        current?.fileName === nextMod.fileName &&
        current.name === nextMod.name &&
        current.description === nextMod.description &&
        current.version === nextMod.version &&
        current.fileSize === nextMod.fileSize &&
        current.isEnabled === nextMod.isEnabled &&
        current.iconAbsolutePath === nextMod.iconAbsolutePath &&
        current.offlineJarIconAbsolutePath === nextMod.offlineJarIconAbsolutePath &&
        current.isFetchingNetwork === nextMod.isFetchingNetwork &&
        current.hasUpdate === nextMod.hasUpdate &&
        current.updateVersionName === nextMod.updateVersionName &&
        current.updateFileId === nextMod.updateFileId &&
        current.updateFileName === nextMod.updateFileName &&
        current.updateDownloadUrl === nextMod.updateDownloadUrl &&
        current.isCheckingUpdate === nextMod.isCheckingUpdate &&
        current.isUpdatingMod === nextMod.isUpdatingMod &&
        current.cacheKey === nextMod.cacheKey &&
        current.networkInfo === nextMod.networkInfo &&
        current.networkIconUrl === nextMod.networkIconUrl
      ) {
        return current;
      }

      return nextMod;
    });

    if (lastOpenedFileNameRef.current !== mod.fileName) {
      lastOpenedFileNameRef.current = mod.fileName;
    }
  }, [mod]);

  useEffect(() => {
    modRef.current = mod;
  }, [mod]);

  // Fetch metadata details from APIs
  useEffect(() => {
    const requestMod = modRef.current;
    if (requestMod && metadataRequestKey) {
      let disposed = false;

      if (fetchedMetadataKeysRef.current.has(metadataRequestKey)) {
        return;
      }
      fetchedMetadataKeysRef.current.add(metadataRequestKey);

      const fetchMetadata = async () => {
        let projectId = getPlatformProjectId(requestMod, initialMetadataPlatform);
        if (!projectId) {
          projectId = await resolveProjectIdByHash(requestMod, initialMetadataPlatform);
        }

        if (projectId) {
          return initialMetadataPlatform === 'curseforge'
            ? getCurseForgeProjectDetails(projectId).then((detail) => toNetworkInfo(detail, 'curseforge'))
            : fetchModrinthProjectById(projectId);
        } else {
          const query =
            requestMod.modId ||
            requestMod.fileName.replace('.jar', '').replace('.disabled', '').replace(/[-_v0-9\.]+$/, '');
          return fetchModrinthInfo(query);
        }
      };

      fetchMetadata().then(async netInfo => {
        if (disposed) {
          return;
        }

        if (netInfo) {
          const cachedIconPath = requestMod.cacheKey && netInfo.icon_url
            ? await modService.updateModCache(
              requestMod.cacheKey,
              netInfo.title,
              netInfo.description,
              netInfo.icon_url
            ).catch(() => null)
            : null;

          const resolvedMod: ModMeta = {
            ...requestMod,
            networkInfo: netInfo,
            networkIconUrl: netInfo.icon_url || requestMod.networkIconUrl,
            iconAbsolutePath: cachedIconPath || requestMod.iconAbsolutePath,
            isFetchingNetwork: false
          };

          setDisplayMod(prev => prev ? {
            ...prev,
            networkInfo: netInfo,
            networkIconUrl: netInfo.icon_url || prev.networkIconUrl,
            iconAbsolutePath: cachedIconPath || prev.iconAbsolutePath,
            isFetchingNetwork: false
          } : null);
          onMetadataResolved?.(resolvedMod);

        }
      }).catch((error) => {
        if (!disposed) {
          fetchedMetadataKeysRef.current.delete(metadataRequestKey);
        }
        console.error(error);
      });

      return () => {
        disposed = true;
      };
    }
  }, [initialMetadataPlatform, metadataRequestKey, onMetadataResolved]);

  return {
    displayMod,
    setDisplayMod,
    initialMetadataPlatform
  };
};
