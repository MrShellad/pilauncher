import { useCallback } from 'react';

import {
  getCurseForgeProjectDetails,
  hasCurseForgeApiKey,
  matchCurseForgeFingerprints
} from '../../../Download/logic/curseforgeApi';
import {
  getModPreferredPlatform,
  getModPlatformReference,
  modService,
  type ModMeta,
  type ModPlatformMatch
} from '../../logic/modService';
import { fetchModrinthProjectById, type ModrinthProject, matchModrinthVersionsByHashes } from '../../logic/modrinthApi';

type MatchPlatform = 'modrinth' | 'curseforge';
type MatchedPlatforms = Record<MatchPlatform, ModPlatformMatch>;
interface SyncCloudMetadataOptions {
  force?: boolean;
  onProgress?: (current: number, total: number) => void;
  globalMetadataPlatform?: string;
}

const PLATFORM_PRIORITY: MatchPlatform[] = ['modrinth', 'curseforge'];

const hasCompletePlatformReference = (mod: ModMeta, platform: MatchPlatform) => {
  const reference = getModPlatformReference(mod, platform);
  return !!reference?.projectId && !!reference.fileId;
};

const getModPreferredPlatformWithGlobal = (
  mod: ModMeta,
  globalMetadataPlatform?: string
): MatchPlatform | undefined => {
  const preferred = getModPreferredPlatform(mod, 'metadata');
  if (preferred) return preferred;

  if (globalMetadataPlatform === 'curseforge' || globalMetadataPlatform === 'modrinth') {
    return globalMetadataPlatform;
  }

  return undefined;
};

const mergePlatformMatch = (
  current: Partial<MatchedPlatforms> | undefined,
  platform: MatchPlatform,
  match: ModPlatformMatch
) => ({
  ...(current || {}),
  [platform]: {
    ...(current?.[platform] || {}),
    ...match
  }
});

const choosePrimaryPlatform = (
  mod: ModMeta,
  matches: Partial<MatchedPlatforms>,
  globalMetadataPlatform?: string
) => {
  const preferred = getModPreferredPlatformWithGlobal(mod, globalMetadataPlatform);
  if (preferred === 'curseforge' || preferred === 'modrinth') {
    const list: MatchPlatform[] = preferred === 'curseforge'
      ? ['curseforge', 'modrinth']
      : ['modrinth', 'curseforge'];
    return list.find((platform) => matches[platform]?.projectId && matches[platform]?.fileId);
  }
  return PLATFORM_PRIORITY.find((platform) => matches[platform]?.projectId && matches[platform]?.fileId);
};

const buildMatchedManifestEntry = (
  mod: ModMeta,
  matches: Partial<MatchedPlatforms>,
  globalMetadataPlatform?: string
): ModMeta['manifestEntry'] => {
  const entry = mod.manifestEntry;
  if (!entry) return entry;

  const matchedPlatforms = {
    ...(entry.matchedPlatforms || {}),
    ...matches
  };

  const preferred = getModPreferredPlatformWithGlobal(mod, globalMetadataPlatform);
  const source = entry.source;
  const currentPlatform = source?.platform;

  let shouldUpdatePrimary = false;
  let primaryPlatform: MatchPlatform | undefined;

  if (preferred && preferred !== currentPlatform) {
    if (matchedPlatforms[preferred as MatchPlatform]?.projectId && matchedPlatforms[preferred as MatchPlatform]?.fileId) {
      primaryPlatform = preferred as MatchPlatform;
      shouldUpdatePrimary = true;
    }
  }

  if (!shouldUpdatePrimary && (!source?.platform || !source.projectId || !source.fileId)) {
    primaryPlatform = choosePrimaryPlatform(mod, matchedPlatforms, globalMetadataPlatform);
    shouldUpdatePrimary = true;
  }

  const primaryMatch = primaryPlatform ? matchedPlatforms[primaryPlatform] : undefined;

  return {
    ...entry,
    matchedPlatforms,
    source: shouldUpdatePrimary && primaryPlatform && primaryMatch
      ? {
          ...entry.source,
          platform: primaryPlatform,
          projectId: primaryMatch.projectId,
          fileId: primaryMatch.fileId
        }
      : entry.source
  };
};

