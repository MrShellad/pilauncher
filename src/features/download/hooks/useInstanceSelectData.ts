import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import {
  getCurseForgeProjectDetails,
  getProjectDetails,
  type OreProjectVersion,
} from '@/features/resource-catalog';
import {
  getInstalledProjectIds,
  getInstalledVersionIds,
  InstalledModIndex,
  modService,
} from '@/features/instance-resources';
import type { CompatibleInstance, MissingDependency } from '../components/detail-modal/instanceSelectModel';
import type { DownloadSource } from './useResourceDownload';

interface UseInstanceSelectDataOptions {
  version: OreProjectVersion;
  ignoreLoader: boolean;
  projectId?: string;
  source: DownloadSource;
}

export const useInstanceSelectData = ({
  version,
  ignoreLoader,
  projectId,
  source,
}: UseInstanceSelectDataOptions) => {
  const { t } = useTranslation();
  const [instances, setInstances] = useState<CompatibleInstance[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingDeps, setIsCheckingDeps] = useState(false);
  const [missingDeps, setMissingDeps] = useState<MissingDependency[]>([]);
  const [autoInstallDeps, setAutoInstallDeps] = useState(true);
  const [isScanningMods, setIsScanningMods] = useState(false);
  const [alreadyInstalledInstanceIds, setAlreadyInstalledInstanceIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((instanceId: string) => {
    const nextSelectedIds = selectedIds.includes(instanceId)
      ? selectedIds.filter((id) => id !== instanceId)
      : [...selectedIds, instanceId];

    setSelectedIds(nextSelectedIds);
    if (nextSelectedIds.length === 0) {
      setMissingDeps([]);
      setIsCheckingDeps(false);
    }
  }, [selectedIds]);

  useEffect(() => {
    let cancelled = false;

    invoke<CompatibleInstance[]>('get_compatible_instances', {
      gameVersions: version.game_versions,
      loaders: version.loaders,
      ignoreLoader,
    })
      .then((list) => {
        if (!cancelled) {
          setInstances(list || []);
        }
      })
      .catch((error) => {
        console.error('Failed to load compatible instances:', error);
        if (!cancelled) {
          setInstances([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ignoreLoader, version]);

  useEffect(() => {
    if (instances.length === 0) return;
    let cancelled = false;

    const checkInstalled = async () => {
      const installedSet = new Set<string>();
      setIsScanningMods(true);

      for (const instance of instances) {
        if (cancelled) break;
        await new Promise<void>((resolve) => setTimeout(resolve, 0));

        try {
          const mods = await modService.getCachedModManifest(instance.id).catch(() => []);
          const installedProjectIds = getInstalledProjectIds(mods);
          const installedVersionIds = getInstalledVersionIds(mods);
          const hasProject = projectId && installedProjectIds.includes(projectId);
          const hasVersion = installedVersionIds.includes(version.id)
            || installedVersionIds.includes(version.version_number)
            || Boolean(version.file_name && installedVersionIds.includes(version.file_name));

          if (hasProject || hasVersion) {
            installedSet.add(instance.id);
            setAlreadyInstalledInstanceIds(new Set(installedSet));
          }
        } catch {
          // Ignore an unreadable instance cache and continue scanning the remaining instances.
        }
      }

      if (!cancelled) {
        setAlreadyInstalledInstanceIds(installedSet);
        setIsScanningMods(false);
      }
    };

    void checkInstalled();
    return () => {
      cancelled = true;
    };
  }, [instances, projectId, version]);

  useEffect(() => {
    if (selectedIds.length === 0) return;

    const requiredDependencies = (version.dependencies || []).filter(
      (dependency) => dependency.dependency_type?.toLowerCase() === 'required' && dependency.project_id,
    );
    if (requiredDependencies.length === 0) return;

    let cancelled = false;
    const checkDependencies = async () => {
      setIsCheckingDeps(true);

      try {
        const missingDependencyIds = new Set<string>();
        const dependencyIdentities = await Promise.all(
          requiredDependencies.map(async (dependency) => {
            const dependencyId = dependency.project_id!;
            try {
              const fetchDetails = source === 'curseforge'
                ? getCurseForgeProjectDetails
                : getProjectDetails;
              const detail = await fetchDetails(dependencyId);
              return {
                dependencyId,
                identity: {
                  projectId: dependencyId,
                  slug: detail.slug,
                  name: detail.title,
                },
                name: detail.title,
              };
            } catch {
              return {
                dependencyId,
                identity: { projectId: dependencyId },
                name: t('download.instanceSelect.unknownDependency', {
                  id: dependencyId,
                  defaultValue: `未知前置 (${dependencyId})`,
                }),
              };
            }
          }),
        );

        await Promise.all(
          selectedIds.map(async (instanceId) => {
            const installedMods = await modService
              .getCachedModManifest(instanceId, true)
              .catch(() => []);
            const installedIndex = new InstalledModIndex(installedMods);

            dependencyIdentities.forEach(({ dependencyId, identity }) => {
              if (installedIndex.matchDependency(identity, source).status === 'missing') {
                missingDependencyIds.add(dependencyId);
              }
            });
          }),
        );

        if (cancelled) return;
        if (missingDependencyIds.size === 0) {
          setMissingDeps([]);
          return;
        }

        const resolvedMissingDependencies = dependencyIdentities
          .filter(({ dependencyId }) => missingDependencyIds.has(dependencyId))
          .map(({ dependencyId, name }) => ({ id: dependencyId, name }));

        setMissingDeps(resolvedMissingDependencies.sort((left, right) => left.name.localeCompare(right.name)));
      } catch (error) {
        console.error('Failed to inspect missing dependencies:', error);
        if (!cancelled) {
          setMissingDeps([]);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingDeps(false);
        }
      }
    };

    void checkDependencies();
    return () => {
      cancelled = true;
    };
  }, [selectedIds, source, t, version]);

  return {
    instances,
    selectedIds,
    toggleSelection,
    isLoading,
    isCheckingDeps,
    missingDeps,
    autoInstallDeps,
    setAutoInstallDeps,
    isScanningMods,
    alreadyInstalledInstanceIds,
  };
};
