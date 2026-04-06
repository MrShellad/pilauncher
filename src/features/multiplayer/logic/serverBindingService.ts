import { invoke } from '@tauri-apps/api/core';
import type { ServerBindableInstance, ServerBindingRecord } from '../types';

interface DownloadAndImportModpackInput {
  url: string;
  instanceName: string;
  serverBinding: ServerBindingRecord;
}

export const serverBindingService = {
  getServerBindings: () => invoke<Record<string, ServerBindingRecord>>('get_server_bindings'),

  getAllInstances: () => invoke<ServerBindableInstance[]>('get_all_instances'),

  getCompatibleInstances: (gameVersions: string[]) =>
    invoke<ServerBindableInstance[]>('get_compatible_instances', {
      gameVersions,
      loaders: [],
      ignoreLoader: true,
    }),

  bindServerToInstance: (instanceId: string, serverBinding: ServerBindingRecord) =>
    invoke('bind_server_to_instance', {
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
