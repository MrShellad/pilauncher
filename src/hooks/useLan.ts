// src/hooks/useLan.ts
import { useState, useEffect, useCallback } from 'react';
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
  public_key_b64: string;
  trusted_at: number;
}

export interface IncomingTrustRequest {
  device_id: string;
  device_name: string;
  user_uuid: string; // ✅ 新增
  public_key: string; // ✅ 修正字段名
}

export const useLan = () => {
  const [discovered, setDiscovered] = useState<DiscoveredDevice[]>([]);
  const [trusted, setTrusted] = useState<TrustedDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  
  // ✅ 新增：接收好友请求状态
  const [incomingRequest, setIncomingRequest] = useState<IncomingTrustRequest | null>(null);

  // 监听底层事件
  useEffect(() => {
    const unlisten = listen<IncomingTrustRequest>('trust_request_received', (event) => {
      setIncomingRequest(event.payload);
    });
    return () => { unlisten.then(f => f()); };
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
    if (isScanning) return;
    setIsScanning(true);
    try {
      const list = await invoke<DiscoveredDevice[]>('scan_lan_devices');
      setDiscovered(list);
    } catch (e) {
      console.error("局域网扫描失败:", e);
    } finally {
      setIsScanning(false);
    }
  }, [isScanning]);

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

  // ✅ 新增：处理收到的好友请求
  const resolveTrustRequest = async (accept: boolean) => {
    if (!incomingRequest) return;
    try {
      await invoke('resolve_trust_request', {
        deviceId: incomingRequest.device_id,
        accept,
        deviceName: incomingRequest.device_name,
        user_uuid: incomingRequest.user_uuid, // ✅ 补充 UUID
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

  return {
    discovered,
    trusted,
    isScanning,
    isRequesting,
    incomingRequest, // 暴露给 UI 展示弹窗
    scan,
    fetchTrusted,
    sendTrustRequest,
    resolveTrustRequest // 暴露给 UI 确认拒绝
  };
};