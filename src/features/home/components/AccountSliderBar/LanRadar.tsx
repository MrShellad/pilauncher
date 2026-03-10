// src/features/home/components/AccountSliderBar/LanRadar.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Users } from 'lucide-react';

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
  
  const validDevices = discovered.filter(dev => dev.device_id !== settings.general.deviceId);

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
          // ✅ 修复：将未使用的 e 改为下划线 _e 或直接不传参 () =>
          .catch(() => {
            // 如果对方 HTTP 服务还没起好，移除标记以允许下次重新尝试抓取
            fetchedRef.current.delete(dev.device_id);
          });
      }
    });
  }, [validDevices]);

  const sortedDevices = [...validDevices].sort((a, b) => {
    const aIsFriend = trusted.some(t => t.device_id === a.device_id);
    const bIsFriend = trusted.some(t => t.device_id === b.device_id);
    const aRich = richInfos[a.device_id];
    const bRich = richInfos[b.device_id];
    const aIsOwn = aRich ? accounts.some(acc => acc.uuid === aRich.user_uuid) : false;
    const bIsOwn = bRich ? accounts.some(acc => acc.uuid === bRich.user_uuid) : false;

    if (aIsOwn && !bIsOwn) return -1;
    if (!aIsOwn && bIsOwn) return 1;

    if (aIsFriend && !bIsFriend) return -1;
    if (!aIsFriend && bIsFriend) return 1;

    return 0;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">
        <Users size={14} className="mr-2"/> 局域网雷达 ({validDevices.length})
      </div>
      
      <div className="flex flex-col gap-2">
        {validDevices.length === 0 && !isScanning && (
          <div className="text-sm text-gray-500 border-2 border-dashed border-[#313233] p-4 text-center">
            局域网内空空如也。
          </div>
        )}
        
        {sortedDevices.map(dev => {
          const isFriend = trusted.some(t => t.device_id === dev.device_id);
          const richInfo = richInfos[dev.device_id];
          const isOwnAccount = richInfo ? accounts.some(acc => acc.uuid === richInfo.user_uuid) : false;

          return (
            <LanDeviceItem
              key={dev.device_id}
              device={dev}
              richInfo={richInfo}
              isFriend={isFriend}
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