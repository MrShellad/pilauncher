// src/features/home/components/AccountSliderBar/LanRadar.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Users, Loader2 } from 'lucide-react';

import { LanDeviceItem } from './LanDeviceItem';
import type { DeviceInitInfo } from './LanDeviceItem';

import { useSettingsStore } from '../../../../store/useSettingsStore';
import { useAccountStore } from '../../../../store/useAccountStore';

interface DiscoveredDevice {
  device_id: string;
  device_name: string;
  ip: string;
  port: number;
}

interface TrustedDevice {
  device_id: string;
}

interface LanRadarProps {
  discovered: DiscoveredDevice[];
  trusted: TrustedDevice[];
  isScanning: boolean;
  isRequesting: boolean;
  onRequestTrust: (ip: string, port: number) => void;
}

export const LanRadar: React.FC<LanRadarProps> = ({ discovered, trusted, isScanning, isRequesting, onRequestTrust }) => {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [richInfos, setRichInfos] = useState<Record<string, DeviceInitInfo>>({});
  const fetchedRef = useRef<Set<string>>(new Set());
  
  const { settings } = useSettingsStore();
  const { accounts } = useAccountStore();
  
  // 过滤掉自己的设备
  const validDevices = discovered.filter(dev => dev.device_id !== settings.general.deviceId);
  
  // ✅ 过滤掉已信任的设备（已信任设备只在信任设备列表中展示）
  const untrustedDevices = validDevices.filter(dev => !trusted.some(t => t.device_id === dev.device_id));

  useEffect(() => {
    validDevices.forEach(dev => {
      if (!fetchedRef.current.has(dev.device_id)) {
        fetchedRef.current.add(dev.device_id);
        fetch(`http://${dev.ip}:${dev.port}/device/init`)
          .then(res => {
            if(!res.ok) throw new Error("HTTP Status Error");
            return res.json();
          })
          .then((data: DeviceInitInfo) => {
            setRichInfos(prev => ({ ...prev, [dev.device_id]: data }));
          })
          .catch(() => {
            fetchedRef.current.delete(dev.device_id);
          });
      }
    });
  }, [validDevices]);

  const sortedDevices = [...untrustedDevices].sort((a, b) => {
    const aRich = richInfos[a.device_id];
    const bRich = richInfos[b.device_id];
    const aIsOwn = aRich ? accounts.some(acc => acc.uuid === aRich.user_uuid) : false;
    const bIsOwn = bRich ? accounts.some(acc => acc.uuid === bRich.user_uuid) : false;

    if (aIsOwn && !bIsOwn) return -1;
    if (!aIsOwn && bIsOwn) return 1;

    return 0;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">
        <div className="flex items-center">
          <Users size={14} className="mr-2"/> 局域网雷达 ({untrustedDevices.length})
        </div>
        {isScanning && (
          <div className="flex items-center gap-1.5 text-ore-green normal-case font-normal">
            <Loader2 size={12} className="animate-spin" />
            <span className="text-[10px]">正在扫描...</span>
          </div>
        )}
      </div>
      
      <div className="flex flex-col gap-2">
        {untrustedDevices.length === 0 && !isScanning && (
          <div className="text-sm text-gray-500 border-2 border-dashed border-[#313233] p-4 text-center">
            局域网内空空如也。
          </div>
        )}

        {untrustedDevices.length === 0 && isScanning && (
          <div className="text-sm text-gray-500 border-2 border-dashed border-[#313233] p-4 text-center flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin text-ore-green" />
            正在扫描局域网中的设备...
          </div>
        )}
        
        {sortedDevices.map(dev => {
          const richInfo = richInfos[dev.device_id];
          const isOwnAccount = richInfo ? accounts.some(acc => acc.uuid === richInfo.user_uuid) : false;

          return (
            <LanDeviceItem
              key={dev.device_id}
              device={dev}
              richInfo={richInfo}
              isFriend={false}
              isOwnAccount={isOwnAccount}
              isRequesting={isRequesting}
              isExpanded={expandedPlayerId === dev.device_id}
              onToggleExpand={() => setExpandedPlayerId(prev => prev === dev.device_id ? null : dev.device_id)}
              onRequestTrust={onRequestTrust}
            />
          );
        })}
      </div>
    </div>
  );
};