const persistPlatformMatches = async (
  instanceId: string,
  mod: ModMeta,
  matches: Partial<MatchedPlatforms>,
  version?: string,
  globalMetadataPlatform?: string
) => {
  const entry = mod.manifestEntry;
  const preferred = getModPreferredPlatformWithGlobal(mod, globalMetadataPlatform);
  const source = entry?.source;
  const currentPlatform = source?.platform;

  const matchedPlatforms = {
    ...(entry?.matchedPlatforms || {}),
    ...matches
  };

  let shouldUpdatePrimary = false;
  let primaryPlatform: MatchPlatform | undefined;

  if (preferred && preferred !== currentPlatform) {
    if (matchedPlatforms[preferred as MatchPlatform]?.projectId && matchedPlatforms[preferred as MatchPlatform]?.fileId) {
      primaryPlatform = preferred as MatchPlatform;
      shouldUpdatePrimary = true;
    }
  }

  if (!shouldUpdatePrimary && (!source?.platform || !source.projectId || !source.fileId)) {
    primaryPlatform = choosePrimaryPlatform(mod, matchedPlatforms, globalMetadataPlatform);
    shouldUpdatePrimary = true;
  }

  const primaryMatch = primaryPlatform ? matchedPlatforms[primaryPlatform] : undefined;

  if (shouldUpdatePrimary && primaryPlatform && primaryMatch?.projectId && primaryMatch.fileId) {
    try {
      await modService.updateModManifest(
        instanceId,
        mod.fileName,
        mod.manifestEntry?.source.kind || 'externalImport',
        primaryPlatform,
        primaryMatch.projectId,
        primaryMatch.fileId,
        version
      );
    } catch (error) {
      console.error('Persist primary mod platform failed', error);
    }
  }

  await modService.updateModPlatformMatches(instanceId, mod.fileName, matches);
};

