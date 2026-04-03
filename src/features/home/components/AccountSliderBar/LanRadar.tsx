import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Users } from 'lucide-react';

import { useAccountStore } from '../../../../store/useAccountStore';
import { useSettingsStore } from '../../../../store/useSettingsStore';
import { LanDeviceItem } from './LanDeviceItem';
import type { DeviceInitInfo } from './LanDeviceItem';

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

const normalizeDeviceId = (value?: string) => (value || '').trim().toLowerCase();
const getDeviceKey = (device: DiscoveredDevice) =>
  normalizeDeviceId(device.device_id) || `${device.ip}:${device.port}`;

export const LanRadar: React.FC<LanRadarProps> = ({
  discovered,
  trusted,
  isScanning,
  isRequesting,
  onRequestTrust,
}) => {
  const [expandedDeviceKey, setExpandedDeviceKey] = useState<string | null>(null);
  const [richInfos, setRichInfos] = useState<Record<string, DeviceInitInfo>>({});

  const { settings } = useSettingsStore();
  const { accounts } = useAccountStore();

  const selfDeviceId = normalizeDeviceId(settings.general.deviceId);
  const trustedDeviceIds = useMemo(
    () => new Set(trusted.map((item) => normalizeDeviceId(item.device_id))),
    [trusted],
  );

  const validDevices = useMemo(
    () => discovered.filter((device) => normalizeDeviceId(device.device_id) !== selfDeviceId),
    [discovered, selfDeviceId],
  );

  const untrustedDevices = useMemo(
    () =>
      validDevices.filter(
        (device) => !trustedDeviceIds.has(normalizeDeviceId(device.device_id)),
      ),
    [trustedDeviceIds, validDevices],
  );

  useEffect(() => {
    if (validDevices.length === 0) {
      setRichInfos({});
      return;
    }

    let cancelled = false;
    const onlineKeys = new Set(validDevices.map(getDeviceKey));

    // Remove stale profile cache for offline devices.
    setRichInfos((previous) => {
      const next = { ...previous };
      let changed = false;
      Object.keys(next).forEach((key) => {
        if (!onlineKeys.has(key)) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : previous;
    });

    const fetchRichInfo = async () => {
      await Promise.all(
        validDevices.map(async (device) => {
          const key = getDeviceKey(device);
          try {
            const response = await fetch(`http://${device.ip}:${device.port}/device/init`, {
              cache: 'no-store',
            });
            if (!response.ok) throw new Error('HTTP status error');

            const data = (await response.json()) as DeviceInitInfo;
            if (cancelled) return;

            setRichInfos((previous) => {
              const previousData = previous[key];
              if (
                previousData &&
                previousData.user_uuid === data.user_uuid &&
                previousData.username === data.username &&
                previousData.instance_id === data.instance_id &&
                previousData.instance_name === data.instance_name &&
                previousData.device_name === data.device_name
              ) {
                return previous;
              }
              return { ...previous, [key]: data };
            });
          } catch {
            if (cancelled) return;
            setRichInfos((previous) => {
              if (!previous[key]) return previous;
              const next = { ...previous };
              delete next[key];
              return next;
            });
          }
        }),
      );
    };

    void fetchRichInfo();
    const timer = window.setInterval(() => {
      void fetchRichInfo();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [validDevices]);

  const sortedDevices = [...untrustedDevices].sort((a, b) => {
    const aRich = richInfos[getDeviceKey(a)];
    const bRich = richInfos[getDeviceKey(b)];
    const aIsOwn = aRich ? accounts.some((acc) => acc.uuid === aRich.user_uuid) : false;
    const bIsOwn = bRich ? accounts.some((acc) => acc.uuid === bRich.user_uuid) : false;

    if (aIsOwn && !bIsOwn) return -1;
    if (!aIsOwn && bIsOwn) return 1;
    return 0;
  });

  useEffect(() => {
    if (!expandedDeviceKey) return;
    const exists = validDevices.some((device) => getDeviceKey(device) === expandedDeviceKey);
    if (!exists) {
      setExpandedDeviceKey(null);
    }
  }, [expandedDeviceKey, validDevices]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between pl-1 text-xs font-bold uppercase tracking-wider text-gray-400">
        <div className="flex items-center">
          <Users size={14} className="mr-2" />
          局域网雷达 ({untrustedDevices.length})
        </div>
        {isScanning && (
          <div className="flex items-center gap-1.5 font-normal normal-case text-ore-green">
            <Loader2 size={12} className="animate-spin" />
            <span className="text-[10px]">正在扫描...</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {untrustedDevices.length === 0 && !isScanning && (
          <div className="border-2 border-dashed border-[#313233] p-4 text-center text-sm text-gray-500">
            局域网内空空如也。
          </div>
        )}

        {untrustedDevices.length === 0 && isScanning && (
          <div className="flex items-center justify-center gap-2 border-2 border-dashed border-[#313233] p-4 text-center text-sm text-gray-500">
            <Loader2 size={14} className="animate-spin text-ore-green" />
            正在扫描局域网中的设备...
          </div>
        )}

        {sortedDevices.map((device) => {
          const key = getDeviceKey(device);
          const richInfo = richInfos[key];
          const isOwnAccount = richInfo
            ? accounts.some((acc) => acc.uuid === richInfo.user_uuid)
            : false;

          return (
            <LanDeviceItem
              key={key}
              device={device}
              richInfo={richInfo}
              isFriend={false}
              isOwnAccount={isOwnAccount}
              isRequesting={isRequesting}
              isExpanded={expandedDeviceKey === key}
              onToggleExpand={() =>
                setExpandedDeviceKey((previous) => (previous === key ? null : key))
              }
              onRequestTrust={onRequestTrust}
            />
          );
        })}
      </div>
    </div>
  );
};
