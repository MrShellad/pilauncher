// src/hooks/useLan.ts
import { useState, useEffect, useCallback, useRef } from 'react';
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
  public_key_b64: string;
  trusted_at: number;
}

export interface IncomingTrustRequest {
  device_id: string;
  device_name: string;
  user_uuid: string;
  username: string;
  public_key: string;
}

export interface OnlineDeviceCheck {
  device_id: string;
  device_name: string;
  public_key: string;
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
  const [isScanning, setIsScanning] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const isScanningRef = useRef(false);
  
  // 接收好友请求状态
  const [incomingRequest, setIncomingRequest] = useState<IncomingTrustRequest | null>(null);

  // 监听底层事件
  useEffect(() => {
    const unlistenTrust = listen<IncomingTrustRequest>('trust_request_received', (event) => {
      setIncomingRequest(event.payload);
    });
    const unlistenUpdate = listen('trust_list_updated', () => {
      fetchTrusted();
    });
    return () => {
      unlistenTrust.then(f => f());
      unlistenUpdate.then(f => f());
    };
  }, []);

  const fetchTrusted = useCallback(async () => {
    try {
      const list = await invoke<TrustedDevice[]>('get_trusted_devices');
      setTrusted(list);
    } catch (e) {
      console.error("获取信任设备失败:", e);
    }
  }, []);

  const scan = useCallback(async () => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setIsScanning(true);
    try {
      const list = await invoke<DiscoveredDevice[]>('scan_lan_devices');
      setDiscovered(dedupeDiscoveredDevices(list));
    } catch (e) {
      console.error("局域网扫描失败:", e);
      setDiscovered([]);
    } finally {
      isScanningRef.current = false;
      setIsScanning(false);
    }
  }, []);

  const sendTrustRequest = async (ip: string, port: number) => {
    if (isRequesting) return;
    setIsRequesting(true);
    try {
      await invoke('send_trust_request', { targetIp: ip, targetPort: port });
      alert("🎉 对方同意了您的请求！已添加为好友。");
      fetchTrusted(); // 握手成功，刷新列表
    } catch (e) {
      alert(`${e}`);
    } finally {
      setIsRequesting(false);
    }
  };

  // 处理收到的好友请求
  const resolveTrustRequest = async (accept: boolean) => {
    if (!incomingRequest) return;
    try {
      await invoke('resolve_trust_request', {
        deviceId: incomingRequest.device_id,
        accept,
        deviceName: incomingRequest.device_name,
        userUuid: incomingRequest.user_uuid,
        username: incomingRequest.username || '',
        publicKey: incomingRequest.public_key
      });
      if (accept) {
        fetchTrusted(); // 我同意了，刷新我的列表
      }
    } catch (e) {
      console.error("处理请求失败:", e);
    } finally {
      setIncomingRequest(null);
    }
  };

  // 删除信任设备
  const removeTrustedDevice = async (deviceId: string) => {
    try {
      await invoke('remove_trusted_device', { deviceId });
      fetchTrusted();
    } catch (e) {
      console.error("删除信任设备失败:", e);
    }
  };

  // 验证在线设备的信任状态（设备名或密钥不匹配则自动移除）
  const verifyTrustedDevices = async (onlineDevices: OnlineDeviceCheck[]) => {
    try {
      const removed = await invoke<string[]>('verify_trusted_devices', { onlineDevices });
      if (removed.length > 0) {
        console.warn("以下信任设备因信息不匹配已自动移除:", removed);
        fetchTrusted();
      }
    } catch (e) {
      console.error("验证信任设备失败:", e);
    }
  };

  return {
    discovered,
    trusted,
    isScanning,
    isRequesting,
    incomingRequest,
    scan,
    fetchTrusted,
    sendTrustRequest,
    resolveTrustRequest,
    removeTrustedDevice,
    verifyTrustedDevices,
  };
};
