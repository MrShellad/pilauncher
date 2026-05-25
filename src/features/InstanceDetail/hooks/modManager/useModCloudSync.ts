import { useCallback } from 'react';

import {
  getCurseForgeProjectDetails,
  hasCurseForgeApiKey,
  matchCurseForgeFingerprints
} from '../../../Download/logic/curseforgeApi';
import {
  getModPlatformReference,
  modService,
  type ModMeta,
  type ModPlatformMatch
} from '../../logic/modService';
import { getProjectDetails, type ModrinthProject, matchModrinthVersionsByHashes } from '../../logic/modrinthApi';

type MatchPlatform = 'modrinth' | 'curseforge';
type MatchedPlatforms = Record<MatchPlatform, ModPlatformMatch>;

const PLATFORM_PRIORITY: MatchPlatform[] = ['modrinth', 'curseforge'];

const hasCompletePlatformReference = (mod: ModMeta, platform: MatchPlatform) => {
  const reference = getModPlatformReference(mod, platform);
  return !!reference?.projectId && !!reference.fileId;
};

const hasCompletePrimarySource = (mod: ModMeta) => {
  const source = mod.manifestEntry?.source;
  return !!source?.platform && !!source.projectId && !!source.fileId;
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

const choosePrimaryPlatform = (matches: Partial<MatchedPlatforms>) => (
  PLATFORM_PRIORITY.find((platform) => matches[platform]?.projectId && matches[platform]?.fileId)
);

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
  const primaryPlatform = hasCompletePrimarySource(mod) ? undefined : choosePrimaryPlatform(matches);
  const primaryMatch = primaryPlatform ? matches[primaryPlatform] : undefined;

  return {
    ...entry,
    matchedPlatforms,
    source: primaryPlatform && primaryMatch
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
  matches: Partial<MatchedPlatforms>
) => {
  const primaryPlatform = hasCompletePrimarySource(mod) ? undefined : choosePrimaryPlatform(matches);
  const primaryMatch = primaryPlatform ? matches[primaryPlatform] : undefined;

  if (primaryPlatform && primaryMatch?.projectId && primaryMatch.fileId) {
    try {
      await modService.updateModManifest(
        instanceId,
        mod.fileName,
        mod.manifestEntry?.source.kind || 'externalImport',
        primaryPlatform,
        primaryMatch.projectId,
        primaryMatch.fileId
      );
    } catch (error) {
      console.error('Persist primary mod platform failed', error);
    }
  }

  await modService.updateModPlatformMatches(instanceId, mod.fileName, matches);
};

export const useModCloudSync = (instanceId: string) => {
  const syncCloudMetadata = useCallback(async (modsToSync: ModMeta[]) => {
    const matchedByFileName = new Map<string, Partial<ModMeta>>();
    const platformMatchesByFileName = new Map<string, Partial<MatchedPlatforms>>();
    const modrinthDetailCache = new Map<string, Promise<ModrinthProject>>();
    const curseForgeDetailCache = new Map<string, ReturnType<typeof getCurseForgeProjectDetails>>();

    const recordMatch = (
      mod: ModMeta,
      platform: MatchPlatform,
      match: ModPlatformMatch,
      meta?: Partial<ModMeta>
    ) => {
      const nextMatches = mergePlatformMatch(platformMatchesByFileName.get(mod.fileName), platform, match);
      platformMatchesByFileName.set(mod.fileName, nextMatches);
      matchedByFileName.set(mod.fileName, {
        ...(matchedByFileName.get(mod.fileName) || {}),
        ...(meta || {})
      });
    };

    const sha1Mods = modsToSync.filter((mod) => (
      mod.manifestEntry?.hash.algorithm?.toLowerCase() === 'sha1'
      && !!mod.manifestEntry.hash.value
      && !hasCompletePlatformReference(mod, 'modrinth')
    ));

    try {
      const modrinthMatches = await matchModrinthVersionsByHashes(
        sha1Mods.map((mod) => mod.manifestEntry!.hash.value),
        'sha1'
      );

      await Promise.all(sha1Mods.map(async (mod) => {
        const version = modrinthMatches[mod.manifestEntry!.hash.value];
        if (!version?.project_id) return;

        let detail: ModrinthProject | undefined;
        try {
          if (!modrinthDetailCache.has(version.project_id)) {
            modrinthDetailCache.set(version.project_id, getProjectDetails(version.project_id));
          }
          detail = await modrinthDetailCache.get(version.project_id);
          if (detail && mod.cacheKey) {
            await modService.updateModCache(
              mod.cacheKey,
              detail.title,
              detail.description,
              detail.icon_url || ''
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
              name: mod.name || detail.title,
              description: mod.description || detail.description,
              networkIconUrl: detail.icon_url || mod.networkIconUrl
            }
          : undefined);
      }));
    } catch (error) {
      console.error('Modrinth hash match failed', error);
    }

    if (hasCurseForgeApiKey()) {
      const curseForgeMods = modsToSync.filter((mod) => (
        typeof mod.curseforgeFingerprint === 'number'
        && !hasCompletePlatformReference(mod, 'curseforge')
      ));

      try {
        const curseForgeMatches = await matchCurseForgeFingerprints(
          curseForgeMods.map((mod) => mod.curseforgeFingerprint!)
        );

        await Promise.all(curseForgeMods.map(async (mod) => {
          const version = curseForgeMatches[mod.curseforgeFingerprint!];
          if (!version?.project_id) return;

          let detail: Awaited<ReturnType<typeof getCurseForgeProjectDetails>> | undefined;
          try {
            if (!curseForgeDetailCache.has(version.project_id)) {
              curseForgeDetailCache.set(version.project_id, getCurseForgeProjectDetails(version.project_id));
            }
            detail = await curseForgeDetailCache.get(version.project_id);
            if (detail && mod.cacheKey) {
              await modService.updateModCache(
                mod.cacheKey,
                detail.title,
                detail.description,
                detail.icon_url || ''
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
                name: mod.name || detail.title,
                description: mod.description || detail.description,
                networkIconUrl: detail.icon_url || mod.networkIconUrl
              }
            : undefined);
        }));
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
        await persistPlatformMatches(instanceId, mod, matches);
      } catch (error) {
        console.error('Persist mod platform matches failed', error);
      }
    }));

    return modsToSync.map((mod) => {
      const matched = matchedByFileName.get(mod.fileName);
      const matches = platformMatchesByFileName.get(mod.fileName);

      if (!matched && !matches) {
        return mod;
      }

      return {
        ...mod,
        ...matched,
        manifestEntry: matches ? buildMatchedManifestEntry(mod, matches) : mod.manifestEntry,
        isFetchingNetwork: false
      };
    });
  }, [instanceId]);

  return { syncCloudMetadata };
};
