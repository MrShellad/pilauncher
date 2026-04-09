import { invoke } from '@tauri-apps/api/core';
import type { ServerBindableInstance, ServerBindingRecord } from '../types';

interface DownloadAndImportModpackInput {
  url: string;
  instanceName: string;
  serverBinding: ServerBindingRecord;
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

  downloadAndImportModpack: ({ url, instanceName, serverBinding }: DownloadAndImportModpackInput) =>
    invoke('download_and_import_modpack', {
      url,
      instanceName,
      serverBinding,
    }),
};
