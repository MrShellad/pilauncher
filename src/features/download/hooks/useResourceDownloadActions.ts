import { useCallback, useMemo, useRef } from 'react';
import type { TFunction } from 'i18next';

import { getInstalledProjectIds, getInstalledVersionIds, modService, type ModMeta } from '@/features/instance-resources';
import {
  fetchCurseForgeVersions,
  fetchModrinthVersions,
  type ModrinthProject,
  type OreProjectVersion,
} from '@/features/resource-catalog';
import { runResourceDownloadTask } from '../logic/resourceDownloadTask';
import type { DownloadInstanceConfig, DownloadSource, TabType } from './useResourceDownload';

interface UseResourceDownloadActionsOptions {
  activeTab: TabType;
  instanceConfig: DownloadInstanceConfig | null;
  instanceId?: string | null;
  loaderType: string;
  mcVersion: string;
  installedMods: ModMeta[];
  refreshInstalledMods: () => Promise<ModMeta[]>;
  selectedProject: ModrinthProject | null;
  selectedProjects: ModrinthProject[];
  source: DownloadSource;
  closeBatchInstanceModal: () => void;
  clearSelection: () => void;
  t: TFunction;
}

export function useResourceDownloadActions({
  activeTab,
  instanceConfig,
  instanceId,
  loaderType,
  mcVersion,
  installedMods,
  refreshInstalledMods,
  selectedProject,
  selectedProjects,
  source,
  closeBatchInstanceModal,
  clearSelection,
  t,
}: UseResourceDownloadActionsOptions) {
  const pendingDependencyIdsRef = useRef<Set<string>>(new Set());
  const installedVersionIds = useMemo(
    () => getInstalledVersionIds(installedMods),
    [installedMods]
  );

  const handleStartDownload = useCallback(async (
    version: OreProjectVersion,
    targetInstanceId: string | string[],
    autoInstallDeps = false,
    projectOverride?: { projectId?: string; source?: DownloadSource }
  ) => {
    const singleInstanceId = Array.isArray(targetInstanceId) ? targetInstanceId[0] : targetInstanceId;
    const subFolderMap: Record<TabType, string> = {
      mod: 'mods',
      resourcepack: 'resourcepacks',
      shader: 'shaderpacks',
      modpack: 'modpacks'
    };

    const subFolder = subFolderMap[activeTab];

    const executeDownload = async (targetVersion: OreProjectVersion, customProjectId?: string) => {
      try {
        let oldFileName: string | undefined;
        let installAction: 'install' | 'reinstall' | 'upgrade' = 'install';
        const projectId = customProjectId || projectOverride?.projectId || targetVersion.project_id || selectedProject?.id || '';
        const platform = (projectOverride?.source || source) === 'curseforge' ? 'curseforge' : 'modrinth';

        if (activeTab === 'mod') {
          if (projectId) {
            const currentInstalledMods = await modService.getCachedModManifest(singleInstanceId, true).catch(() => []);
            const validActualMods = (currentInstalledMods || []).filter((mod) => (mod.fileSize || 0) > 0);
            const projectIdLower = projectId.toLowerCase();
            const existingMod = validActualMods.find((mod) => {
              const fileName = mod.fileName.toLowerCase();
              if (fileName === targetVersion.file_name.toLowerCase()) return true;
              const sourceId = mod.manifestEntry?.source?.projectId?.toLowerCase();
              const modrinthId = mod.manifestEntry?.matchedPlatforms?.modrinth?.projectId?.toLowerCase();
              const curseForgeId = mod.manifestEntry?.matchedPlatforms?.curseforge?.projectId?.toLowerCase();
              const modId = mod.modId?.toLowerCase();
              return projectIdLower && (
                sourceId === projectIdLower ||
                modrinthId === projectIdLower ||
                curseForgeId === projectIdLower ||
                modId === projectIdLower
              );
            });

            if (existingMod) {
              oldFileName = existingMod.fileName;
              installAction = oldFileName.toLowerCase() === targetVersion.file_name.toLowerCase()
                ? 'reinstall'
                : 'upgrade';
            }
          }
        }

        await runResourceDownloadTask({
          url: targetVersion.download_url,
          fileName: targetVersion.file_name,
          instanceId: singleInstanceId,
          subFolder,
          title: targetVersion.file_name,
          message: installAction === 'reinstall'
            ? `正在重新下载: ${targetVersion.file_name}`
            : installAction === 'upgrade'
              ? `正在升级替换: ${targetVersion.file_name}`
              : t('download.progress.connecting', { defaultValue: 'Connecting...' }),
          modSource: activeTab !== 'modpack' && projectId && targetVersion.id
            ? {
                sourceKind: 'launcherDownload',
                platform,
                projectId,
                fileId: String(targetVersion.id),
                version: targetVersion.version_number || undefined,
                oldFileName
              }
            : undefined,
          onCompleted: async () => {
            if (activeTab !== 'mod') return;

            if (singleInstanceId === instanceId) {
              await refreshInstalledMods();
            }
          }
        });
      } catch (error) {
        console.error(`下载 ${targetVersion.file_name} 失败:`, error);
        throw error;
      }
    };

    await executeDownload(version);

    if (!autoInstallDeps || !version.dependencies?.length) return;

    try {
      const currentInstalledMods = await modService.getCachedModManifest(singleInstanceId, true);
      const installedIds = getInstalledProjectIds(currentInstalledMods);
      const missingDependencies = version.dependencies.filter(
        (dependency) =>
          dependency.dependency_type === 'required' &&
          dependency.project_id &&
          !installedIds.includes(dependency.project_id) &&
          !pendingDependencyIdsRef.current.has(dependency.project_id)
      );

      if (missingDependencies.length === 0) return;

      const targetGameVersion = version.game_versions[0]
        || instanceConfig?.game_version
        || instanceConfig?.gameVersion
        || mcVersion;

      const targetLoader = version.loaders[0]
        || instanceConfig?.loader_type
        || instanceConfig?.loaderType
        || loaderType;

      const fetchVersions = source === 'curseforge' ? fetchCurseForgeVersions : fetchModrinthVersions;

      for (const dependency of missingDependencies) {
        pendingDependencyIdsRef.current.add(dependency.project_id!);
        try {
          const dependencyVersions = await fetchVersions(
            dependency.project_id!,
            targetGameVersion && targetGameVersion !== 'all' ? targetGameVersion : undefined,
            targetLoader && targetLoader !== 'all' ? targetLoader : undefined
          );

          if (dependencyVersions.length > 0) {
            await executeDownload(dependencyVersions[0], dependency.project_id!);
          }
        } catch (error) {
          console.error(`处理前置依赖 ${dependency.project_id} 失败:`, error);
        }

        pendingDependencyIdsRef.current.delete(dependency.project_id!);
      }
    } catch (error) {
      console.error('处理前置依赖下载总流程失败:', error);
    }
  }, [
    activeTab,
    instanceConfig,
    instanceId,
    loaderType,
    mcVersion,
    refreshInstalledMods,
    selectedProject,
    source,
    t
  ]);

  const fetchLatestProjectVersion = useCallback(async (project: ModrinthProject) => {
    const projectId = project.id || project.project_id || '';
    if (!projectId) return null;

    const projectSource = project.source || source;
    const fetchVersions = projectSource === 'curseforge' ? fetchCurseForgeVersions : fetchModrinthVersions;
    const versions = await fetchVersions(projectId, mcVersion, loaderType);
    return versions[0] ? { version: versions[0], projectId, projectSource } : null;
  }, [loaderType, mcVersion, source]);

  const handleBatchDownloadConfirm = useCallback(async (instanceIds: string[]) => {
    const targets = [...selectedProjects];
    closeBatchInstanceModal();

    const resolvedVersions = await Promise.allSettled(
      targets.map((project) => fetchLatestProjectVersion(project))
    );

    const downloadable = resolvedVersions
      .map((result) => result.status === 'fulfilled' ? result.value : null)
      .filter((result): result is { version: OreProjectVersion; projectId: string; projectSource: DownloadSource } => Boolean(result));

    await Promise.allSettled(
      downloadable.flatMap(({ version, projectId, projectSource }) =>
        instanceIds.map((targetInstanceId) =>
          handleStartDownload(version, targetInstanceId, false, { projectId, source: projectSource })
        )
      )
    );

    clearSelection();
  }, [clearSelection, closeBatchInstanceModal, fetchLatestProjectVersion, handleStartDownload, selectedProjects]);

  return {
    installedVersionIds,
    handleStartDownload,
    handleBatchDownloadConfirm,
  };
}
