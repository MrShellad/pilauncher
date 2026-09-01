import { useCallback, type Dispatch, type SetStateAction } from 'react';

import { runResourceDownloadTask } from '../../../Download/logic/resourceDownloadTask';
import { useToastStore } from '../../../../store/useToastStore';
import {
  buildAutomaticUpdateMetadataSettings,
  modService,
  type ModMeta,
  type ModPlatformId,
  type ModVersionInstallAction
} from '../../logic/modService';
import {
  getModUpdateCacheKey,
  updateCacheByInstance,
  type LoadModsOptions
} from './modManagerShared';
import type { OreProjectVersion } from '../../logic/modrinthApi';

interface UseModOperationsOptions {
  instanceId: string;
  setMods: Dispatch<SetStateAction<ModMeta[]>>;
  loadMods: (options?: LoadModsOptions) => Promise<void>;
}

export interface ModInstallOptions {
  reloadAfterInstall?: boolean;
}

const getActionText = (action: ModVersionInstallAction) => {
  if (action === 'downgrade') return '降级';
  if (action === 'reinstall') return '重装';
  if (action === 'install') return '安装';
  return '升级';
};

const isSameModFile = (left: string, right: string) =>
  left === right || left.replace(/\.disabled$/i, '') === right.replace(/\.disabled$/i, '');

const applyEnabledState = (mods: ModMeta[], fileNames: string[], enable: boolean) =>
  mods.map((mod) => {
    if (!fileNames.some((fileName) => isSameModFile(fileName, mod.fileName)) || mod.isEnabled === enable) {
      return mod;
    }
    return {
      ...mod,
      isEnabled: enable,
      fileName: enable
        ? mod.fileName.replace(/\.disabled$/i, '')
        : mod.fileName.endsWith('.disabled') ? mod.fileName : `${mod.fileName}.disabled`
    };
  });

