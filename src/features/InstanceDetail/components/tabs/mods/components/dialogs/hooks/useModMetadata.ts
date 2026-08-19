// src/features/InstanceDetail/components/tabs/mods/components/dialogs/hooks/useModMetadata.ts
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getModPreferredPlatform,
  type ModMeta,
  type ModPlatformId
} from '../../../../../../logic/modService';
import { useModCloudSync } from '../../../../../../hooks/modManager/useModCloudSync';

export const useModMetadata = (
  mod: ModMeta | null,
  onMetadataResolved?: (mod: ModMeta) => void,
  instanceConfig?: any,
  instanceId?: string
) => {
  const [displayMod, setDisplayMod] = useState<ModMeta | null>(null);
  const lastOpenedFileNameRef = useRef<string | null>(null);
  const fetchedMetadataKeysRef = useRef<Set<string>>(new Set());
  const modRef = useRef<ModMeta | null>(mod);
  const { syncCloudMetadata } = useModCloudSync(instanceId || '');

  const initialMetadataPlatform = useMemo<ModPlatformId>(() => {
    if (!mod) return 'modrinth';
    const sourcePlatform = getModPreferredPlatform(mod, 'metadata') 
      || mod.manifestEntry?.source.platform
      || instanceConfig?.globalMetadataSettings?.metadataPlatform;
    return sourcePlatform === 'curseforge' ? 'curseforge' : 'modrinth';
  }, [mod, instanceConfig]);

  const metadataRequestKey = useMemo(() => {
    if (!mod) return '';
    return `${mod.fileName}|${initialMetadataPlatform}|${mod.manifestEntry?.source?.projectId || ''}|${mod.curseforgeFingerprint || ''}|${mod.manifestEntry?.hash?.value || ''}`;
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

  // Fetch metadata details using unified cloud sync pipeline if missing
  useEffect(() => {
    const requestMod = modRef.current;
    if (!requestMod || !metadataRequestKey || !instanceId) {
      return;
    }

    // 1. If already has networkInfo for the active platform, do not refetch
    if (requestMod.networkInfo && requestMod.networkInfo.source === initialMetadataPlatform) {
      return;
    }

    // 2. If already has full local metadata (description and icon), prioritize local and avoid network call
    if (requestMod.description && (requestMod.iconAbsolutePath || requestMod.offlineJarIconAbsolutePath)) {
      return;
    }

    if (fetchedMetadataKeysRef.current.has(metadataRequestKey)) {
      return;
    }
    fetchedMetadataKeysRef.current.add(metadataRequestKey);

    let disposed = false;

    syncCloudMetadata([requestMod], {
      force: false,
      globalMetadataPlatform: instanceConfig?.globalMetadataSettings?.metadataPlatform
    }).then((syncedMods: ModMeta[]) => {
      if (disposed || !syncedMods || syncedMods.length === 0) return;
      const synced = syncedMods[0];
      setDisplayMod(synced);
      onMetadataResolved?.(synced);
    }).catch((err: unknown) => {
      if (!disposed) {
        fetchedMetadataKeysRef.current.delete(metadataRequestKey);
      }
      console.error('Unified metadata resolution in detail modal failed:', err);
    });

    return () => {
      disposed = true;
    };
  }, [initialMetadataPlatform, metadataRequestKey, onMetadataResolved, syncCloudMetadata, instanceConfig, instanceId]);

  return {
    displayMod,
    setDisplayMod,
    initialMetadataPlatform
  };
};
