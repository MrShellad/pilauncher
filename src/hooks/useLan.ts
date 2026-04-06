import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface DiscoveredDevice {
  device_id: string;
  device_name: string;
  ip: string;
  port: number;
}

export interface TrustedDevice {
  device_id: string;
  device_name: string;
  user_uuid: string;
  username: string;
  public_key_b64: string;
  trusted_at: number;
  trust_level: string;
}

export interface IncomingTrustRequest {
  device_id: string;
  device_name: string;
  user_uuid: string;
  username: string;
  public_key: string;
  request_kind?: string;
}

export interface OnlineDeviceCheck {
  device_id: string;
  device_name: string;
  public_key: string;
}

export interface TransferRecord {
  transferId: string;
  direction: 'incoming' | 'outgoing';
  remoteDeviceId: string;
  remoteDeviceName: string;
  remoteUsername: string;
  transferType: 'instance' | 'save' | string;
  name: string;
  size: number;
  status: string;
  errorMessage?: string | null;
  createdAt: number;
  completedAt?: number | null;
}

export interface TransferProgressEvent {
  transferId: string;
  direction: 'incoming' | 'outgoing';
  remoteDeviceId: string;
  remoteDeviceName: string;
  remoteUsername: string;
  transferType: 'instance' | 'save' | string;
  name: string;
  status: string;
  stage: string;
  current: number;
  total: number;
  message: string;
}

export interface IncomingTransferNotice {
  id: string;
  type: 'instance' | 'save' | string;
  name: string;
  from: string;
  fromDeviceId: string;
  fromUsername: string;
  tempPath: string;
}

const normalizeDeviceId = (value?: string) => (value || '').trim().toLowerCase();

const dedupeDiscoveredDevices = (list: DiscoveredDevice[]) => {
  const map = new Map<string, DiscoveredDevice>();

  for (const device of list) {
    const normalizedId = normalizeDeviceId(device.device_id);
    const key = normalizedId || `${device.ip}:${device.port}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, device);
      continue;
    }

    const existingHasId = !!normalizeDeviceId(existing.device_id);
    const incomingHasId = !!normalizedId;
    if (!existingHasId && incomingHasId) {
      map.set(key, device);
      continue;
    }

    if (!existing.device_name && device.device_name) {
      map.set(key, device);
    }
  }

  return Array.from(map.values());
};

export const useLan = () => {
  const [discovered, setDiscovered] = useState<DiscoveredDevice[]>([]);
  const [trusted, setTrusted] = useState<TrustedDevice[]>([]);
  const [friends, setFriends] = useState<TrustedDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState<IncomingTrustRequest | null>(null);
  const isScanningRef = useRef(false);

  const fetchTrusted = useCallback(async () => {
    try {
      const list = await invoke<TrustedDevice[]>('get_trusted_devices');
      setTrusted(list);
    } catch (error) {
      console.error('获取已信任设备失败:', error);
    }
  }, []);

  const fetchFriends = useCallback(async () => {
    try {
      const list = await invoke<TrustedDevice[]>('get_friend_devices');
      setFriends(list);
    } catch (error) {
      console.error('获取好友设备失败:', error);
    }
  }, []);

  const scan = useCallback(async () => {
    if (isScanningRef.current) {
      return;
    }

    isScanningRef.current = true;
    setIsScanning(true);
    try {
      const list = await invoke<DiscoveredDevice[]>('scan_lan_devices');
      setDiscovered(dedupeDiscoveredDevices(list));
    } catch (error) {
      console.error('局域网扫描失败:', error);
      setDiscovered([]);
    } finally {
      isScanningRef.current = false;
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    const unlistenTrust = listen<IncomingTrustRequest>('trust_request_received', (event) => {
      setIncomingRequest(event.payload);
    });
    const unlistenUpdate = listen('trust_list_updated', () => {
      void fetchTrusted();
      void fetchFriends();
    });

    return () => {
      void unlistenTrust.then((dispose) => dispose());
      void unlistenUpdate.then((dispose) => dispose());
    };
  }, [fetchFriends, fetchTrusted]);

  const sendTrustRequest = useCallback(
    async (ip: string, port: number, requestKind: 'friend' | 'trusted' = 'friend') => {
      if (isRequesting) {
        return;
      }

      setIsRequesting(true);
      try {
        await invoke('send_trust_request', {
          targetIp: ip,
          targetPort: port,
          requestKind,
        });
        await Promise.all([fetchTrusted(), fetchFriends()]);
      } finally {
        setIsRequesting(false);
      }
    },
    [fetchFriends, fetchTrusted, isRequesting],
  );

  const resolveTrustRequest = useCallback(
    async (accept: boolean) => {
      if (!incomingRequest) {
        return;
      }

      try {
        await invoke('resolve_trust_request', {
          deviceId: incomingRequest.device_id,
          accept,
          deviceName: incomingRequest.device_name,
          userUuid: incomingRequest.user_uuid,
          username: incomingRequest.username || '',
          publicKey: incomingRequest.public_key,
          requestKind: incomingRequest.request_kind || 'friend',
        });
        if (accept) {
          await Promise.all([fetchTrusted(), fetchFriends()]);
        }
      } catch (error) {
        console.error('处理好友请求失败:', error);
      } finally {
        setIncomingRequest(null);
      }
    },
    [fetchFriends, fetchTrusted, incomingRequest],
  );

  const trustDevice = useCallback(
    async (device: TrustedDevice) => {
      await invoke('trust_device', {
        deviceId: device.device_id,
        deviceName: device.device_name,
        userUuid: device.user_uuid,
        username: device.username || '',
        publicKeyB64: device.public_key_b64,
      });
      await Promise.all([fetchTrusted(), fetchFriends()]);
    },
    [fetchFriends, fetchTrusted],
  );

  const removeTrustedDevice = useCallback(
    async (deviceId: string) => {
      await invoke('remove_trusted_device', { deviceId });
      await Promise.all([fetchTrusted(), fetchFriends()]);
    },
    [fetchFriends, fetchTrusted],
  );

  const verifyTrustedDevices = useCallback(
    async (onlineDevices: OnlineDeviceCheck[]) => {
      try {
        const downgraded = await invoke<string[]>('verify_trusted_devices', { onlineDevices });
        if (downgraded.length > 0) {
          await Promise.all([fetchTrusted(), fetchFriends()]);
        }
      } catch (error) {
        console.error('验证信任设备失败:', error);
      }
    },
    [fetchFriends, fetchTrusted],
  );

  return {
    discovered,
    trusted,
    friends,
    isScanning,
    isRequesting,
    incomingRequest,
    scan,
    fetchTrusted,
    fetchFriends,
    sendTrustRequest,
    resolveTrustRequest,
    trustDevice,
    removeTrustedDevice,
    verifyTrustedDevices,
  };
};
