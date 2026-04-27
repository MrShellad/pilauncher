import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Users } from 'lucide-react';

import type { DiscoveredDevice, TrustedDevice } from '../../../../hooks/useLan';
import { useAccountStore } from '../../../../store/useAccountStore';
import { useSettingsStore } from '../../../../store/useSettingsStore';
import { LanDeviceItem, type DeviceInitInfo } from './LanDeviceItem';

interface LanRadarProps {
  discovered: DiscoveredDevice[];
  trusted: TrustedDevice[];
  friends: TrustedDevice[];
  isScanning: boolean;
  isRequesting: boolean;
  onRequestTrust: (ip: string, port: number, requestKind?: 'friend' | 'trusted') => void;
  onTrustDevice: (device: TrustedDevice) => void;
}

const normalizeDeviceId = (value?: string) => (value || '').trim().toLowerCase();
const getDeviceKey = (device: DiscoveredDevice) =>
  normalizeDeviceId(device.device_id) || `${device.ip}:${device.port}`;

export const LanRadar: React.FC<LanRadarProps> = ({
  discovered,
  trusted,
  friends,
  isScanning,
  isRequesting,
  onRequestTrust,
  onTrustDevice,
}) => {
  const [expandedDeviceKey, setExpandedDeviceKey] = useState<string | null>(null);
  const [richInfos, setRichInfos] = useState<Record<string, DeviceInitInfo>>({});

  const { settings } = useSettingsStore();
  const { accounts } = useAccountStore();

  const selfDeviceId = normalizeDeviceId(settings.general.deviceId);
  const trustedDeviceIds = useMemo(
    () => new Set(trusted.map((item) => normalizeDeviceId(item.deviceId))),
    [trusted],
  );
  const friendMap = useMemo(() => {
    const map = new Map<string, TrustedDevice>();
    friends.forEach((item) => {
      map.set(normalizeDeviceId(item.deviceId), item);
    });
    return map;
  }, [friends]);

  const validDevices = useMemo(
    () => discovered.filter((device) => normalizeDeviceId(device.device_id) !== selfDeviceId),
    [discovered, selfDeviceId],
  );

  const candidateDevices = useMemo(
    () =>
      validDevices.filter((device) => !trustedDeviceIds.has(normalizeDeviceId(device.device_id))),
    [trustedDeviceIds, validDevices],
  );

  useEffect(() => {
    if (validDevices.length === 0) {
      setRichInfos({});
      return;
    }

    let cancelled = false;
    const onlineKeys = new Set(validDevices.map(getDeviceKey));

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
            if (!response.ok) {
              throw new Error('HTTP status error');
            }

            const data = (await response.json()) as DeviceInitInfo;
            if (cancelled) {
              return;
            }

            setRichInfos((previous) => {
              const previousData = previous[key];
              if (
                previousData &&
                previousData.userUuid === data.userUuid &&
                previousData.username === data.username &&
                previousData.instanceId === data.instanceId &&
                previousData.instanceName === data.instanceName &&
                previousData.deviceName === data.deviceName
              ) {
                return previous;
              }
              return { ...previous, [key]: data };
            });
          } catch {
            if (cancelled) {
              return;
            }
            setRichInfos((previous) => {
              if (!previous[key]) {
                return previous;
              }
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

  const sortedDevices = useMemo(() => {
    return [...candidateDevices].sort((a, b) => {
      const aKey = getDeviceKey(a);
      const bKey = getDeviceKey(b);
      const aRich = richInfos[aKey];
      const bRich = richInfos[bKey];
      const aId = normalizeDeviceId(aRich?.deviceId || a.device_id);
      const bId = normalizeDeviceId(bRich?.deviceId || b.device_id);
      const aIsOwn = aRich ? accounts.some((item) => item.uuid === aRich.userUuid) : false;
      const bIsOwn = bRich ? accounts.some((item) => item.uuid === bRich.userUuid) : false;
      const aIsFriend = friendMap.has(aId);
      const bIsFriend = friendMap.has(bId);

      if (aIsOwn !== bIsOwn) {
        return aIsOwn ? -1 : 1;
      }
      if (aIsFriend !== bIsFriend) {
        return aIsFriend ? -1 : 1;
      }
      return a.device_name.localeCompare(b.device_name);
    });
  }, [accounts, candidateDevices, friendMap, richInfos]);

  useEffect(() => {
    if (!expandedDeviceKey) {
      return;
    }
    const exists = validDevices.some((device) => getDeviceKey(device) === expandedDeviceKey);
    if (!exists) {
      setExpandedDeviceKey(null);
    }
  }, [expandedDeviceKey, validDevices]);

  return (
    <div className="flex flex-col gap-3">
      <div className="ore-ms-radar-header flex items-center justify-between pl-1 text-xs font-bold uppercase tracking-wider">
        <div className="flex items-center">
          <Users size={14} className="mr-2" />
          局域网雷达 ({candidateDevices.length})
        </div>
        {isScanning && (
          <div className="flex items-center gap-1.5 font-normal normal-case text-ore-green">
            <Loader2 size={12} className="animate-spin" />
            <span className="text-[10px]">正在扫描...</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {candidateDevices.length === 0 && !isScanning && (
          <div className="ore-ms-radar-empty p-4 text-center text-sm">
            附近没有待处理的好友或设备。
          </div>
        )}

        {candidateDevices.length === 0 && isScanning && (
          <div className="ore-ms-radar-empty flex items-center justify-center gap-2 p-4 text-center text-sm">
            <Loader2 size={14} className="animate-spin text-ore-green" />
            正在扫描局域网中的设备...
          </div>
        )}

        {sortedDevices.map((device) => {
          const key = getDeviceKey(device);
          const richInfo = richInfos[key];
          const deviceId = normalizeDeviceId(richInfo?.deviceId || device.device_id);
          const relationship = friendMap.get(deviceId);
          const isOwnAccount = richInfo
            ? accounts.some((item) => item.uuid === richInfo.userUuid)
            : false;

          return (
            <LanDeviceItem
              key={key}
              device={device}
              richInfo={richInfo}
              relationship={relationship}
              isFriend={!!relationship}
              isTrusted={trustedDeviceIds.has(deviceId)}
              isOwnAccount={isOwnAccount}
              isRequesting={isRequesting}
              isExpanded={expandedDeviceKey === key}
              onToggleExpand={() =>
                setExpandedDeviceKey((previous) => (previous === key ? null : key))
              }
              onRequestTrust={onRequestTrust}
              onTrustDevice={onTrustDevice}
            />
          );
        })}
      </div>
    </div>
  );
};
