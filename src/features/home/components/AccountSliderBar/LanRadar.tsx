// src/features/home/components/AccountSliderBar/LanRadar.tsx
import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';

// ✅ 核心修复：分离组件导入与类型导入，并加上 type 关键字
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
  
  // 获取本机设备ID与账号列表
  const { settings } = useSettingsStore();
  const { accounts } = useAccountStore();
  const localDeviceId = settings.general.deviceId;

  // 当雷达发现新设备时，主动去拉取对方的富文本名片
  useEffect(() => {
    discovered.forEach(dev => {
      // 1. 过滤掉自己发出的广播回音
      if (dev.device_id === localDeviceId) return;
      
      // 2. 如果还没拉取过该设备的名片，发起 HTTP 请求
      if (!richInfos[dev.device_id]) {
        fetch(`http://${dev.ip}:${dev.port}/device/init`)
          .then(res => {
            if (!res.ok) throw new Error('网络请求失败');
            return res.json();
          })
          .then((info: DeviceInitInfo) => {
            setRichInfos(prev => ({ ...prev, [dev.device_id]: info }));
          })
          .catch(e => console.warn(`无法获取设备 ${dev.device_name} 的名片信息:`, e));
      }
    });
  }, [discovered, localDeviceId]);

  // 过滤出有效设备（剔除本机）
  const validDevices = discovered.filter(d => d.device_id !== localDeviceId);

  // 智能排序逻辑
  const sortedDevices = [...validDevices].sort((a, b) => {
    const infoA = richInfos[a.device_id];
    const infoB = richInfos[b.device_id];
    
    // 判断该设备的当前游玩账号，是否和本机的某个账号 UUID 一致 (即：这是我的另一台设备)
    const aIsOwn = infoA ? accounts.some(acc => acc.uuid === infoA.user_uuid) : false;
    const bIsOwn = infoB ? accounts.some(acc => acc.uuid === infoB.user_uuid) : false;

    if (aIsOwn && !bIsOwn) return -1; // 我的设备优先靠前
    if (!aIsOwn && bIsOwn) return 1;
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
              isExpanded={expandedPlayerId === dev.device_id}
              isRequesting={isRequesting}
              onToggleExpand={() => setExpandedPlayerId(expandedPlayerId === dev.device_id ? null : dev.device_id)}
              onRequestTrust={onRequestTrust}
            />
          );
        })}
      </div>
    </div>
  );
};