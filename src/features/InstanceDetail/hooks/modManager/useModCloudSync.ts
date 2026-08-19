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
  type ModPlatformMatch,
  type ModPlatformMatchBatchItem,
  type ModRelationRecord
} from '../../logic/modService';
import { eventBus } from '../../../../utils/eventBus';
import { fetchModrinthProjectById, type ModrinthProject, matchModrinthVersionsByHashes } from '../../logic/modrinthApi';

type MatchPlatform = 'modrinth' | 'curseforge';
type MatchedPlatforms = Record<MatchPlatform, ModPlatformMatch>;
interface SyncCloudMetadataOptions {
  force?: boolean;
  onProgress?: (current: number, total: number) => void;
  onIncrementalUpdate?: (updatedModsMap: Map<string, Partial<ModMeta>>) => void;
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

const buildPlatformMatchBatchItem = (
  mod: ModMeta,
  matches: Partial<MatchedPlatforms>,
  version?: string,
  globalMetadataPlatform?: string
): ModPlatformMatchBatchItem => {
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
    return {
      fileName: mod.fileName,
      sourcePlatform: primaryPlatform,
      sourceProjectId: primaryMatch.projectId,
      sourceFileId: primaryMatch.fileId,
      version: version || null,
    };
  }

  if (matches.modrinth?.projectId) {
    return {
      fileName: mod.fileName,
      sourcePlatform: 'modrinth',
      sourceProjectId: matches.modrinth.projectId,
      sourceFileId: matches.modrinth.fileId || null,
      version: version || null,
    };
  } else if (matches.curseforge?.projectId) {
    return {
      fileName: mod.fileName,
      sourcePlatform: 'curseforge',
      sourceProjectId: matches.curseforge.projectId,
      sourceFileId: matches.curseforge.fileId || null,
      version: version || null,
    };
  }

  return {
    fileName: mod.fileName,
    version: version || null,
  };
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
    const allPendingRelations: ModRelationRecord[] = [];
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

    const getModSha1 = (mod: ModMeta): string | undefined => {
      if (mod.sha1 && mod.sha1.trim().length > 0) return mod.sha1.trim();
      if (mod.manifestEntry?.hash?.algorithm?.toLowerCase() === 'sha1' && mod.manifestEntry.hash.value) {
        return mod.manifestEntry.hash.value.trim();
      }
      return undefined;
    };

