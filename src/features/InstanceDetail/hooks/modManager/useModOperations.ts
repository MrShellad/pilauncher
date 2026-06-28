import { useCallback, type Dispatch, type SetStateAction } from 'react';

import { useDownloadStore } from '../../../../store/useDownloadStore';
import { useToastStore } from '../../../../store/useToastStore';
import {
  buildLockedModMetadataSettings,
  modService,
  type ModMeta,
  type ModPlatformId,
  type ModVersionInstallAction
} from '../../logic/modService';
import type { OreProjectVersion } from '../../logic/modrinthApi';
import type { LoadModsOptions } from './modManagerShared';

interface UseModOperationsOptions {
  instanceId: string;
  setMods: Dispatch<SetStateAction<ModMeta[]>>;
  loadMods: (options?: LoadModsOptions) => Promise<void>;
}

const getDependentMods = (mods: ModMeta[], parentMod: ModMeta): ModMeta[] => {
  const identifiers = new Set<string>();
  if (parentMod.modId) identifiers.add(parentMod.modId.toLowerCase());
  if (parentMod.manifestEntry?.source?.projectId) identifiers.add(parentMod.manifestEntry.source.projectId.toLowerCase());
  if (parentMod.name) identifiers.add(parentMod.name.toLowerCase());
  
  const cleanFileName = parentMod.fileName.replace(/\.jar$/, '').replace(/\.disabled$/, '').split('-')[0].toLowerCase();
  if (cleanFileName) identifiers.add(cleanFileName);

  const dependentMods: ModMeta[] = [];
  const visited = new Set<string>();
  
  const findDependents = (currentIdentifiers: Set<string>) => {
    let foundNew = false;
    for (const mod of mods) {
      if (!mod.isEnabled || visited.has(mod.fileName)) continue;
      
      const modDeps = (mod.dependencies || mod.manifestEntry?.dependencies) as any[] | undefined;
      if (!modDeps) continue;
      
      const hasDependency = modDeps.some(dep => {
        const depId = typeof dep === 'string' 
          ? dep.toLowerCase() 
          : dep.project_id?.toLowerCase();
        return depId && currentIdentifiers.has(depId);
      });
      
      if (hasDependency) {
        dependentMods.push(mod);
        visited.add(mod.fileName);
        
        if (mod.modId) identifiers.add(mod.modId.toLowerCase());
        if (mod.manifestEntry?.source?.projectId) identifiers.add(mod.manifestEntry.source.projectId.toLowerCase());
        
        foundNew = true;
      }
    }
    if (foundNew) {
      findDependents(identifiers);
    }
  };
  
  findDependents(identifiers);
  return dependentMods;
};

