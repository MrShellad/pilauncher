import type { OnlineServer, ServerBindableInstance, ServerBindingRecord } from './types';

const DEFAULT_SERVER_PORT = 25565;

export const parseServerAddress = (server: Pick<OnlineServer, 'address'>) => {
  const ipMatch = server.address?.match(/^([^:]+)(?::(\d+))?$/);

  return {
    ip: ipMatch ? ipMatch[1] : server.address || '',
    port: ipMatch && ipMatch[2] ? parseInt(ipMatch[2], 10) : DEFAULT_SERVER_PORT,
  };
};

export const createServerBindingRecord = (server: OnlineServer): ServerBindingRecord => {
  const { ip, port } = parseServerAddress(server);

  return {
    uuid: server.id,
    name: server.name,
    ip,
    port,
  };
};

export const matchesServerBinding = (server: OnlineServer, binding: ServerBindingRecord) => {
  const { ip, port } = parseServerAddress(server);

  return (
    binding.uuid === server.id ||
    (binding.name && binding.name === server.name) ||
    (binding.ip === ip && binding.port === port)
  );
};

export const createFallbackBoundInstance = (instanceId: string): ServerBindableInstance => ({
  id: instanceId,
  name: instanceId,
  version: '',
  loader: '',
});

export const resolveBoundInstance = (
  instanceId: string,
  instances: ServerBindableInstance[]
) => instances.find((item) => item.id === instanceId) || createFallbackBoundInstance(instanceId);

export const isModdedServer = (server: OnlineServer) =>
  server.isModded || server.serverType?.trim().toLowerCase() === 'modded';

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
