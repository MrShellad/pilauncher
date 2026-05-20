import { useCallback } from 'react';

import {
  getCurseForgeProjectDetails,
  hasCurseForgeApiKey,
  matchCurseForgeFingerprints
} from '../../../Download/logic/curseforgeApi';
import { modService, type ModMeta } from '../../logic/modService';
import { getProjectDetails, matchModrinthVersionsByHashes } from '../../logic/modrinthApi';
import { needsCloudSourceMatch } from './modManagerShared';

export const useModCloudSync = (instanceId: string) => {
  const syncCloudMetadata = useCallback(async (modsToSync: ModMeta[]) => {
    const candidates = modsToSync.filter(needsCloudSourceMatch);
    if (candidates.length === 0) {
      return modsToSync;
    }

    const matchedByFileName = new Map<string, Partial<ModMeta>>();
    const sha1Mods = candidates.filter((mod) => mod.manifestEntry?.hash.algorithm === 'sha1' && mod.manifestEntry.hash.value);

    try {
      const modrinthMatches = await matchModrinthVersionsByHashes(
        sha1Mods.map((mod) => mod.manifestEntry!.hash.value),
        'sha1'
      );

      await Promise.all(sha1Mods.map(async (mod) => {
        const version = modrinthMatches[mod.manifestEntry!.hash.value];
        if (!version?.project_id) return;

        try {
          const detail = await getProjectDetails(version.project_id);
          if (mod.cacheKey) {
            await modService.updateModCache(
              mod.cacheKey,
              detail.title,
              detail.description,
              detail.icon_url || ''
            );
          }
          await modService.updateModManifest(
            instanceId,
            mod.fileName,
            'externalImport',
            'modrinth',
            version.project_id,
            version.id
          );

          matchedByFileName.set(mod.fileName, {
            name: mod.name || detail.title,
            description: mod.description || detail.description,
            networkIconUrl: detail.icon_url || mod.networkIconUrl,
            manifestEntry: mod.manifestEntry
              ? {
                  ...mod.manifestEntry,
                  source: {
                    ...mod.manifestEntry.source,
                    kind: mod.manifestEntry.source.kind,
                    platform: 'modrinth',
                    projectId: version.project_id,
                    fileId: version.id
                  }
                }
              : mod.manifestEntry
          });
        } catch (error) {
          console.error('Modrinth cloud metadata sync failed', error);
        }
      }));
    } catch (error) {
      console.error('Modrinth hash match failed', error);
    }

    if (hasCurseForgeApiKey()) {
      const curseForgeMods = candidates.filter((mod) => (
        !matchedByFileName.has(mod.fileName) && typeof mod.curseforgeFingerprint === 'number'
      ));

      try {
        const curseForgeMatches = await matchCurseForgeFingerprints(
          curseForgeMods.map((mod) => mod.curseforgeFingerprint!)
        );

        await Promise.all(curseForgeMods.map(async (mod) => {
          const version = curseForgeMatches[mod.curseforgeFingerprint!];
          if (!version?.project_id) return;

          try {
            const detail = await getCurseForgeProjectDetails(version.project_id);
            if (mod.cacheKey) {
              await modService.updateModCache(
                mod.cacheKey,
                detail.title,
                detail.description,
                detail.icon_url || ''
              );
            }
            await modService.updateModManifest(
              instanceId,
              mod.fileName,
              'externalImport',
              'curseforge',
              version.project_id,
              version.id
            );

            matchedByFileName.set(mod.fileName, {
              name: mod.name || detail.title,
              description: mod.description || detail.description,
              networkIconUrl: detail.icon_url || mod.networkIconUrl,
              manifestEntry: mod.manifestEntry
                ? {
                    ...mod.manifestEntry,
                    source: {
                      ...mod.manifestEntry.source,
                      kind: mod.manifestEntry.source.kind,
                      platform: 'curseforge',
                      projectId: version.project_id,
                      fileId: version.id
                    }
                  }
                : mod.manifestEntry
            });
          } catch (error) {
            console.error('CurseForge cloud metadata sync failed', error);
          }
        }));
      } catch (error) {
        console.error('CurseForge fingerprint match failed', error);
      }
    }

    if (matchedByFileName.size === 0) {
      return modsToSync;
    }

    return modsToSync.map((mod) => {
      const matched = matchedByFileName.get(mod.fileName);
      return matched ? { ...mod, ...matched, isFetchingNetwork: false } : mod;
    });
  }, [instanceId]);

  return { syncCloudMetadata };
};
