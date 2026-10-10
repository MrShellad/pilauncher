import React from 'react';
import {
  Gamepad2,
  Laptop,
  Loader2,
  Monitor,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';

import type { DiscoveredDevice, TrustedDevice } from '../../../../hooks/useLan';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { normalizeDeviceId } from './lanTransferPresentation';

interface TrustedDevicesListProps {
  trusted: TrustedDevice[];
  onlineDeviceMap: Map<string, DiscoveredDevice>;
  isScanning: boolean;
  focusedDeviceId: string | null;
  onScan: () => void | Promise<void>;
  onSelect: (device: DiscoveredDevice | null) => void | Promise<void>;
  onFocusedDeviceChange: React.Dispatch<React.SetStateAction<string | null>>;
  onRemove: (deviceId: string) => void;
}

const renderDeviceIcon = (deviceName: string) => {
  const lower = deviceName.toLowerCase();
  if (lower.includes('windows') || lower.includes('mac')) {
    return <Laptop size={16} className="text-gray-400" />;
  }
  if (lower.includes('steamdeck') || lower.includes('rog')) {
    return <Gamepad2 size={16} className="text-gray-400" />;
  }
  if (lower.includes('tv') || lower.includes('box')) {
    return <Monitor size={16} className="text-gray-400" />;
  }
  return <Smartphone size={16} className="text-gray-400" />;
};

export const TrustedDevicesList: React.FC<TrustedDevicesListProps> = ({
  trusted,
  onlineDeviceMap,
  isScanning,
  focusedDeviceId,
  onScan,
  onSelect,
  onFocusedDeviceChange,
  onRemove,
}) => (
  <div className="flex flex-col gap-2">
    <div className="ore-ms-radar-header flex items-center justify-between text-[10px] font-bold uppercase tracking-wider font-minecraft ore-ms-list-item-text">
      <div className="flex items-center">
        <ShieldCheck size={13} className="mr-2 text-gray-300" />
        <span>已信任设备 ({trusted.length})</span>
      </div>
      <button
        type="button"
        onClick={onScan}
        disabled={isScanning}
        className="inline-flex items-center gap-1.5 rounded-none border border-white/10 px-2 py-1 text-[10px] text-gray-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 font-minecraft"
        title="刷新在线状态"
      >
        {isScanning ? <Loader2 size={10} className="animate-spin" /> : <RefreshCcw size={10} />}
        刷新
      </button>
    </div>

    {trusted.length === 0 && (
      <div className="ore-ms-radar-empty rounded-none p-4 text-center text-xs leading-relaxed font-minecraft text-gray-400">
        暂无已信任设备。在下方好友与设备列表中选择设备并点击“设为信任设备”进行授权。
      </div>
    )}

    {trusted.length > 0 && (
      <div className="custom-scrollbar flex max-h-[180px] flex-col gap-2 overflow-y-auto pr-0.5">
        {trusted.map((device) => {
          const onlineInfo = onlineDeviceMap.get(normalizeDeviceId(device.deviceId)) ?? null;
          const isOnline = onlineInfo !== null;

          return (
            <FocusItem
              key={device.deviceId}
              focusKey={`trusted-${device.deviceId}`}
              onEnter={() => isOnline && onSelect(onlineInfo)}
              onFocus={() => onFocusedDeviceChange(device.deviceId)}
            >
              {({ ref, focused }) => {
                if (!focused && focusedDeviceId === device.deviceId) {
                  setTimeout(() => {
                    onFocusedDeviceChange((previous) =>
                      previous === device.deviceId ? null : previous,
                    );
                  }, 0);
                }
                return (
                  <div
                    className={`ore-ms-trusted-item flex items-center justify-between rounded-none p-2.5 text-left transition-none ${
                      isOnline ? 'is-online' : 'opacity-50'
                    } ${focused && isOnline ? 'is-focused' : ''}`}
                  >
                    <button
                      ref={ref as React.RefObject<HTMLButtonElement>}
                      onClick={() => isOnline && onSelect(onlineInfo)}
                      className={`flex flex-1 items-center gap-2.5 pr-2 outline-none border-none bg-transparent ${
                        isOnline ? 'cursor-pointer' : 'cursor-not-allowed'
                      }`}
                    >
                      {renderDeviceIcon(device.deviceName)}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-minecraft text-[14px] font-bold ore-ms-list-item-text leading-[18px] text-gray-200">
                          {device.deviceName}
                        </div>
                        {device.username && (
                          <div className="mt-0.5 truncate text-[11px] leading-[14px] text-gray-400 font-minecraft ore-ms-list-item-text">
                            {device.username}
                          </div>
                        )}
                      </div>
                    </button>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {isOnline ? (
                        <span className="flex items-center rounded-none border border-ore-green/20 bg-ore-green/10 px-1.5 py-0.5 text-[9px] text-ore-green font-minecraft ore-ms-list-item-text">
                          <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-ore-green" />
                          在线
                        </span>
                      ) : (
                        <span className="text-[9px] text-gray-500 font-minecraft ore-ms-list-item-text">离线</span>
                      )}
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemove(device.deviceId);
                        }}
                        className="rounded-none border border-transparent bg-transparent p-1 text-gray-500 transition-colors hover:bg-red-500/20 hover:text-red-400"
                        title="取消信任，保留好友"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              }}
            </FocusItem>
          );
        })}
      </div>
    )}
  </div>
);
