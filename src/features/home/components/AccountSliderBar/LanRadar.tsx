// src/features/home/components/AccountSliderBar/LanRadar.tsx
import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { LanDeviceItem } from './LanDeviceItem';

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">
        <Users size={14} className="mr-2"/> 雷达发现的设备 ({discovered.length})
      </div>
      
      <div className="flex flex-col gap-2">
        {discovered.length === 0 && !isScanning && (
          <div className="text-sm text-gray-500 border-2 border-dashed border-[#313233] p-4 text-center">
            局域网内空空如也。
          </div>
        )}
        
        {discovered.map(dev => {
          const isFriend = trusted.some(t => t.device_id === dev.device_id);
          return (
            <LanDeviceItem
              key={dev.device_id}
              device={dev}
              isFriend={isFriend}
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