export const useModOperations = ({
  instanceId,
  setMods,
  loadMods
}: UseModOperationsOptions) => {
  const toggleMod = useCallback(async (fileName: string, currentEnabled: boolean) => {
    try {
      let filesToToggle = [fileName];
      let dependentFileNames: string[] = [];
      let parentModName = '';

      if (currentEnabled) {
        // Flip the requested row first. Resolving a full dependency graph can be noticeably
        // slower than a filesystem rename, and must not block basic toggle feedback.
        setMods((prev) => {
          const parentMod = prev.find((mod) => isSameModFile(mod.fileName, fileName));
          parentModName = parentMod?.networkInfo?.title || parentMod?.name || parentMod?.fileName || '';
          return applyEnabledState(prev, [fileName], false);
        });

        // Disabling: resolve and then append cascading dependents from the Rust DAG.
        try {
          dependentFileNames = await modService.getCascadingDependents(instanceId, fileName);
        } catch {
          dependentFileNames = [];
        }

        filesToToggle = Array.from(new Set([fileName, ...dependentFileNames]));
        if (dependentFileNames.length > 0) {
          setMods((prev) => applyEnabledState(prev, dependentFileNames, false));
        }
      } else {
        // Enabling
        setMods((prev) => applyEnabledState(prev, [fileName], true));
      }

      const nextEnabled = !currentEnabled;
      await modService.toggleModsCascading(instanceId, filesToToggle, nextEnabled);

      if (dependentFileNames.length > 0) {
        useToastStore.getState().addToast('info', `由于禁用了 ${parentModName || fileName}，已自动禁用其相关联的 ${dependentFileNames.length} 个模组。`);
      }
    } catch (error) {
      console.error(error);
      void loadMods();
    }
  }, [instanceId, loadMods, setMods]);

  const toggleMods = useCallback(async (fileNames: string[], enable: boolean) => {
    try {
      let filesToToggle = [...fileNames];
      let dependentFileNames: string[] = [];

      if (!enable) {
        // The selected rows change immediately; cascaded rows follow once dependency analysis
        // finishes, instead of making every switch wait on that analysis.
        setMods((prev) => applyEnabledState(prev, fileNames, false));
        const cascadingSet = new Set<string>();
        try {
          const deps = await modService.getCascadingDependentsBatch(instanceId, fileNames);
          deps.forEach((fileName) => cascadingSet.add(fileName));
        } catch {
          // Keep the selected rows responsive even if optional dependency analysis fails.
        }
        fileNames.forEach(f => cascadingSet.delete(f));
        dependentFileNames = Array.from(cascadingSet);
        filesToToggle = [...fileNames, ...dependentFileNames];

        if (dependentFileNames.length > 0) {
          setMods((prev) => applyEnabledState(prev, dependentFileNames, false));
        }
      } else {
        setMods((prev) => applyEnabledState(prev, fileNames, true));
      }

      await modService.toggleModsCascading(instanceId, filesToToggle, enable);

      if (dependentFileNames.length > 0) {
        useToastStore.getState().addToast('info', `已自动禁用依赖它们的 ${dependentFileNames.length} 个相关联的模组。`);
      }
    } catch (error) {
      console.error(error);
      void loadMods();
    }
  }, [instanceId, loadMods, setMods]);

  const deleteMod = useCallback(async (fileName: string) => {
    try {
      setMods((prev) => prev.filter((mod) => mod.fileName !== fileName));
      await modService.deleteMod(instanceId, fileName);
    } catch (error) {
      console.error(error);
      void loadMods();
    }
  }, [instanceId, loadMods, setMods]);

  const deleteMods = useCallback(async (fileNames: string[]) => {
    try {
      setMods((prev) => prev.filter((mod) => !fileNames.includes(mod.fileName)));
      await Promise.all(fileNames.map((fileName) => modService.deleteMod(instanceId, fileName)));
    } catch (error) {
      console.error(error);
      void loadMods();
    }
  }, [instanceId, loadMods, setMods]);

  const installModVersion = useCallback(async (
    mod: ModMeta,
    version?: OreProjectVersion,
    action: ModVersionInstallAction = 'upgrade',
    options: ModInstallOptions = {}
  ) => {
    const source = mod.manifestEntry?.source;
    let platform = mod.updatePlatform || '' as ModPlatformId | '';
    if (version?.download_url) {
      const url = version.download_url.toLowerCase();
      if (url.includes('modrinth') || url.includes('cdn.modrinth.com')) {
        platform = 'modrinth';
      } else if (url.includes('curse') || url.includes('forgecdn')) {
        platform = 'curseforge';
      }
    }
    if (!platform && source?.platform) {
      platform = (source.platform === 'modrinth' || source.platform === 'curseforge'
        ? source.platform
        : '') as ModPlatformId | '';
    }
    const projectId = version?.project_id
      || mod.updateProjectId
      || (platform ? mod.manifestEntry?.matchedPlatforms?.[platform]?.projectId : undefined)
      || (source?.platform === platform ? source.projectId : undefined)
      || mod.modId 
      || '';
    const targetVersionId = version?.id || mod.updateFileId || '';
    const targetDownloadUrl = version?.download_url || mod.updateDownloadUrl || '';
    const remoteFileName = version?.file_name || mod.updateFileName || '';

    if (!targetVersionId || !targetDownloadUrl || !remoteFileName) {
      throw new Error('缺少安装所需的远端文件信息，请先重新检查更新。');
    }

    const oldFileName = mod.fileName;
    const shouldKeepDisabled = !mod.isEnabled || oldFileName.endsWith('.disabled');
    const targetFileName = shouldKeepDisabled && !remoteFileName.endsWith('.disabled')
      ? `${remoteFileName}.disabled`
      : remoteFileName;
    setMods((current) => current.map((item) => (
      item.fileName === oldFileName ? { ...item, isUpdatingMod: true } : item
    )));

    /* Legacy task initialization is owned by runResourceDownloadTask.
      message: `正在准备${getActionText(action)}模组...`,
    */
    try {
      await runResourceDownloadTask({
        url: targetDownloadUrl,
        fileName: targetFileName,
        instanceId,
        subFolder: 'mods',
        title: targetFileName,
        message: `Preparing ${getActionText(action)} mod...`,
        onCompleted: async () => {

      const name = mod.name || mod.networkInfo?.title || '';
      const description = mod.description || mod.networkInfo?.description || '';
      const iconUrl = mod.networkIconUrl || mod.networkInfo?.icon_url || '';
      const cacheKey = platform && projectId
        ? `${platform}_${projectId}`
        : targetFileName.replace(/\.disabled$/, '').replace(/\.jar$/, '');
      if (name) {
        await modService.updateModCache(cacheKey, name, description, iconUrl)
          .catch((err) => console.error('Failed to update mod cache:', err));
      }

      const targetVersionName = version?.version_number || version?.name || mod.updateVersionName || '';
      await modService.updateModManifest(
        instanceId,
        targetFileName,
        'launcherDownload',
        platform,
        projectId,
        targetVersionId,
        targetVersionName || undefined,
        oldFileName
      );
      if (platform) {
        const matchedPlatforms = {
          ...(mod.manifestEntry?.matchedPlatforms || {}),
          [platform]: {
            ...(mod.manifestEntry?.matchedPlatforms?.[platform] || {}),
            projectId,
            fileId: targetVersionId
          }
        };
        const metadataSettings = buildAutomaticUpdateMetadataSettings(
          mod.manifestEntry?.metadataSettings
        );
        await modService.updateModPlatformMatches(instanceId, targetFileName, matchedPlatforms);
        await modService.updateModMetadataSettings(instanceId, targetFileName, metadataSettings);
      }

      if (targetFileName !== oldFileName) {
        await modService.deleteMod(instanceId, oldFileName);
      }

      const installedMod: ModMeta = {
        ...mod,
        fileName: targetFileName,
        version: version?.version_number || version?.name || mod.updateVersionName || mod.version,
        fileSize: mod.fileSize,
        isEnabled: !shouldKeepDisabled,
        modifiedAt: Date.now(),
        manifestEntry: mod.manifestEntry
          ? {
              ...mod.manifestEntry,
              source: {
                ...mod.manifestEntry.source,
                kind: 'launcherDownload',
                platform,
                projectId,
                fileId: targetVersionId
              },
              matchedPlatforms: platform
                ? {
                    ...(mod.manifestEntry.matchedPlatforms || {}),
                    [platform]: {
                      ...(mod.manifestEntry.matchedPlatforms?.[platform] || {}),
                      projectId,
                      fileId: targetVersionId
                    }
                  }
                : mod.manifestEntry.matchedPlatforms,
              metadataSettings: platform
                ? buildAutomaticUpdateMetadataSettings(mod.manifestEntry.metadataSettings)
                : mod.manifestEntry.metadataSettings
            }
          : mod.manifestEntry,
        hasUpdate: false,
        updateVersionName: undefined,
        updatePlatform: undefined,
        updateProjectId: undefined,
        updateFileId: undefined,
        updateFileName: undefined,
        updateDownloadUrl: undefined,
        isUpdatingMod: false
      };

      for (const [scopeKey, cache] of updateCacheByInstance.entries()) {
        if (scopeKey.startsWith(`${instanceId}|`)) {
          const oldKey = getModUpdateCacheKey(mod);
          const newKey = getModUpdateCacheKey(installedMod);
          cache.delete(oldKey);
          cache.set(newKey, {
            hasUpdate: false,
            checkedAt: Date.now()
          });
        }
      }

      setMods((current) => {
        const next: ModMeta[] = [];
        let inserted = false;

        for (const item of current) {
          if (item.fileName === oldFileName || item.fileName === targetFileName) {
            if (!inserted) {
              next.push(installedMod);
              inserted = true;
            }
            continue;
          }
          next.push(item);
        }

        if (!inserted) {
          next.unshift(installedMod);
        }

        return next;
      });

      if (options.reloadAfterInstall !== false) {
        await loadMods({ silent: true });
      }
        },
      });
    } catch (error) {
      setMods((current) => current.map((item) => (
        item.fileName === oldFileName ? { ...item, isUpdatingMod: false } : item
      )));
      /* Error task state is written by runResourceDownloadTask.
      useDownloadStore.getState().addOrUpdateTask({
        id: taskId,
        stage: 'ERROR',
        message: `下载失败: ${error}`
      });
      */
      throw error;
    }
  }, [instanceId, loadMods, setMods]);

  const upgradeMod = useCallback(async (mod: ModMeta, options?: ModInstallOptions) => (
    installModVersion(mod, undefined, 'upgrade', options)
  ), [installModVersion]);

  const openModFolder = useCallback(() => {
    modService.openModFolder(instanceId).catch(console.error);
  }, [instanceId]);

  const executeModFileCleanup = useCallback(async (
    items: { originalFileName: string; suggestedFileName: string }[]
  ) => {
    try {
      const result = await modService.executeModFileCleanup(instanceId, items);
      await loadMods();
      return result;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }, [instanceId, loadMods]);

  return {
    toggleMod,
    toggleMods,
    deleteMod,
    deleteMods,
    installModVersion,
    upgradeMod,
    openModFolder,
    executeModFileCleanup
  };
};
