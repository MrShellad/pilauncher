import { useCallback, useRef } from 'react';

import { runResourceDownloadTask, type DownloadSource } from '../../../../download';
import {
  getCurseForgeProjectDetails,
  getProjectDetails,
  type ModrinthProject,
  type OreProjectVersion
} from '../../../../resource-catalog';
import { modService, type ModMeta } from '../../../../instance-resources';
import { useToastStore } from '../../../../../shared/stores/useToastStore';
import { eventBus } from '../../../../../utils/event-bus';

type ResourceTab = 'mod' | 'resourcepack' | 'shader';

export interface CachedProjectDetails {
  slug?: string;
  title?: string;
  name?: string;
  description?: string;
  summary?: string;
  icon_url?: string | null;
  logo?: string;
}

interface UseInstanceResourceDownloadQueueOptions {
  instanceId: string;
  resourceTab: ResourceTab;
  source: DownloadSource;
  subFolder: string;
  selectedProject: ModrinthProject | null;
  refreshInstalledMods: () => Promise<ModMeta[]>;
}

export const useInstanceResourceDownloadQueue = ({
  instanceId,
  resourceTab,
  source,
  subFolder,
  selectedProject,
  refreshInstalledMods
}: UseInstanceResourceDownloadQueueOptions) => {
  const addToast = useToastStore((state) => state.addToast);
  const pendingDownloadProjectIdsRef = useRef<Set<string>>(new Set());
  const projectDetailsCache = useRef<Map<string, CachedProjectDetails>>(new Map());

  const cacheProjectDetails = useCallback((projectId: string, details: CachedProjectDetails) => {
    projectDetailsCache.current.set(projectId, details);
  }, []);

  const enqueueDownload = useCallback(async (
    version: OreProjectVersion,
    targetInstanceId: string,
    explicitProjectId?: string
  ) => {
    /* Legacy task initialization is owned by runResourceDownloadTask.
      message: '正在建立连接...',
    */
    const projectId = explicitProjectId || version.project_id || selectedProject?.id || '';
    const platform = source === 'curseforge' ? 'curseforge' : 'modrinth';
    const downloadIdentity = projectId ? `${platform}:${projectId.toLowerCase()}` : '';
    const shouldGuardInstalledMod = resourceTab === 'mod' && targetInstanceId === instanceId && !!projectId;

    if (shouldGuardInstalledMod && pendingDownloadProjectIdsRef.current.has(downloadIdentity)) {
      addToast('info', '该 Mod 已在下载队列中，已跳过重复任务');
      return;
    }

    if (shouldGuardInstalledMod) {
      pendingDownloadProjectIdsRef.current.add(downloadIdentity);
    }

    let oldFileName: string | undefined;
    let installAction: 'install' | 'reinstall' | 'upgrade' = 'install';

    try {
      if (shouldGuardInstalledMod) {
        let actualMods;
        try {
          actualMods = await modService.getCachedModManifest(targetInstanceId, true);
        } catch (error) {
          console.error('下载前扫描实例 Mod 失败:', error);
        }
        let detail = projectDetailsCache.current.get(projectId);
        if (!detail) {
          try {
            detail = source === 'curseforge'
              ? await getCurseForgeProjectDetails(projectId)
              : await getProjectDetails(projectId);
            projectDetailsCache.current.set(projectId, detail);
          } catch {
            // Exact platform project IDs can still be checked without project details.
          }
        }

        const validActualMods = (actualMods || []).filter((m) => (m.fileSize || 0) > 0);
        const pLower = projectId.toLowerCase();
        const slugLower = detail?.slug?.toLowerCase();
        const existingMod = validActualMods.find((m) => {
          const mFile = m.fileName.toLowerCase();
          if (mFile === version.file_name.toLowerCase()) return true;
          const srcId = m.manifestEntry?.source?.projectId?.toLowerCase();
          const mrId = m.manifestEntry?.matchedPlatforms?.modrinth?.projectId?.toLowerCase();
          const cfId = m.manifestEntry?.matchedPlatforms?.curseforge?.projectId?.toLowerCase();
          const modId = m.modId?.toLowerCase();
          return (
            (pLower && (
              srcId === pLower ||
              mrId === pLower ||
              cfId === pLower ||
              modId === pLower
            )) ||
            (slugLower && (srcId === slugLower || modId === slugLower))
          );
        });

        if (existingMod) {
          oldFileName = existingMod.fileName;
          installAction = oldFileName.toLowerCase() === version.file_name.toLowerCase()
            ? 'reinstall'
            : 'upgrade';
        }
      }

      await runResourceDownloadTask({
        url: version.download_url,
        fileName: version.file_name,
        instanceId: targetInstanceId,
        subFolder,
        title: version.file_name,
        message: installAction === 'reinstall'
          ? `正在重新下载: ${version.file_name}`
          : installAction === 'upgrade'
            ? `正在升级替换: ${version.file_name}`
            : 'Connecting...',
        modSource: resourceTab === 'mod' && projectId && version.id
          ? {
              sourceKind: 'launcherDownload',
              platform,
              projectId,
              fileId: String(version.id),
              version: version.version_number || undefined,
              oldFileName
            }
          : undefined,
        onCompleted: async () => {
          let cachedDetail = projectId ? projectDetailsCache.current.get(projectId) : null;
          if (!cachedDetail && projectId && selectedProject && projectId === selectedProject.id) {
            cachedDetail = selectedProject;
          }

          if (projectId && cachedDetail) {
            const cacheKey = `${platform}_${projectId}`;
            await modService.updateModCache(
              cacheKey,
              cachedDetail.title || cachedDetail.name || '',
              cachedDetail.description || cachedDetail.summary || '',
              cachedDetail.icon_url || cachedDetail.logo || ''
            ).catch((err) => console.error('Failed to update resource cache:', err));
          }

          if (targetInstanceId === instanceId && resourceTab === 'mod') {
            await refreshInstalledMods();
          }

          eventBus.publish('instance-resources-fs-changed', {
            instanceId: targetInstanceId,
            resType: resourceTab,
            action: 'install',
            fileName: version.file_name
          });
        }
      });
    } catch (error) {
      console.error('下载异常:', error);
      /* Error task state is written by runResourceDownloadTask.
      useDownloadStore.getState().addOrUpdateTask({
        id: taskId,
        stage: 'ERROR',
        message: `下载失败: ${error}`
      });
      */
      throw error;
    } finally {
      if (shouldGuardInstalledMod) {
        pendingDownloadProjectIdsRef.current.delete(downloadIdentity);
      }
    }
  }, [addToast, instanceId, refreshInstalledMods, resourceTab, selectedProject, source, subFolder]);

  return {
    cacheProjectDetails,
    enqueueDownload
  };
};