const getActionText = (action: ModVersionInstallAction) => {
  if (action === 'downgrade') return '降级';
  if (action === 'reinstall') return '重装';
  if (action === 'install') return '安装';
  return '升级';
};

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
        setMods((prev) => {
          const parentMod = prev.find(m => m.fileName === fileName);
          if (parentMod) {
            parentModName = parentMod.networkInfo?.title || parentMod.name || parentMod.fileName;
            const dependents = getDependentMods(prev, parentMod);
            dependentFileNames = dependents.map(d => d.fileName);
            filesToToggle = [fileName, ...dependentFileNames];
          }
          
          return prev.map((mod) => (
            filesToToggle.includes(mod.fileName)
              ? {
                  ...mod,
                  isEnabled: false,
                  fileName: mod.fileName.endsWith('.disabled') ? mod.fileName : `${mod.fileName}.disabled`
                }
              : mod
          ));
        });
      } else {
        setMods((prev) => prev.map((mod) => (
          mod.fileName === fileName
            ? {
                ...mod,
                isEnabled: true,
                fileName: fileName.replace('.disabled', '')
              }
            : mod
        )));
      }

      const nextEnabled = !currentEnabled;
      await Promise.all(filesToToggle.map((f) => modService.toggleMod(instanceId, f, nextEnabled)));

      if (dependentFileNames.length > 0) {
        useToastStore.getState().addToast('info', `由于禁用了 ${parentModName}，已自动禁用其相关联的 ${dependentFileNames.length} 个模组。`);
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
        setMods((prev) => {
          const dependentsSet = new Set<string>();
          for (const fileName of fileNames) {
            const parentMod = prev.find(m => m.fileName === fileName);
            if (parentMod) {
              const dependents = getDependentMods(prev, parentMod);
              dependents.forEach(d => dependentsSet.add(d.fileName));
            }
          }
          fileNames.forEach(f => dependentsSet.delete(f));
          dependentFileNames = Array.from(dependentsSet);
          filesToToggle = [...fileNames, ...dependentFileNames];
          
          return prev.map((mod) => {
            if (filesToToggle.includes(mod.fileName) && mod.isEnabled !== enable) {
              return {
                ...mod,
                isEnabled: enable,
                fileName: enable ? mod.fileName.replace('.disabled', '') : (mod.fileName.endsWith('.disabled') ? mod.fileName : `${mod.fileName}.disabled`)
              };
            }
            return mod;
          });
        });
      } else {
        setMods((prev) => prev.map((mod) => {
          if (fileNames.includes(mod.fileName) && mod.isEnabled !== enable) {
            return {
              ...mod,
              isEnabled: enable,
              fileName: enable ? mod.fileName.replace('.disabled', '') : (mod.fileName.endsWith('.disabled') ? mod.fileName : `${mod.fileName}.disabled`)
            };
          }
          return mod;
        }));
      }

      await Promise.all(filesToToggle.map((fileName) => modService.toggleMod(instanceId, fileName, enable)));

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
    action: ModVersionInstallAction = 'upgrade'
  ) => {
    const source = mod.manifestEntry?.source;
    let platform = '' as ModPlatformId | '';
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
    const projectId = version?.project_id || source?.projectId || '';
    const targetVersionId = version?.id || mod.updateFileId || '';
    const targetDownloadUrl = version?.download_url || mod.updateDownloadUrl || '';
    const remoteFileName = version?.file_name || mod.updateFileName || '';

    if (!projectId || !targetVersionId || !targetDownloadUrl || !remoteFileName) {
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

    useDownloadStore.getState().addOrUpdateTask({
      id: targetFileName,
      taskType: 'resource',
      title: targetFileName,
      stage: 'DOWNLOADING_MOD',
      current: 0,
      total: 100,
      message: `正在准备${getActionText(action)}模组...`,
      retryAction: 'download_resource',
      retryPayload: {
        url: targetDownloadUrl,
        fileName: targetFileName,
        instanceId,
        subFolder: 'mods'
      }
    });

    try {
      await modService.downloadResource(targetDownloadUrl, targetFileName, instanceId, 'mods');

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
        oldFileName !== targetFileName ? oldFileName : undefined
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
        const metadataSettings = buildLockedModMetadataSettings(
          platform,
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
                ? buildLockedModMetadataSettings(platform, mod.manifestEntry.metadataSettings)
                : mod.manifestEntry.metadataSettings
            }
          : mod.manifestEntry,
        hasUpdate: false,
        updateVersionName: undefined,
        updateFileId: undefined,
        updateFileName: undefined,
        updateDownloadUrl: undefined,
        isUpdatingMod: false
      };

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

      await loadMods({ silent: true });
    } catch (error) {
      setMods((current) => current.map((item) => (
        item.fileName === oldFileName ? { ...item, isUpdatingMod: false } : item
      )));
      useDownloadStore.getState().addOrUpdateTask({
        id: targetFileName,
        stage: 'ERROR',
        message: `下载失败: ${error}`
      });
      throw error;
    }
  }, [instanceId, loadMods, setMods]);

  const upgradeMod = useCallback(async (mod: ModMeta) => installModVersion(mod, undefined, 'upgrade'), [installModVersion]);

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
