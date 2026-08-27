import { useCallback } from 'react';

import {
  getCurseForgeProjectsBatch,
  hasCurseForgeApiKey,
  matchCurseForgeFingerprints
} from '../../../Download/logic/curseforgeApi';
import {
  getModPreferredPlatform,
  getModPlatformReference,
  modService,
  type ModCacheUpdateItem,
  type ModMeta,
  type ModPlatformMatch,
  type ModPlatformMatchBatchItem,
  type ModRelationRecord
} from '../../logic/modService';
import { eventBus } from '../../../../utils/eventBus';
import {
  fetchModrinthProjectsBatch,
  type ModrinthProject,
  matchModrinthVersionsByHashes
} from '../../logic/modrinthApi';

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
    const modrinthDetailMap = new Map<string, ModrinthProject>();
    const curseForgeDetailMap = new Map<string, any>();
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

    // ========================================================
    // 1. Modrinth 批量匹配版本与项目详情
    // ========================================================
    if (sha1Mods.length > 0) {
      try {
        const sha1Values = sha1Mods.map((mod) => getModSha1(mod)!).filter(Boolean);
        const modrinthMatches = await matchModrinthVersionsByHashes(
          sha1Values,
          'sha1'
        );

        // 1.1 收集所有需要获取详情的 project_id（包含自身及前向依赖）
        const modrinthProjectIdsToFetch = new Set<string>();
        const validModrinthMods: Array<{ mod: ModMeta; version: any }> = [];

        for (const mod of sha1Mods) {
          const currentSha1 = getModSha1(mod);
          const version = currentSha1 ? modrinthMatches[currentSha1] : undefined;
          if (version?.project_id) {
            validModrinthMods.push({ mod, version });
            if (!modrinthDetailMap.has(version.project_id)) {
              modrinthProjectIdsToFetch.add(version.project_id);
            }
            if (version.dependencies) {
              for (const d of version.dependencies) {
                if (d.project_id && !modrinthDetailMap.has(String(d.project_id))) {
                  modrinthProjectIdsToFetch.add(String(d.project_id));
                }
              }
            }
          }
        }

        // 1.2 批量调用 Modrinth Projects API 获取详情
        if (modrinthProjectIdsToFetch.size > 0) {
          const fetchedList = await fetchModrinthProjectsBatch(Array.from(modrinthProjectIdsToFetch));
          for (const p of fetchedList) {
            modrinthDetailMap.set(p.id, p);
          }
        }

        // 1.3 组装并批量写入 SQLite 数据库缓存
        const cacheUpdateItems: ModCacheUpdateItem[] = [];
        const cachedIconPathMap = new Map<string, string | null>();

        for (const { mod, version } of validModrinthMods) {
          const detail = modrinthDetailMap.get(version.project_id);
          if (detail) {
            const dbIcon = detail.icon_url || mod.networkIconUrl || '';
            cacheUpdateItems.push({
              cacheKey: `modrinth_${version.project_id}`,
              name: detail.title,
              desc: detail.description,
              iconUrl: dbIcon,
              modId: mod.modId || null,
              curseforgeFingerprint: mod.curseforgeFingerprint || null,
              modrinthHash: mod.manifestEntry?.hash?.algorithm?.toLowerCase() === 'sha1' ? mod.manifestEntry.hash.value : null,
              curseforgeProjectId: null,
              modrinthProjectId: version.project_id
            });
          }

          if (version.dependencies) {
            for (const d of version.dependencies) {
              if (!d.project_id) continue;
              const targetProjectId = String(d.project_id);
              const depDetail = modrinthDetailMap.get(targetProjectId);
              if (depDetail) {
                const depSlug = depDetail.slug || targetProjectId;
                cacheUpdateItems.push({
                  cacheKey: `modrinth_${targetProjectId}`,
                  name: depDetail.title,
                  desc: depDetail.description,
                  iconUrl: depDetail.icon_url,
                  modId: depSlug,
                  curseforgeFingerprint: null,
                  modrinthHash: null,
                  curseforgeProjectId: null,
                  modrinthProjectId: targetProjectId
                });
              }
            }
          }
        }

        if (cacheUpdateItems.length > 0) {
          try {
            const iconPaths = await modService.updateModCacheBatch(cacheUpdateItems);
            for (const [key, p] of Object.entries(iconPaths)) {
              cachedIconPathMap.set(key, p);
            }
          } catch (e) {
            console.warn('[useModCloudSync] Modrinth batch cache update failed:', e);
          }
        }

        // 1.4 记录匹配与依赖关系
        for (const { mod, version } of validModrinthMods) {
          const detail = modrinthDetailMap.get(version.project_id);
          const cachedIconPath = cachedIconPathMap.get(`modrinth_${version.project_id}`);

          recordMatch(mod, 'modrinth', {
            projectId: version.project_id,
            fileId: version.id
          }, detail ? {
            name: detail.title || mod.name,
            description: mod.description || detail.description,
            networkIconUrl: detail.icon_url || mod.networkIconUrl,
            iconAbsolutePath: cachedIconPath || mod.iconAbsolutePath
          } : undefined, version.version_number);

          if (version.dependencies && version.dependencies.length > 0) {
            const relations: ModRelationRecord[] = [];
            for (const d of version.dependencies) {
              if (!d.project_id) continue;
              const targetProjectId = String(d.project_id);
              const depDetail = modrinthDetailMap.get(targetProjectId);

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

          processed += 1;
          notifyProgress(processed, total);
        }

        emitIncrementalUpdates();
      } catch (error) {
        console.error('Modrinth hash match failed', error);
      }
    }

    // ========================================================
    // 2. CurseForge 批量匹配指纹与项目详情
    // ========================================================
    if (curseForgeMods.length > 0) {
      try {
        const curseForgeMatches = await matchCurseForgeFingerprints(
          curseForgeMods.map((mod) => mod.curseforgeFingerprint!)
        );

        // 2.1 收集所有需要获取详情的 project_id
        const curseForgeProjectIdsToFetch = new Set<string>();
        const validCurseForgeMods: Array<{ mod: ModMeta; version: any }> = [];

        for (const mod of curseForgeMods) {
          const version = curseForgeMatches[mod.curseforgeFingerprint!];
          if (version?.project_id) {
            validCurseForgeMods.push({ mod, version });
            if (!curseForgeDetailMap.has(String(version.project_id))) {
              curseForgeProjectIdsToFetch.add(String(version.project_id));
            }
            if (version.dependencies) {
              for (const d of version.dependencies) {
                if (d.project_id && !curseForgeDetailMap.has(String(d.project_id))) {
                  curseForgeProjectIdsToFetch.add(String(d.project_id));
                }
              }
            }
          }
        }

        // 2.2 批量调用 CurseForge Projects API 获取详情
        if (curseForgeProjectIdsToFetch.size > 0) {
          const fetchedList = await getCurseForgeProjectsBatch(Array.from(curseForgeProjectIdsToFetch));
          for (const p of fetchedList) {
            curseForgeDetailMap.set(String(p.id), p);
          }
        }

        // 2.3 组装并批量写入 SQLite 数据库缓存
        const cacheUpdateItems: ModCacheUpdateItem[] = [];
        const cachedIconPathMap = new Map<string, string | null>();

        for (const { mod, version } of validCurseForgeMods) {
          const strProjectId = String(version.project_id);
          const detail = curseForgeDetailMap.get(strProjectId);
          if (detail) {
            const dbIcon = detail.icon_url || mod.networkIconUrl || '';
            cacheUpdateItems.push({
              cacheKey: `curseforge_${strProjectId}`,
              name: detail.title,
              desc: detail.description,
              iconUrl: dbIcon,
              modId: mod.modId || null,
              curseforgeFingerprint: mod.curseforgeFingerprint || null,
              modrinthHash: mod.manifestEntry?.hash?.algorithm?.toLowerCase() === 'sha1' ? mod.manifestEntry.hash.value : null,
              curseforgeProjectId: strProjectId,
              modrinthProjectId: null
            });
          }

          if (version.dependencies) {
            for (const d of version.dependencies) {
              if (!d.project_id) continue;
              const targetProjectId = String(d.project_id);
              const depDetail = curseForgeDetailMap.get(targetProjectId);
              if (depDetail) {
                const depSlug = depDetail.slug || depDetail.title.toLowerCase().replace(/[^a-z0-9_-]/g, '') || targetProjectId;
                cacheUpdateItems.push({
                  cacheKey: `curseforge_${targetProjectId}`,
                  name: depDetail.title,
                  desc: depDetail.description,
                  iconUrl: depDetail.icon_url || '',
                  modId: depSlug,
                  curseforgeFingerprint: null,
                  modrinthHash: null,
                  curseforgeProjectId: targetProjectId,
                  modrinthProjectId: null
                });
              }
            }
          }
        }

        if (cacheUpdateItems.length > 0) {
          try {
            const iconPaths = await modService.updateModCacheBatch(cacheUpdateItems);
            for (const [key, p] of Object.entries(iconPaths)) {
              cachedIconPathMap.set(key, p);
            }
          } catch (e) {
            console.warn('[useModCloudSync] CurseForge batch cache update failed:', e);
          }
        }

        // 2.4 记录匹配与依赖关系
        for (const { mod, version } of validCurseForgeMods) {
          const strProjectId = String(version.project_id);
          const detail = curseForgeDetailMap.get(strProjectId);
          const cachedIconPath = cachedIconPathMap.get(`curseforge_${strProjectId}`);

          recordMatch(mod, 'curseforge', {
            projectId: version.project_id,
            fileId: version.id
          }, detail ? {
            name: detail.title || mod.name,
            description: mod.description || detail.description,
            networkIconUrl: detail.icon_url || mod.networkIconUrl,
            iconAbsolutePath: cachedIconPath || mod.iconAbsolutePath
          } : undefined, version.version_number);

          if (version.dependencies && version.dependencies.length > 0) {
            const relations: ModRelationRecord[] = [];
            for (const d of version.dependencies) {
              if (!d.project_id) continue;
              const targetProjectId = String(d.project_id);
              const depDetail = curseForgeDetailMap.get(targetProjectId);

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

          processed += 1;
          notifyProgress(processed, total);
        }

        emitIncrementalUpdates();
      } catch (error) {
        console.error('CurseForge fingerprint match failed', error);
      }
    }

    // ========================================================
    // 3. 补全已有项目平台引用的图标与元数据 (批量更新)
    // ========================================================
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

    if (knownIconMods.length > 0) {
      const modrinthIds = new Set<string>();
      const curseForgeIds = new Set<string>();

      for (const mod of knownIconMods) {
        const platform = getModPreferredPlatformWithGlobal(mod, globalPlatform);
        const projectId = platform ? getModPlatformReference(mod, platform)?.projectId : undefined;
        if (platform === 'modrinth' && projectId && !modrinthDetailMap.has(projectId)) {
          modrinthIds.add(projectId);
        } else if (platform === 'curseforge' && projectId && !curseForgeDetailMap.has(projectId)) {
          curseForgeIds.add(projectId);
        }
      }

      if (modrinthIds.size > 0) {
        const mrList = await fetchModrinthProjectsBatch(Array.from(modrinthIds));
        for (const p of mrList) modrinthDetailMap.set(p.id, p);
      }
      if (curseForgeIds.size > 0) {
        const cfList = await getCurseForgeProjectsBatch(Array.from(curseForgeIds));
        for (const p of cfList) curseForgeDetailMap.set(String(p.id), p);
      }

      const knownCacheUpdates: ModCacheUpdateItem[] = [];
      for (const mod of knownIconMods) {
        const platform = getModPreferredPlatformWithGlobal(mod, globalPlatform);
        const projectId = platform ? getModPlatformReference(mod, platform)?.projectId : undefined;
        if (!platform || !projectId) continue;

        let title = mod.name || '';
        let description = mod.description || '';
        let iconUrl = mod.networkIconUrl || '';

        if (platform === 'modrinth') {
          const detail = modrinthDetailMap.get(projectId);
          title = detail?.title || title;
          description = detail?.description || description;
          iconUrl = detail?.icon_url || iconUrl;
        } else {
          const detail = curseForgeDetailMap.get(projectId);
          title = detail?.title || title;
          description = detail?.description || description;
          iconUrl = detail?.icon_url || iconUrl;
        }

        if (iconUrl) {
          knownCacheUpdates.push({
            cacheKey: `${platform}_${projectId}`,
            name: title,
            desc: description,
            iconUrl,
            modId: mod.modId || null,
            curseforgeFingerprint: mod.curseforgeFingerprint || null,
            modrinthHash: mod.manifestEntry?.hash?.algorithm?.toLowerCase() === 'sha1' ? mod.manifestEntry.hash.value : null,
            curseforgeProjectId: platform === 'curseforge' ? projectId : null,
            modrinthProjectId: platform === 'modrinth' ? projectId : null
          });
        }
      }

      if (knownCacheUpdates.length > 0) {
        try {
          const iconPaths = await modService.updateModCacheBatch(knownCacheUpdates);
          for (const mod of knownIconMods) {
            const platform = getModPreferredPlatformWithGlobal(mod, globalPlatform);
            const projectId = platform ? getModPlatformReference(mod, platform)?.projectId : undefined;
            if (!platform || !projectId) continue;

            const detail = platform === 'modrinth' ? modrinthDetailMap.get(projectId) : curseForgeDetailMap.get(projectId);
            const cachedIconPath = iconPaths[`${platform}_${projectId}`];
            const iconUrl = detail?.icon_url || mod.networkIconUrl || '';

            matchedByFileName.set(mod.fileName, {
              name: detail?.title || mod.name,
              description: detail?.description || mod.description,
              networkIconUrl: iconUrl || mod.networkIconUrl,
              iconAbsolutePath: cachedIconPath || mod.iconAbsolutePath
            });
          }
        } catch (e) {
          console.warn('[useModCloudSync] Known mods batch cache update failed:', e);
        }
      }
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
