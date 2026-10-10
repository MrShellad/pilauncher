import { useCallback, useMemo, useRef, useState } from 'react';

import type { DownloadSource } from '../../../../download';
import {
  fetchCurseForgeVersions,
  fetchModrinthVersions,
  type ModrinthProject,
  type OreProjectDependency,
  type OreProjectVersion
} from '../../../../resource-catalog';
import {
  InstalledModIndex,
  modService,
  type ModMeta
} from '../../../../instance-resources';
import { useToastStore } from '../../../../../shared/stores/useToastStore';
import {
  resolveMissingDependencies as resolveMissingDependenciesFromIndex,
  type MissingDependencyInfo
} from './resolveMissingDependencies';
import { useInstanceResourceDownloadQueue } from './useInstanceResourceDownloadQueue';

type ResourceTab = 'mod' | 'resourcepack' | 'shader';

interface UseInstanceModDownloadActionsOptions {
  instanceId: string;
  resourceTab: ResourceTab;
  source: DownloadSource;
  subFolder: string;
  targetMc: string;
  targetLoader: string;
  installedMods: ModMeta[];
  refreshInstalledMods: () => Promise<ModMeta[]>;
  selectedProject: ModrinthProject | null;
  selectedProjects: ModrinthProject[];
  clearSelection: () => void;
}

