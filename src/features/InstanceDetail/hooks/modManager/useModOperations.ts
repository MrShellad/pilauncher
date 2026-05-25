import { useCallback, type Dispatch, type SetStateAction } from 'react';

import { useDownloadStore } from '../../../../store/useDownloadStore';
import { modService, type ModMeta, type ModVersionInstallAction } from '../../logic/modService';
import type { OreProjectVersion } from '../../logic/modrinthApi';

interface UseModOperationsOptions {
  instanceId: string;
  setMods: Dispatch<SetStateAction<ModMeta[]>>;
  loadMods: () => Promise<void>;
}

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
      setMods((prev) => prev.map((mod) => (
        mod.fileName === fileName
          ? {
              ...mod,
              isEnabled: !currentEnabled,
              fileName: currentEnabled ? `${fileName}.disabled` : fileName.replace('.disabled', '')
            }
          : mod
      )));
      await modService.toggleMod(instanceId, fileName, !currentEnabled);
    } catch (error) {
      console.error(error);
      void loadMods();
    }
  }, [instanceId, loadMods, setMods]);

  const toggleMods = useCallback(async (fileNames: string[], enable: boolean) => {
    try {
      setMods((prev) => prev.map((mod) => {
        if (fileNames.includes(mod.fileName) && mod.isEnabled !== enable) {
          return {
            ...mod,
            isEnabled: enable,
            fileName: enable ? mod.fileName.replace('.disabled', '') : `${mod.fileName}.disabled`
          };
        }
        return mod;
      }));
      await Promise.all(fileNames.map((fileName) => modService.toggleMod(instanceId, fileName, enable)));
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
    const platform = source?.platform || '';
    const projectId = source?.projectId || '';
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
      await modService.updateModManifest(
        instanceId,
        targetFileName,
        'launcherDownload',
        platform,
        projectId,
        targetVersionId
      );

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
              }
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

      await loadMods();
    } catch (error) {
      setMods((current) => current.map((item) => (
        item.fileName === oldFileName ? { ...item, isUpdatingMod: false } : item
      )));
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
