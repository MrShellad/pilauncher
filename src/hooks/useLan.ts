// src/hooks/useLan.ts
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

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

export const useLan = () => {
  const [discovered, setDiscovered] = useState<DiscoveredDevice[]>([]);
  const [trusted, setTrusted] = useState<TrustedDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  // 获取已信任设备列表
  const fetchTrusted = useCallback(async () => {
    try {
      const list = await invoke<TrustedDevice[]>('get_trusted_devices');
      setTrusted(list);
    } catch (e) {
      console.error("获取信任设备失败:", e);
    }
  }, []);

  // 扫描局域网设备 (3秒阻塞)
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

  // 发送握手请求
  const sendTrustRequest = async (ip: string, port: number) => {
    if (isRequesting) return;
    setIsRequesting(true);
    try {
      await invoke('send_trust_request', { targetIp: ip, targetPort: port });
      alert("🎉 握手成功！双方已建立可信连接。");
      await fetchTrusted(); // 刷新信任列表
    } catch (e) {
      alert(`握手失败: ${e}`);
    } finally {
      setIsRequesting(false);
    }
  };

  useEffect(() => {
    fetchTrusted();
  }, [fetchTrusted]);

  return { 
    discovered, 
    trusted, 
    isScanning, 
    isRequesting,
    scan, 
    sendTrustRequest, 
    fetchTrusted 
  };
};