export const useModCloudSync = (instanceId: string) => {
  const syncCloudMetadata = useCallback(async (
    modsToSync: ModMeta[],
    options: SyncCloudMetadataOptions = {}
  ) => {
    const matchedByFileName = new Map<string, Partial<ModMeta>>();
    const platformMatchesByFileName = new Map<string, Partial<MatchedPlatforms>>();
    const versionByFileName = new Map<string, string>();
    const modrinthDetailCache = new Map<string, Promise<ModrinthProject>>();
    const curseForgeDetailCache = new Map<string, ReturnType<typeof getCurseForgeProjectDetails>>();
    const globalPlatform = options.globalMetadataPlatform;

    const recordMatch = (
      mod: ModMeta,
      platform: MatchPlatform,
      match: ModPlatformMatch,
      meta?: Partial<ModMeta>,
      versionNumber?: string
    ) => {
      const nextMatches = mergePlatformMatch(platformMatchesByFileName.get(mod.fileName), platform, match);
      platformMatchesByFileName.set(mod.fileName, nextMatches);

      if (versionNumber) {
        versionByFileName.set(mod.fileName, versionNumber);
      }

      if (meta) {
        const preferredPlatform = getModPreferredPlatformWithGlobal(mod, globalPlatform);
        const currentMeta = matchedByFileName.get(mod.fileName);
        const shouldUseMeta = !currentMeta || preferredPlatform === platform || (!preferredPlatform && platform === 'modrinth');
        if (shouldUseMeta) {
          matchedByFileName.set(mod.fileName, {
            ...(currentMeta || {}),
            ...meta
          });
        }
      } else if (!matchedByFileName.has(mod.fileName)) {
        matchedByFileName.set(mod.fileName, {});
      }
    };

    const sha1Mods = modsToSync.filter((mod) => (
      mod.manifestEntry?.hash.algorithm?.toLowerCase() === 'sha1'
      && !!mod.manifestEntry.hash.value
      && (options.force || !hasCompletePlatformReference(mod, 'modrinth'))
    ));

    const curseForgeMods = hasCurseForgeApiKey()
      ? modsToSync.filter((mod) => (
          typeof mod.curseforgeFingerprint === 'number'
          && (options.force || !hasCompletePlatformReference(mod, 'curseforge'))
        ))
      : [];

    const total = sha1Mods.length + curseForgeMods.length;
    let processed = 0;
    if (total > 0) {
      options.onProgress?.(0, total);
    }

    try {
      const modrinthMatches = await matchModrinthVersionsByHashes(
        sha1Mods.map((mod) => mod.manifestEntry!.hash.value),
        'sha1'
      );

      const batchSize = 5;
      for (let i = 0; i < sha1Mods.length; i += batchSize) {
        const batch = sha1Mods.slice(i, i + batchSize);
        await Promise.all(batch.map(async (mod) => {
          try {
            const version = modrinthMatches[mod.manifestEntry!.hash.value];
            if (!version?.project_id) return;

            let detail: ModrinthProject | undefined;
            let cachedIconPath: string | null = null;
            try {
              if (!modrinthDetailCache.has(version.project_id)) {
                modrinthDetailCache.set(version.project_id, fetchModrinthProjectById(version.project_id));
              }
              detail = await modrinthDetailCache.get(version.project_id);
              if (detail) {
                const dbIcon = detail.icon_url || mod.networkIconUrl || '';
                const cacheKey = `modrinth_${version.project_id}`;
                cachedIconPath = await modService.updateModCache(
                  cacheKey,
                  detail.title,
                  detail.description,
                  dbIcon
                );
              }
            } catch (error) {
              console.error('Modrinth cloud metadata sync failed', error);
            }

            recordMatch(mod, 'modrinth', {
              projectId: version.project_id,
              fileId: version.id
            }, detail
              ? {
                  name: detail.title || mod.name,
                  description: mod.description || detail.description,
                   networkIconUrl: detail.icon_url || mod.networkIconUrl,
                   iconAbsolutePath: cachedIconPath || mod.iconAbsolutePath
                }
              : undefined, version.version_number);
          } finally {
            processed += 1;
            options.onProgress?.(processed, total);
          }
        }));
      }
    } catch (error) {
      console.error('Modrinth hash match failed', error);
    }

    if (curseForgeMods.length > 0) {
      try {
        const curseForgeMatches = await matchCurseForgeFingerprints(
          curseForgeMods.map((mod) => mod.curseforgeFingerprint!)
        );

        const batchSize = 5;
        for (let i = 0; i < curseForgeMods.length; i += batchSize) {
          const batch = curseForgeMods.slice(i, i + batchSize);
          await Promise.all(batch.map(async (mod) => {
            try {
              const version = curseForgeMatches[mod.curseforgeFingerprint!];
              if (!version?.project_id) return;

              let detail: Awaited<ReturnType<typeof getCurseForgeProjectDetails>> | undefined;
              let cachedIconPath: string | null = null;
              try {
                if (!curseForgeDetailCache.has(version.project_id)) {
                  curseForgeDetailCache.set(version.project_id, getCurseForgeProjectDetails(version.project_id));
                }
                detail = await curseForgeDetailCache.get(version.project_id);
                if (detail) {
                  const dbIcon = detail.icon_url || mod.networkIconUrl || '';
                  const cacheKey = `curseforge_${version.project_id}`;
                  cachedIconPath = await modService.updateModCache(
                    cacheKey,
                    detail.title,
                    detail.description,
                    dbIcon
                  );
                }
              } catch (error) {
                console.error('CurseForge cloud metadata sync failed', error);
              }

              recordMatch(mod, 'curseforge', {
                projectId: version.project_id,
                fileId: version.id
              }, detail
                ? {
                    name: detail.title || mod.name,
                    description: mod.description || detail.description,
                   networkIconUrl: detail.icon_url || mod.networkIconUrl,
                   iconAbsolutePath: cachedIconPath || mod.iconAbsolutePath
                  }
                : undefined, version.version_number);
            } finally {
              processed += 1;
              options.onProgress?.(processed, total);
            }
          }));
        }
      } catch (error) {
        console.error('CurseForge fingerprint match failed', error);
      }
    }

    const knownIconMods = modsToSync.filter((mod) => {
      if (mod.iconAbsolutePath || matchedByFileName.get(mod.fileName)?.iconAbsolutePath) {
        return false;
      }

      const platform = getModPreferredPlatformWithGlobal(mod, globalPlatform);
      const projectId = platform
        ? getModPlatformReference(mod, platform)?.projectId
        : undefined;
      return !!platform && !!projectId && !platformMatchesByFileName.has(mod.fileName);
    });

    for (let i = 0; i < knownIconMods.length; i += 5) {
      const batch = knownIconMods.slice(i, i + 5);
      await Promise.all(batch.map(async (mod) => {
        const platform = getModPreferredPlatformWithGlobal(mod, globalPlatform);
        const projectId = platform
          ? getModPlatformReference(mod, platform)?.projectId
          : undefined;
        if (!platform || !projectId) return;

        try {
          let title = mod.name || '';
          let description = mod.description || '';
          let iconUrl = mod.networkIconUrl || '';

          if (platform === 'modrinth') {
            const detail = modrinthDetailCache.has(projectId)
              ? await modrinthDetailCache.get(projectId)
              : await fetchModrinthProjectById(projectId);
            title = detail?.title || title;
            description = detail?.description || description;
            iconUrl = detail?.icon_url || iconUrl;
          } else {
            const detail = curseForgeDetailCache.has(projectId)
              ? await curseForgeDetailCache.get(projectId)
              : await getCurseForgeProjectDetails(projectId);
            title = detail?.title || title;
            description = detail?.description || description;
            iconUrl = detail?.icon_url || iconUrl;
          }

          const cachedIconPath = iconUrl
            ? await modService.updateModCache(
              `${platform}_${projectId}`,
              title,
              description,
              iconUrl
            )
            : null;

          matchedByFileName.set(mod.fileName, {
            name: title || mod.name,
            description: description || mod.description,
            networkIconUrl: iconUrl || mod.networkIconUrl,
            iconAbsolutePath: cachedIconPath || mod.iconAbsolutePath
          });
        } catch (error) {
          console.error('Known mod icon hydration failed', error);
        }
      }));
    }

    if (platformMatchesByFileName.size === 0 && matchedByFileName.size === 0) {
      return modsToSync;
    }

    await Promise.all(modsToSync.map(async (mod) => {
      const matches = platformMatchesByFileName.get(mod.fileName);
      if (!matches) return;

      try {
        const matchedVersion = versionByFileName.get(mod.fileName);
        await persistPlatformMatches(instanceId, mod, matches, matchedVersion, globalPlatform);
      } catch (error) {
        console.error('Persist mod platform matches failed', error);
      }
    }));

    return modsToSync.map((mod) => {
      const matched = matchedByFileName.get(mod.fileName);
      const matches = platformMatchesByFileName.get(mod.fileName);
      const matchedVersion = versionByFileName.get(mod.fileName);

      if (!matched && !matches) {
        return mod;
      }

      return {
        ...mod,
        ...matched,
        version: mod.version || matchedVersion || matched?.version,
        manifestEntry: matches ? buildMatchedManifestEntry(mod, matches, globalPlatform) : mod.manifestEntry,
        isFetchingNetwork: false
      };
    });
  }, [instanceId]);

  return { syncCloudMetadata };
};
