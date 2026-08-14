import { invoke } from '@tauri-apps/api/core';

export type DownloadTaskType = 'instance' | 'resource' | 'update';
export type DownloadTaskStatus = 'downloading' | 'paused' | 'completed' | 'error' | 'canceled';
export type DownloadTaskStage = string;
export type DownloadRetryPayload = Record<string, unknown>;

export type ResourceDownloadControl = 'pause' | 'resume' | 'cancel';

export const getResourceTaskId = (instanceId: string, subFolder: string, fileName: string) => (
  `resource:${encodeURIComponent(instanceId)}:${encodeURIComponent(subFolder)}:${encodeURIComponent(fileName)}`
);

export const controlResourceDownload = async (
  taskId: string,
  action: ResourceDownloadControl
) => {
  const command = {
    pause: 'pause_resource_download',
    resume: 'resume_resource_download',
    cancel: 'cancel_resource_download'
  }[action];

  await invoke<void>(command, { taskId });
};

export const isActiveDownloadStatus = (status: DownloadTaskStatus) => (
  status === 'downloading' || status === 'paused'
);

export const isTerminalDownloadStatus = (status: DownloadTaskStatus) => (
  status === 'completed' || status === 'error' || status === 'canceled'
);

export const deriveDownloadTaskStatus = (
  stage: string,
  existingStatus?: DownloadTaskStatus,
  requestedStatus?: DownloadTaskStatus,
): DownloadTaskStatus => {
  if (stage === 'DONE') return 'completed';
  if (stage === 'ERROR') return 'error';
  if (stage === 'CANCELED') return 'canceled';
  if (requestedStatus) return requestedStatus;
  if (stage === 'PAUSED' || existingStatus === 'paused') return 'paused';
  return 'downloading';
};
