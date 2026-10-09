import type {
  ServerBindingEditState,
  ServerBindingInfo,
} from '../schemas/basicPanelSchemas';

export const createEmptyServerBindingEditState = (): ServerBindingEditState => ({
  name: '',
  ip: '',
  port: '25565',
});

export const createServerBindingEditState = (
  binding?: ServerBindingInfo | null,
): ServerBindingEditState => ({
  name: binding?.name || '',
  ip: binding?.ip || '',
  port: String(binding?.port || 25565),
});

export const sanitizeServerPortInput = (value: string) => value.replace(/[^0-9]/g, '');

export const parseServerPort = (value: string) => parseInt(value, 10) || 25565;

export const getServerPreviewName = ({ name, ip }: ServerBindingEditState) =>
  name.trim() || ip.trim() || '未命名服务器';

export const formatServerAddress = (ip: string, port: number | string) => {
  const normalizedPort = typeof port === 'string' ? parseServerPort(port) : port;
  return `${ip || '...'}${normalizedPort !== 25565 ? `:${normalizedPort}` : ''}`;
};

export const canSaveServerBinding = (state: ServerBindingEditState) => state.ip.trim() !== '';

export const createServerBindingUpdate = (
  state: ServerBindingEditState,
  currentBinding?: ServerBindingInfo | null,
): ServerBindingInfo => ({
  uuid: currentBinding?.uuid || '',
  name: state.name.trim() || state.ip.trim(),
  ip: state.ip.trim(),
  port: parseServerPort(state.port),
});