    const sha1Mods = modsToSync.filter((mod) => (
      !!getModSha1(mod)
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
    const notifyProgress = (current: number, totalCount: number) => {
      if (typeof options.onProgress === 'function') {
        options.onProgress(current, totalCount);
      }
    };

    const emitIncrementalUpdates = (isCompleted = false) => {
      const updatedMods: Array<{ fileName: string; patch: Record<string, any> }> = [];
      const snapshot = new Map<string, Partial<ModMeta>>();
      for (const [fileName, meta] of matchedByFileName.entries()) {
        const matches = platformMatchesByFileName.get(fileName);
        const matchedVersion = versionByFileName.get(fileName);
        const isLocalVersionValid = !!meta.version && !meta.version.endsWith('.jar') && !meta.version.endsWith('.disabled');
        const finalVersion = isLocalVersionValid ? meta.version : (matchedVersion || meta.version);
        const patch = {
          ...meta,
          version: finalVersion,
          manifestEntry: matches
            ? ({
                matchedPlatforms: matches
              } as any)
            : undefined,
        };
        snapshot.set(fileName, patch);
        updatedMods.push({ fileName, patch });
      }

      eventBus.publish('mod-cloud-sync-incremental', {
        instanceId,
        updatedMods,
        isCompleted,
        progress: total > 0 ? { current: Math.min(processed, total), total, stage: 'SYNCING_METADATA' } : undefined,
      });

      if (typeof options.onIncrementalUpdate === 'function') {
        options.onIncrementalUpdate(snapshot);
      }
    };

    if (total > 0) {
      notifyProgress(0, total);
    }

    try {
      const sha1Values = sha1Mods.map((mod) => getModSha1(mod)!).filter(Boolean);
      const modrinthMatches = await matchModrinthVersionsByHashes(
        sha1Values,
        'sha1'
      );

      const batchSize = 5;
      for (let i = 0; i < sha1Mods.length; i += batchSize) {
        const batch = sha1Mods.slice(i, i + batchSize);
        await Promise.all(batch.map(async (mod) => {
          try {
            const currentSha1 = getModSha1(mod);
            const version = currentSha1 ? modrinthMatches[currentSha1] : undefined;
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
                  dbIcon,
                  mod.modId,
                  mod.curseforgeFingerprint,
                  mod.manifestEntry?.hash?.algorithm?.toLowerCase() === 'sha1' ? mod.manifestEntry.hash.value : undefined,
                  undefined,
                  version.project_id
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

            if (version.dependencies && version.dependencies.length > 0) {
              const relations: ModRelationRecord[] = [];
              for (const d of version.dependencies) {
                if (!d.project_id) continue;
                const targetProjectId = String(d.project_id);
                let depDetail: ModrinthProject | undefined;
                try {
                  if (!modrinthDetailCache.has(targetProjectId)) {
                    modrinthDetailCache.set(targetProjectId, fetchModrinthProjectById(targetProjectId));
                  }
                  depDetail = await modrinthDetailCache.get(targetProjectId);
                  if (depDetail) {
                    const depSlug = depDetail.slug || targetProjectId;
                    void modService.updateModCache(
                      `modrinth_${targetProjectId}`,
                      depDetail.title,
                      depDetail.description,
                      depDetail.icon_url,
                      depSlug,
                      undefined,
                      undefined,
                      undefined,
                      targetProjectId
                    );
                  }
                } catch {
                  // Non-blocking detail prefetch
                }

                const installedTarget = (modsToSync || []).find(
                  (m) =>
                    m.manifestEntry?.source?.projectId === targetProjectId ||
                    m.manifestEntry?.matchedPlatforms?.modrinth?.projectId === targetProjectId ||
                    m.modId?.toLowerCase() === targetProjectId.toLowerCase() ||
                    (depDetail?.slug && m.modId?.toLowerCase() === depDetail.slug.toLowerCase())
                );
                const nameHint = depDetail?.title || installedTarget?.name || installedTarget?.networkInfo?.title || d.file_name || undefined;
                const canonicalTargetId = depDetail?.slug || installedTarget?.modId || targetProjectId;

                relations.push({
                  sourceIdentifier: mod.modId || version.project_id || mod.fileName,
                  sourceType: 'mod_id',
                  targetIdentifier: canonicalTargetId,
                  targetType: canonicalTargetId === targetProjectId ? 'modrinth' : 'mod_id',
                  relationType: d.dependency_type || 'required',
                  versionRequirement: d.version_id || undefined,
                  targetNameHint: nameHint,
                  sourceProvider: 'modrinth'
                });
              }
              if (relations.length > 0) {
                allPendingRelations.push(...relations);
              }
            }
          } finally {
            processed += 1;
            notifyProgress(processed, total);
          }
        }));
        emitIncrementalUpdates();
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
                    dbIcon,
                    mod.modId,
                    mod.curseforgeFingerprint,
                    mod.manifestEntry?.hash?.algorithm?.toLowerCase() === 'sha1' ? mod.manifestEntry.hash.value : undefined,
                    version.project_id,
                    undefined
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

              if (version.dependencies && version.dependencies.length > 0) {
                const relations: ModRelationRecord[] = [];
                for (const d of version.dependencies) {
                  if (!d.project_id) continue;
                  const targetProjectId = String(d.project_id);
                  let depDetail: Awaited<ReturnType<typeof getCurseForgeProjectDetails>> | undefined;
                  try {
                    if (!curseForgeDetailCache.has(targetProjectId)) {
                      curseForgeDetailCache.set(targetProjectId, getCurseForgeProjectDetails(targetProjectId));
                    }
                    depDetail = await curseForgeDetailCache.get(targetProjectId);
                    if (depDetail) {
                      const depSlug = depDetail.slug || depDetail.title.toLowerCase().replace(/[^a-z0-9_-]/g, '') || targetProjectId;
                      void modService.updateModCache(
                        `curseforge_${targetProjectId}`,
                        depDetail.title,
                        depDetail.description,
                        depDetail.icon_url || '',
                        depSlug,
                        undefined,
                        undefined,
                        targetProjectId,
                        undefined
                      );
                    }
                  } catch {
                    // Non-blocking detail prefetch
                  }

                  const installedTarget = (modsToSync || []).find(
                    (m) =>
                      m.manifestEntry?.source?.projectId === targetProjectId ||
                      m.manifestEntry?.matchedPlatforms?.curseforge?.projectId === targetProjectId ||
                      m.modId?.toLowerCase() === targetProjectId.toLowerCase() ||
                      (depDetail?.slug && m.modId?.toLowerCase() === depDetail.slug.toLowerCase())
                  );
                  const nameHint = depDetail?.title || installedTarget?.name || installedTarget?.networkInfo?.title || d.file_name || undefined;
                  const canonicalTargetId = depDetail?.slug || installedTarget?.modId || targetProjectId;

                  relations.push({
                    sourceIdentifier: mod.modId || version.project_id || mod.fileName,
                    sourceType: 'mod_id',
                    targetIdentifier: canonicalTargetId,
                    targetType: canonicalTargetId === targetProjectId ? 'curseforge' : 'mod_id',
                    relationType: d.dependency_type || 'required',
                    versionRequirement: d.version_id || undefined,
                    targetNameHint: nameHint,
                    sourceProvider: 'curseforge'
                  });
                }
                if (relations.length > 0) {
                  allPendingRelations.push(...relations);
                }
              }
            } finally {
              processed += 1;
              notifyProgress(processed, total);
            }
          }));
          emitIncrementalUpdates();
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
              iconUrl,
              mod.modId,
              mod.curseforgeFingerprint,
              mod.manifestEntry?.hash?.algorithm?.toLowerCase() === 'sha1' ? mod.manifestEntry.hash.value : undefined,
              platform === 'curseforge' ? projectId : undefined,
              platform === 'modrinth' ? projectId : undefined
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
      emitIncrementalUpdates();
    }

    if (allPendingRelations.length > 0) {
      try {
        await modService.saveModRelations(allPendingRelations);
      } catch (error) {
        console.error('Save all pending mod relations failed', error);
      }
    }

    if (platformMatchesByFileName.size === 0 && matchedByFileName.size === 0) {
      return modsToSync;
    }

    const batchUpdates: ModPlatformMatchBatchItem[] = [];
    for (const mod of modsToSync) {
      const matches = platformMatchesByFileName.get(mod.fileName);
      if (!matches) continue;

      const matchedVersion = versionByFileName.get(mod.fileName);
      batchUpdates.push(buildPlatformMatchBatchItem(mod, matches, matchedVersion, globalPlatform));
    }

    if (batchUpdates.length > 0) {
      try {
        await modService.updateModPlatformMatchesBatch(instanceId, batchUpdates);
      } catch (error) {
        console.error('Persist mod platform matches batch failed', error);
      }
    }

    emitIncrementalUpdates(true);

    return modsToSync.map((mod) => {
      const matched = matchedByFileName.get(mod.fileName);
      const matches = platformMatchesByFileName.get(mod.fileName);
      const matchedVersion = versionByFileName.get(mod.fileName);

      if (!matched && !matches) {
        return mod;
      }

      const isLocalVersionValid = !!mod.version && !mod.version.endsWith('.jar') && !mod.version.endsWith('.disabled');
      const finalVersion = isLocalVersionValid ? mod.version : (matchedVersion || mod.version || matched?.version);

      return {
        ...mod,
        ...matched,
        version: finalVersion,
        manifestEntry: matches ? buildMatchedManifestEntry(mod, matches, globalPlatform) : mod.manifestEntry,
        isFetchingNetwork: false
      };
    });
  }, [instanceId]);

  return { syncCloudMetadata };
};
