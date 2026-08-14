import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';

import type { DownloadSource, TabType as DownloadTabType } from '../../Download/hooks/useResourceDownload';
import { modService } from '../../InstanceDetail/logic/modService';
import type { ModrinthProject, OreProjectVersion } from '../../InstanceDetail/logic/modrinthApi';
import { useDownloadStore } from '../../../store/useDownloadStore';
import { runResourceDownloadTask } from '../../Download/logic/resourceDownloadTask';
import type { LibraryResourceViewModel } from '../logic/libraryItems';
import { getLibraryDownloadSubFolder, toDetailProject, toDownloadTabType } from '../logic/libraryPageUtils';
import { useLibraryStore } from '../../../stores/useLibraryStore';

export const useLibraryResourceDetail = () => {
  const { t } = useTranslation();
  const [detailProject, setDetailProject] = useState<ModrinthProject | null>(null);
  const [detailSource, setDetailSource] = useState<DownloadSource>('modrinth');
  const [detailTab, setDetailTab] = useState<DownloadTabType>('mod');
  const [directInstallInstanceIds, setDirectInstallInstanceIds] = useState<string[] | undefined>(undefined);
  const [searchMcVersion, setSearchMcVersion] = useState<string | undefined>(undefined);
  const [searchLoader, setSearchLoader] = useState<string | undefined>(undefined);

  const openResourceDetail = (item: LibraryResourceViewModel) => {
    const project = toDetailProject(item);
    if (!project?.source) return;

    setDetailProject(project);
    setDetailSource(project.source as DownloadSource);
    setDetailTab(toDownloadTabType(item.type));
    setDirectInstallInstanceIds(undefined);
    setSearchMcVersion(undefined);
    setSearchLoader(undefined);
  };

  const openResourceDetailWithInstance = (
    item: LibraryResourceViewModel,
    instance: { id: string; version: string; loader: string }
  ) => {
    const project = toDetailProject(item);
    if (!project?.source) return;

    setDetailProject(project);
    setDetailSource(project.source as DownloadSource);
    setDetailTab(toDownloadTabType(item.type));
    setDirectInstallInstanceIds([instance.id]);
    setSearchMcVersion(instance.version);
    setSearchLoader(instance.loader);
  };

  const openResourceDetailWithInstances = (
    item: LibraryResourceViewModel,
    instanceIds: string[]
  ) => {
    const project = toDetailProject(item);
    if (!project?.source) return;

    setDetailProject(project);
    setDetailSource(project.source as DownloadSource);
    setDetailTab(toDownloadTabType(item.type));
    setDirectInstallInstanceIds(instanceIds);
    setSearchMcVersion(undefined);
    setSearchLoader(undefined);
  };

  const closeResourceDetail = () => {
    setDetailProject(null);
    setDirectInstallInstanceIds(undefined);
    setSearchMcVersion(undefined);
    setSearchLoader(undefined);
  };

  const handleLibraryDetailDownload = async (
    version: OreProjectVersion,
    targetInstanceIds: string | string[],
  ) => {
    const instanceIds = Array.isArray(targetInstanceIds) ? targetInstanceIds : [targetInstanceIds];
    const isGlobalResource = detailTab === 'shader' || detailTab === 'resourcepack';

    const targetIdForDownload = isGlobalResource ? '__library__' : instanceIds[0];
    const subFolder = isGlobalResource
      ? (detailTab === 'shader' ? 'shaders' : 'resourcepacks')
      : getLibraryDownloadSubFolder(detailTab);

    try {
      await runResourceDownloadTask({
        url: version.download_url,
        fileName: version.file_name,
        instanceId: targetIdForDownload,
        subFolder,
        title: version.file_name,
        message: t('libraryPage.messages.connectingDownload'),
        onCompleted: async () => {
          if (detailTab === 'mod') {
            const projectId = version.project_id || detailProject?.id || detailProject?.project_id || '';
            if (projectId) {
              await modService.updateModManifest(
                targetIdForDownload,
                version.file_name,
                'launcherDownload',
                detailSource === 'curseforge' ? 'curseforge' : 'modrinth',
                projectId,
                version.id,
              );
            }
            modService.invalidateModManifestCache(targetIdForDownload);
          }

          if (isGlobalResource && detailProject) {
            const starredItems = useLibraryStore.getState().items;
            const originalItem = starredItems.find(i => i.projectId === detailProject.id || i.id === detailProject.id);
            if (originalItem) {
              const now = Math.floor(Date.now() / 1000);
              const snapshot = originalItem.snapshot ? JSON.parse(originalItem.snapshot) : {};
              const state = originalItem.state ? JSON.parse(originalItem.state) : {};

              const updatedItem = {
                ...originalItem,
                snapshot: JSON.stringify({
                  ...snapshot,
                  version: version.version_number,
                  fileName: version.file_name,
                }),
                state: JSON.stringify({
                  ...state,
                  installedVersion: version.version_number,
                  hasUpdate: false,
                }),
                updatedAt: now,
              };

              await useLibraryStore.getState().addStarredItem(updatedItem);
              await invoke('link_library_resource_to_instances', {
                resourceId: originalItem.id,
                instanceIds,
              });
              await useLibraryStore.getState().initializeLibrary();
            }
          }

          useDownloadStore.getState().setPopupOpen(true);
        }
      });
    } catch (error) {
      console.error('Library resource download failed:', error);
    }
  };

  return {
    detailProject,
    detailSource,
    detailTab,
    directInstallInstanceIds,
    searchMcVersion,
    searchLoader,
    openResourceDetail,
    openResourceDetailWithInstance,
    openResourceDetailWithInstances,
    closeResourceDetail,
    handleLibraryDetailDownload,
  };
};
