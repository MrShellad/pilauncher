import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';

import type { DownloadSource, TabType as DownloadTabType } from '../../Download/hooks/useResourceDownload';
import { modService } from '../../InstanceDetail/logic/modService';
import type { ModrinthProject, OreProjectVersion } from '../../InstanceDetail/logic/modrinthApi';
import { useDownloadStore } from '../../../store/useDownloadStore';
import type { LibraryResourceViewModel } from '../logic/libraryItems';
import { getLibraryDownloadSubFolder, toDetailProject, toDownloadTabType } from '../logic/libraryPageUtils';

export const useLibraryResourceDetail = () => {
  const { t } = useTranslation();
  const [detailProject, setDetailProject] = useState<ModrinthProject | null>(null);
  const [detailSource, setDetailSource] = useState<DownloadSource>('modrinth');
  const [detailTab, setDetailTab] = useState<DownloadTabType>('mod');

  const openResourceDetail = (item: LibraryResourceViewModel) => {
    const project = toDetailProject(item);
    if (!project?.source) return;

    setDetailProject(project);
    setDetailSource(project.source as DownloadSource);
    setDetailTab(toDownloadTabType(item.type));
  };

  const closeResourceDetail = () => {
    setDetailProject(null);
  };

  const handleLibraryDetailDownload = async (
    version: OreProjectVersion,
    targetInstanceId: string,
  ) => {
    const subFolder = getLibraryDownloadSubFolder(detailTab);

    useDownloadStore.getState().addOrUpdateTask({
      id: version.file_name,
      taskType: 'resource',
      title: version.file_name,
      stage: 'DOWNLOADING_MOD',
      current: 0,
      total: 100,
      message: t('libraryPage.messages.connectingDownload'),
      retryAction: 'download_resource',
      retryPayload: {
        url: version.download_url,
        fileName: version.file_name,
        instanceId: targetInstanceId,
        subFolder,
      },
    });

    try {
      await invoke('download_resource', {
        url: version.download_url,
        fileName: version.file_name,
        instanceId: targetInstanceId,
        subFolder,
      });

      if (detailTab === 'mod') {
        const projectId = version.project_id || detailProject?.id || detailProject?.project_id || '';
        if (projectId) {
          await modService.updateModManifest(
            targetInstanceId,
            version.file_name,
            'launcherDownload',
            detailSource === 'curseforge' ? 'curseforge' : 'modrinth',
            projectId,
            version.id,
          );
        }
        modService.invalidateModManifestCache(targetInstanceId);
      }

      useDownloadStore.getState().setPopupOpen(true);
    } catch (error) {
      useDownloadStore.getState().addOrUpdateTask({
        id: version.file_name,
        taskType: 'resource',
        title: version.file_name,
        stage: 'ERROR',
        current: 0,
        total: 100,
        message: t('libraryPage.messages.downloadFailed', { error: String(error) }),
      });
    }
  };

  return {
    detailProject,
    detailSource,
    detailTab,
    openResourceDetail,
    closeResourceDetail,
    handleLibraryDetailDownload,
  };
};
