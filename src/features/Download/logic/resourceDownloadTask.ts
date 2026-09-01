import { invoke } from '@tauri-apps/api/core';

import { useDownloadStore } from '../../../store/useDownloadStore';
import {
  getResourceTaskId,
  isActiveDownloadStatus,
  type DownloadRetryPayload
} from './downloadTask';

export { controlResourceDownload, getResourceTaskId } from './downloadTask';

export interface ResourceDownloadTaskConfig {
  url: string;
  fileName: string;
  instanceId: string;
  subFolder: string;
  taskId?: string;
  title?: string;
  message?: string;
  /** Known provider identity for a resource-centre Mod download. */
  modSource?: {
    sourceKind: string;
    platform: 'modrinth' | 'curseforge';
    projectId: string;
    fileId: string;
    version?: string;
    oldFileName?: string;
  };
  onCompleted?: () => Promise<void> | void;
}

const getTaskId = (config: ResourceDownloadTaskConfig) =>
  config.taskId || getResourceTaskId(config.instanceId, config.subFolder, config.fileName);

export const runResourceDownloadTask = async (
  config: ResourceDownloadTaskConfig,
  options: { isRetry?: boolean } = {},
): Promise<void> => {
  const taskId = getTaskId(config);
  const store = useDownloadStore.getState();
  const existingTask = store.tasks[taskId];

  if (!options.isRetry && existingTask && isActiveDownloadStatus(existingTask.status)) {
    return;
  }

  const retryTask = () => runResourceDownloadTask(config, { isRetry: true });
  store.addOrUpdateTask({
    id: taskId,
    taskType: 'resource',
    title: config.title || config.fileName,
    stage: 'DOWNLOADING_MOD',
    current: options.isRetry ? existingTask?.current || 0 : 0,
    total: options.isRetry ? existingTask?.total || 100 : 100,
    message: options.isRetry ? '正在准备重试...' : (config.message || '正在建立连接...'),
    retryAction: 'download_resource',
    retryPayload: {
      url: config.url,
      fileName: config.fileName,
      instanceId: config.instanceId,
      subFolder: config.subFolder,
      taskId,
    } satisfies DownloadRetryPayload,
    retryTask,
  });

  try {
    await invoke('download_resource', {
      url: config.url,
      fileName: config.fileName,
      instanceId: config.instanceId,
      subFolder: config.subFolder,
      taskId,
      modSource: config.modSource,
    });

    await config.onCompleted?.();

    useDownloadStore.getState().addOrUpdateTask({
      id: taskId,
      taskType: 'resource',
      title: config.title || config.fileName,
      stage: 'DONE',
      current: 1,
      total: 1,
      message: `下载完成: ${config.fileName}`,
      retryTask,
    });
  } catch (error) {
    useDownloadStore.getState().addOrUpdateTask({
      id: taskId,
      taskType: 'resource',
      title: config.title || config.fileName,
      stage: 'ERROR',
      message: `下载失败: ${String(error)}`,
      retryAction: 'download_resource',
      retryPayload: {
        url: config.url,
        fileName: config.fileName,
        instanceId: config.instanceId,
        subFolder: config.subFolder,
        taskId,
      },
      retryTask,
    });
    throw error;
  }
};
