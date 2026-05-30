import { invoke } from '@tauri-apps/api/core';
import i18n from '../../../ui/i18';

import type { DownloadSource } from '../../Download/hooks/useResourceDownload';
import { fetchCurseForgeVersions } from '../../Download/logic/curseforgeApi';
import { fetchModrinthVersions, type OreProjectDependency, type OreProjectVersion } from '../../InstanceDetail/logic/modrinthApi';
import { getInstalledProjectIds, modService } from '../../InstanceDetail/logic/modService';
import { useDownloadStore } from '../../../store/useDownloadStore';
import type { ModSetTracker, ModSetTrackerItem } from '../stores/useModSetTrackerStore';

export interface CompatibleInstance {
  id: string;
  name: string;
  version?: string;
  loader?: string;
}

export interface ModSetInstallResult {
  installed: number;
  skipped: number;
  failed: number;
  instanceId: string;
}

const sanitizeInstanceId = (input: string) => {
  const sanitized = input.replace(/[\\/:*?"<>|]/g, '_');
  return sanitized || '_';
};

const normalizeLoaderForPayload = (loader: string) => {
  switch (loader.trim().toLowerCase()) {
    case 'fabric':
      return 'Fabric';
    case 'forge':
      return 'Forge';
    case 'neoforge':
    case 'neo_forge':
    case 'neo-forge':
      return 'NeoForge';
    case 'quilt':
      return 'Quilt';
    default:
      return 'Vanilla';
  }
};

const createFolderName = (tracker: ModSetTracker) => {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .replace('T', '_');
  return sanitizeInstanceId(`${tracker.collectionName}_${tracker.gameVersion}_${tracker.loader}_${timestamp}`);
};

const getInstancesSavePath = async () => {
  const basePath = await invoke<string | null>('get_base_directory').catch(() => null);
  if (!basePath) return '';
  const separator = basePath.includes('\\') ? '\\' : '/';
  return `${basePath}${separator}instances`;
};

const fetchVersionsForSource = (
  source: DownloadSource,
  projectId: string,
  gameVersion: string,
  loader: string,
) => {
  if (source === 'curseforge') {
    return fetchCurseForgeVersions(projectId, gameVersion || undefined, loader || undefined);
  }
  return fetchModrinthVersions(projectId, gameVersion || undefined, loader || undefined);
};

const trackerItemToVersion = (item: ModSetTrackerItem): OreProjectVersion | null => {
  if (
    item.status !== 'ready' ||
    !item.matchedVersionId ||
    !item.matchedVersionNumber ||
    !item.matchedFileName ||
    !item.matchedDownloadUrl
  ) {
    return null;
  }

  return {
    id: item.matchedVersionId,
    project_id: item.projectId,
    name: item.matchedVersionNumber,
    version_number: item.matchedVersionNumber,
    date_published: item.publishedAt || '',
    loaders: [],
    game_versions: [],
    file_name: item.matchedFileName,
    download_url: item.matchedDownloadUrl,
    dependencies: item.dependencies,
  };
};

const chooseInstallableVersion = (versions: OreProjectVersion[]) =>
  versions.find((version) => Boolean(version.download_url && version.file_name)) || null;

const resolveTrackerItemVersion = async (
  tracker: ModSetTracker,
  item: ModSetTrackerItem,
) => {
  const cachedVersion = trackerItemToVersion(item);
  if (!cachedVersion) return null;
  if (cachedVersion.dependencies !== undefined) return cachedVersion;

  try {
    const versions = await fetchVersionsForSource(
      item.source,
      item.projectId,
      tracker.gameVersion,
      tracker.loader,
    );
    const hydratedVersion = versions.find((version) => version.id === item.matchedVersionId);
    return hydratedVersion || cachedVersion;
  } catch {
    return cachedVersion;
  }
};

const enqueueResourceTask = (version: OreProjectVersion, instanceId: string) => {
  useDownloadStore.getState().addOrUpdateTask({
    id: version.file_name,
    taskType: 'resource',
    title: version.file_name,
    stage: 'DOWNLOADING_MOD',
    current: 0,
    total: 100,
    message: i18n.t('libraryPage.messages.connectingDownload'),
    retryAction: 'download_resource',
    retryPayload: {
      url: version.download_url,
      fileName: version.file_name,
      instanceId,
      subFolder: 'mods',
    },
  });
};

export const getCompatibleInstancesForTracker = (tracker: ModSetTracker) =>
  invoke<CompatibleInstance[]>('get_compatible_instances', {
    gameVersions: [tracker.gameVersion],
    loaders: [tracker.loader],
    ignoreLoader: false,
  });

export const createInstanceForTracker = async (
  tracker: ModSetTracker,
  instanceName?: string,
) => {
  const loaderType = normalizeLoaderForPayload(tracker.loader);
  const loaderVersions = loaderType === 'Vanilla'
    ? []
    : await invoke<string[]>('get_loader_versions', {
        loaderType,
        gameVersion: tracker.gameVersion,
      });
  const loaderVersion = loaderType === 'Vanilla'
    ? 'Vanilla'
    : (loaderVersions || []).sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }))[0];

  if (loaderType !== 'Vanilla' && !loaderVersion) {
    throw new Error(i18n.t('libraryPage.tracker.noLoaderVersion', { version: tracker.gameVersion, loader: loaderType }));
  }

  const folderName = createFolderName(tracker);
  const name = instanceName?.trim() || `${tracker.collectionName} ${tracker.gameVersion} ${loaderType}`;

  useDownloadStore.getState().addOrUpdateTask({
    id: folderName,
    taskType: 'instance',
    title: name,
    stage: 'PREPARING',
    current: 0,
    total: 100,
    message: i18n.t('libraryPage.tracker.creatingInstance'),
    retryAction: 'create_instance',
    retryPayload: {
      payload: {
        name,
        folder_name: folderName,
        game_version: tracker.gameVersion,
        loader_type: loaderType,
        loader_version: loaderVersion,
        save_path: await getInstancesSavePath(),
        cover_image: null,
      },
    },
  });

  await invoke('create_instance', {
    payload: {
      name,
      folder_name: folderName,
      game_version: tracker.gameVersion,
      loader_type: loaderType,
      loader_version: loaderVersion,
      save_path: await getInstancesSavePath(),
      cover_image: null,
    },
  });

  return sanitizeInstanceId(folderName);
};

