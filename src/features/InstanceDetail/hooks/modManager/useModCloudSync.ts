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
}

const PLATFORM_PRIORITY: MatchPlatform[] = ['modrinth', 'curseforge'];

const hasCompletePlatformReference = (mod: ModMeta, platform: MatchPlatform) => {
  const reference = getModPlatformReference(mod, platform);
  return !!reference?.projectId && !!reference.fileId;
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

const choosePrimaryPlatform = (mod: ModMeta, matches: Partial<MatchedPlatforms>) => {
  const preferred = getModPreferredPlatform(mod, 'metadata');
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
  matches: Partial<MatchedPlatforms>
): ModMeta['manifestEntry'] => {
  const entry = mod.manifestEntry;
  if (!entry) return entry;

  const matchedPlatforms = {
    ...(entry.matchedPlatforms || {}),
    ...matches
  };

  const preferred = getModPreferredPlatform(mod, 'metadata');
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
    primaryPlatform = choosePrimaryPlatform(mod, matchedPlatforms);
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
  version?: string
) => {
  const entry = mod.manifestEntry;
  const preferred = getModPreferredPlatform(mod, 'metadata');
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
    primaryPlatform = choosePrimaryPlatform(mod, matchedPlatforms);
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
        const preferredPlatform = getModPreferredPlatform(mod, 'metadata');
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
            try {
              if (!modrinthDetailCache.has(version.project_id)) {
                modrinthDetailCache.set(version.project_id, fetchModrinthProjectById(version.project_id));
              }
              detail = await modrinthDetailCache.get(version.project_id);
              if (detail && mod.cacheKey) {
                const dbIcon = mod.manifestEntry?.icon_rel_path || detail.icon_url || '';
                await modService.updateModCache(
                  mod.cacheKey,
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
                  networkIconUrl: detail.icon_url || mod.networkIconUrl
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
              try {
                if (!curseForgeDetailCache.has(version.project_id)) {
                  curseForgeDetailCache.set(version.project_id, getCurseForgeProjectDetails(version.project_id));
                }
                detail = await curseForgeDetailCache.get(version.project_id);
                if (detail && mod.cacheKey) {
                  const dbIcon = mod.manifestEntry?.icon_rel_path || detail.icon_url || '';
                  await modService.updateModCache(
                    mod.cacheKey,
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
                    networkIconUrl: detail.icon_url || mod.networkIconUrl
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

    if (platformMatchesByFileName.size === 0) {
      return modsToSync;
    }

    await Promise.all(modsToSync.map(async (mod) => {
      const matches = platformMatchesByFileName.get(mod.fileName);
      if (!matches) return;

      try {
        const matchedVersion = versionByFileName.get(mod.fileName);
        await persistPlatformMatches(instanceId, mod, matches, matchedVersion);
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
        manifestEntry: matches ? buildMatchedManifestEntry(mod, matches) : mod.manifestEntry,
        isFetchingNetwork: false
      };
    });
  }, [instanceId]);

  return { syncCloudMetadata };
};