export const useInstanceModDownloadActions = ({
  instanceId,
  resourceTab,
  source,
  subFolder,
  targetMc,
  targetLoader,
  installedMods,
  refreshInstalledMods,
  selectedProject,
  selectedProjects,
  clearSelection
}: UseInstanceModDownloadActionsOptions) => {
  const addToast = useToastStore((state) => state.addToast);
  const [pendingDependencyVersion, setPendingDependencyVersion] = useState<OreProjectVersion | null>(null);
  const [pendingDependencyEntries, setPendingDependencyEntries] = useState<OreProjectDependency[]>([]);
  const [pendingDependencyProjectId, setPendingDependencyProjectId] = useState('');
  const [missingDeps, setMissingDeps] = useState<MissingDependencyInfo[]>([]);
  const [autoInstallDeps, setAutoInstallDeps] = useState(true);
  const [isCheckingDeps, setIsCheckingDeps] = useState(false);
  const [isBatchDependency, setIsBatchDependency] = useState(false);
  const [batchCount, setBatchCount] = useState(0);
  const [batchDownloadable, setBatchDownloadable] = useState<{
    version: OreProjectVersion;
    projectId: string;
  }[]>([]);
  const pendingDepIdsRef = useRef<Set<string>>(new Set());
  const installedModIndex = useMemo(() => new InstalledModIndex(installedMods), [installedMods]);
  const { cacheProjectDetails, enqueueDownload } = useInstanceResourceDownloadQueue({
    instanceId,
    resourceTab,
    source,
    subFolder,
    selectedProject,
    refreshInstalledMods
  });

  const closeDependencyModal = useCallback(() => {
    setPendingDependencyVersion(null);
    setPendingDependencyEntries([]);
    setPendingDependencyProjectId('');
    setMissingDeps([]);
    setAutoInstallDeps(true);
    setIsCheckingDeps(false);
    setIsBatchDependency(false);
    setBatchCount(0);
    setBatchDownloadable([]);
  }, []);

  const resolveMissingDependencies = useCallback((
    dependencies: OreProjectDependency[],
    activeSource: DownloadSource,
    identityIndex: InstalledModIndex = installedModIndex
  ) => resolveMissingDependenciesFromIndex({
    dependencies,
    activeSource,
    identityIndex,
    cacheProjectDetails
  }), [cacheProjectDetails, installedModIndex]);

  const downloadWithDependencies = useCallback(async (
    version: OreProjectVersion,
    targetInstanceId: string,
    dependenciesToInstall: OreProjectDependency[] = [],
    primaryProjectId?: string
  ) => {
    if (dependenciesToInstall.length > 0) {
      const fetchVersions = source === 'curseforge' ? fetchCurseForgeVersions : fetchModrinthVersions;

      for (const dependency of dependenciesToInstall) {
        if (!dependency.project_id) continue;
        pendingDepIdsRef.current.add(dependency.project_id);

        try {
          const dependencyVersions = await fetchVersions(
            dependency.project_id,
            targetMc || undefined,
            resourceTab === 'mod' ? targetLoader || undefined : undefined
          );

          if (dependencyVersions.length > 0) {
            await enqueueDownload(dependencyVersions[0], targetInstanceId, dependency.project_id);
          }
        } catch (error) {
          console.error(`前置 ${dependency.project_id} 自动下载失败:`, error);
        }
      }
      for (const dependency of dependenciesToInstall) {
        if (dependency.project_id) {
          pendingDepIdsRef.current.delete(dependency.project_id);
        }
      }
    }

    await enqueueDownload(version, targetInstanceId, primaryProjectId);
  }, [enqueueDownload, resourceTab, source, targetLoader, targetMc]);

  const handleStartDownload = useCallback(async (
    version: OreProjectVersion,
    targetInstanceId: string,
    autoInstallRequiredDeps?: boolean,
    primaryProjectId = ''
  ) => {
    if (resourceTab !== 'mod' || targetInstanceId !== instanceId) {
      await downloadWithDependencies(version, targetInstanceId, [], primaryProjectId);
      return;
    }

    if (typeof autoInstallRequiredDeps === 'boolean') {
      const dependenciesToInstall = autoInstallRequiredDeps ? pendingDependencyEntries : [];
      closeDependencyModal();

      await downloadWithDependencies(
        version,
        targetInstanceId,
        dependenciesToInstall,
        primaryProjectId
      );
      return;
    }

    const requiredDependencies = (version.dependencies || []).filter(
      (dependency) => dependency.dependency_type === 'required' && dependency.project_id
    );

    if (requiredDependencies.length === 0) {
      await downloadWithDependencies(version, targetInstanceId, [], primaryProjectId);
      return;
    }

    const dependencyCandidates = requiredDependencies.filter(
      (dependency) =>
        dependency.project_id && !pendingDepIdsRef.current.has(dependency.project_id)
    );

    if (dependencyCandidates.length === 0) {
      await downloadWithDependencies(version, targetInstanceId, [], primaryProjectId);
      return;
    }

    setIsCheckingDeps(true);

    try {
      const latestInstalledMods = await refreshInstalledMods();
      const missing = await resolveMissingDependencies(
        dependencyCandidates,
        source,
        new InstalledModIndex(latestInstalledMods)
      );
      if (missing.entries.length === 0) {
        await downloadWithDependencies(version, targetInstanceId, [], primaryProjectId);
        return;
      }

      setPendingDependencyVersion(version);
      setPendingDependencyEntries(missing.entries);
      setPendingDependencyProjectId(primaryProjectId);
      setMissingDeps(missing.info);
      setAutoInstallDeps(true);
    } catch (error) {
      console.error('分析前置依赖失败:', error);
      closeDependencyModal();
      await downloadWithDependencies(version, targetInstanceId, [], primaryProjectId);
      return;
    } finally {
      setIsCheckingDeps(false);
    }
  }, [
    closeDependencyModal,
    downloadWithDependencies,
    instanceId,
    pendingDependencyEntries,
    refreshInstalledMods,
    resolveMissingDependencies,
    resourceTab,
    source
  ]);

  const handleConfirmDependencyDownload = useCallback(async () => {
    if (!pendingDependencyVersion) return;
    await handleStartDownload(
      pendingDependencyVersion,
      instanceId,
      autoInstallDeps,
      pendingDependencyProjectId
    );
  }, [
    autoInstallDeps,
    handleStartDownload,
    instanceId,
    pendingDependencyProjectId,
    pendingDependencyVersion
  ]);

  const handleDetailDownload = useCallback((
    version: OreProjectVersion,
    targetInstanceId: string | string[],
    autoInstallRequiredDeps?: boolean
  ) => {
    const singleId = Array.isArray(targetInstanceId) ? targetInstanceId[0] : targetInstanceId;
    return handleStartDownload(
      version,
      singleId,
      autoInstallRequiredDeps,
      selectedProject?.id || ''
    );
  }, [handleStartDownload, selectedProject]);

  const fetchLatestProjectVersion = useCallback(async (project: ModrinthProject) => {
    const projectId = project.id || project.project_id || '';
    if (!projectId) return null;

    const fetchVersions = source === 'curseforge' ? fetchCurseForgeVersions : fetchModrinthVersions;
    const versions = await fetchVersions(
      projectId,
      targetMc || undefined,
      resourceTab === 'mod' ? targetLoader || undefined : undefined
    );

    return versions[0] ? { version: versions[0], projectId } : null;
  }, [resourceTab, source, targetLoader, targetMc]);

  const handleConfirmBatchDownload = useCallback(async () => {
    if (batchDownloadable.length === 0) return;

    const fetchVersions = source === 'curseforge' ? fetchCurseForgeVersions : fetchModrinthVersions;
    const targetInstanceId = instanceId;

    setIsCheckingDeps(true);
    const dependenciesToInstall = autoInstallDeps ? pendingDependencyEntries : [];
    closeDependencyModal();

    if (dependenciesToInstall.length > 0) {
      for (const dependency of dependenciesToInstall) {
        if (dependency.project_id) {
          pendingDepIdsRef.current.add(dependency.project_id);
        }
      }

      await Promise.allSettled(
        dependenciesToInstall.map(async (dependency) => {
          const depId = dependency.project_id!;
          try {
            const dependencyVersions = await fetchVersions(
              depId,
              targetMc || undefined,
              resourceTab === 'mod' ? targetLoader || undefined : undefined
            );
            if (dependencyVersions.length > 0) {
              await enqueueDownload(dependencyVersions[0], targetInstanceId, depId);
            }
          } catch (error) {
            console.error(`批量前置 ${depId} 自动下载失败:`, error);
          } finally {
            pendingDepIdsRef.current.delete(depId);
          }
        })
      );
    }

    await Promise.allSettled(
      batchDownloadable.map(({ version, projectId }) =>
        enqueueDownload(version, targetInstanceId, projectId)
      )
    );

    clearSelection();
  }, [
    autoInstallDeps,
    batchDownloadable,
    closeDependencyModal,
    enqueueDownload,
    instanceId,
    pendingDependencyEntries,
    resourceTab,
    source,
    targetLoader,
    targetMc,
    clearSelection
  ]);

  const handleBatchDownload = useCallback(async () => {
    let targets = [...selectedProjects];
    if (targets.length === 0) return;

    if (resourceTab === 'mod') {
      try {
        const actualMods = await modService.getCachedModManifest(instanceId, true);
        const validActualMods = (actualMods || []).filter((m) => (m.fileSize || 0) > 0);
        const actualIndex = new InstalledModIndex(validActualMods);
        const beforeCount = targets.length;
        targets = targets.filter((project) => !actualIndex.isInstalled(project));
        const skippedCount = beforeCount - targets.length;
        if (skippedCount > 0) {
          addToast('info', `已跳过 ${skippedCount} 个当前实例中已存在的 Mod`);
        }
      } catch (error) {
        console.error('批量下载前扫描实例 Mod 失败:', error);
        addToast('error', '无法确认实例内已有 Mod，已取消下载以避免重复');
        return;
      }
    }

    if (targets.length === 0) {
      clearSelection();
      return;
    }

    targets.forEach((project) => {
      const key = project.id || project.project_id;
      if (key) {
        cacheProjectDetails(key, project);
      }
    });

    setIsCheckingDeps(true);
    setIsBatchDependency(true);
    setBatchCount(targets.length);
    setMissingDeps([]);
    setAutoInstallDeps(true);

    try {
      const resolvedVersions = await Promise.allSettled(
        targets.map((project) => fetchLatestProjectVersion(project))
      );

      const downloadable = resolvedVersions
        .map((result) => result.status === 'fulfilled' ? result.value : null)
        .filter((result): result is { version: OreProjectVersion; projectId: string } => Boolean(result));

      if (downloadable.length === 0) {
        closeDependencyModal();
        clearSelection();
        return;
      }

      setBatchDownloadable(downloadable);
      setBatchCount(downloadable.length);

      if (resourceTab !== 'mod') {
        await Promise.allSettled(
          downloadable.map(({ version, projectId }) =>
            enqueueDownload(version, instanceId, projectId)
          )
        );
        closeDependencyModal();
        clearSelection();
        return;
      }

      const allRequiredDepsMap = new Map<string, OreProjectDependency>();
      const downloadableProjectIds = new Set(downloadable.map((d) => d.projectId));

      for (const { version } of downloadable) {
        const reqs = (version.dependencies || []).filter(
          (dep) => dep.dependency_type === 'required' && dep.project_id
        );
        for (const dep of reqs) {
          const depId = dep.project_id!;
          if (
            !downloadableProjectIds.has(depId) &&
            !pendingDepIdsRef.current.has(depId)
          ) {
            allRequiredDepsMap.set(depId, dep);
          }
        }
      }

      const dependencyCandidates = Array.from(allRequiredDepsMap.values());

      if (dependencyCandidates.length === 0) {
        await Promise.allSettled(
          downloadable.map(({ version, projectId }) =>
            enqueueDownload(version, instanceId, projectId)
          )
        );
        closeDependencyModal();
        clearSelection();
        return;
      }

      const latestInstalledMods = await refreshInstalledMods();
      const missing = await resolveMissingDependencies(
        dependencyCandidates,
        source,
        new InstalledModIndex(latestInstalledMods)
      );
      if (missing.entries.length === 0) {
        await Promise.allSettled(
          downloadable.map(({ version, projectId }) =>
            enqueueDownload(version, instanceId, projectId)
          )
        );
        closeDependencyModal();
        clearSelection();
        return;
      }

      setPendingDependencyEntries(missing.entries);
      setMissingDeps(missing.info);
      setIsCheckingDeps(false);
    } catch (error) {
      console.error('批量下载依赖分析失败:', error);
      closeDependencyModal();
      clearSelection();
    }
  }, [
    addToast,
    cacheProjectDetails,
    selectedProjects,
    fetchLatestProjectVersion,
    resourceTab,
    source,
    refreshInstalledMods,
    resolveMissingDependencies,
    enqueueDownload,
    instanceId,
    closeDependencyModal,
    clearSelection
  ]);

  const toggleAutoInstallDeps = useCallback(() => {
    setAutoInstallDeps((current) => !current);
  }, []);

  return {
    pendingDependencyVersion,
    missingDeps,
    autoInstallDeps,
    isCheckingDeps,
    isBatchDependency,
    batchCount,
    closeDependencyModal,
    toggleAutoInstallDeps,
    handleConfirmDependencyDownload,
    handleConfirmBatchDownload,
    handleDetailDownload,
    handleBatchDownload
  };
};