export const installTrackerToInstance = async (
  tracker: ModSetTracker,
  instanceId: string,
): Promise<ModSetInstallResult> => {
  const installedProjectIds = new Set(
    getInstalledProjectIds(await modService.getCachedModManifest(instanceId, true)),
  );
  const installingProjectKeys = new Set<string>();
  let installed = 0;
  let skipped = 0;
  let failed = 0;

  const installVersion = async (
    source: DownloadSource,
    projectId: string,
    version: OreProjectVersion,
  ) => {
    const key = `${source}:${projectId}`;
    if (installedProjectIds.has(projectId)) {
      skipped += 1;
      return;
    }
    if (installingProjectKeys.has(key)) return;

    installingProjectKeys.add(key);

    try {
      const requiredDependencies = (version.dependencies || []).filter(
        (dependency): dependency is OreProjectDependency & { project_id: string } =>
          dependency.dependency_type === 'required' && Boolean(dependency.project_id),
      );

      for (const dependency of requiredDependencies) {
        const dependencyProjectId = dependency.project_id;
        if (installedProjectIds.has(dependencyProjectId)) continue;

        const dependencyVersions = await fetchVersionsForSource(
          source,
          dependencyProjectId,
          tracker.gameVersion,
          tracker.loader,
        );
        const dependencyVersion = chooseInstallableVersion(dependencyVersions);
        if (dependencyVersion) {
          await installVersion(source, dependencyProjectId, dependencyVersion);
        }
      }

      enqueueResourceTask(version, instanceId);
      await modService.downloadResource(version.download_url, version.file_name, instanceId, 'mods');
      await modService.updateModManifest(
        instanceId,
        version.file_name,
        'launcherDownload',
        source === 'curseforge' ? 'curseforge' : 'modrinth',
        projectId,
        version.id,
      );
      installedProjectIds.add(projectId);
      installed += 1;
    } catch (error) {
      failed += 1;
      console.error(`[ModSetInstaller] Failed to install ${key}`, error);
      useDownloadStore.getState().addOrUpdateTask({
        id: version.file_name,
        stage: 'ERROR',
        message: i18n.t('libraryPage.messages.downloadFailed', { error: String(error) }),
      });
    } finally {
      installingProjectKeys.delete(key);
    }
  };

  for (const item of tracker.items) {
    const version = await resolveTrackerItemVersion(tracker, item);
    if (!version) {
      skipped += 1;
      continue;
    }
    await installVersion(item.source, item.projectId, version);
  }

  modService.invalidateModManifestCache(instanceId);
  useDownloadStore.getState().setPopupOpen(true);

  return { installed, skipped, failed, instanceId };
};
