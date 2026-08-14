import { invoke } from '@tauri-apps/api/core';
import type { ServerBindableInstance, ServerBindingRecord } from '../types';
import { useDownloadStore } from '../../../store/useDownloadStore';

interface DownloadAndImportModpackInput {
  url: string;
  instanceName: string;
  serverBinding: ServerBindingRecord;
}

interface ModpackDeploymentAccepted {
  taskId: string;
  instanceId: string;
  instanceName: string;
}

export interface InstanceBindingState {
  serverBinding?: ServerBindingRecord;
  autoJoinServer: boolean;
}

export const serverBindingService = {
  getAllInstances: () => invoke<ServerBindableInstance[]>('get_all_instances'),

  getCompatibleInstances: (gameVersions: string[]) =>
    invoke<ServerBindableInstance[]>('get_compatible_instances', {
      gameVersions,
      loaders: [],
      ignoreLoader: true,
    }),

  getInstanceServerBinding: (instanceId: string) =>
    invoke<InstanceBindingState>('get_instance_server_binding', { id: instanceId }),

  findBoundInstanceForServer: (serverBinding: ServerBindingRecord) =>
    invoke<string | null>('find_bound_instance_for_server', { serverBinding }),

  bindServerToInstance: (instanceId: string, serverBinding: ServerBindingRecord) =>
    invoke<InstanceBindingState>('bind_server_to_instance', {
      instanceId,
      serverBinding,
    }),

  unbindServerFromInstance: (instanceId: string) =>
    invoke<InstanceBindingState>('update_instance_server_binding', {
      id: instanceId,
      serverBinding: null,
    }),

  downloadAndImportModpack: async ({ url, instanceName, serverBinding }: DownloadAndImportModpackInput) => {
    const accepted = await invoke<ModpackDeploymentAccepted>('download_and_import_modpack', {
      url,
      instanceName,
      serverBinding,
    });

    useDownloadStore.getState().addOrUpdateTask({
      id: accepted.taskId,
      taskType: 'instance',
      title: accepted.instanceName,
      stage: 'DOWNLOADING_MODPACK',
      current: 0,
      total: 100,
      message: 'Server modpack download accepted, establishing connection...',
      retryAction: 'download_and_import_modpack',
      retryPayload: { url, instanceName, serverBinding },
    });

    return accepted;
  },
};
