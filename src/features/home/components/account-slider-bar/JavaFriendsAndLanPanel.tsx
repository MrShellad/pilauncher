import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Loader2,
  RefreshCcw,
  Users,
} from 'lucide-react';

import type { DiscoveredDevice, TrustedDevice } from '../../../../hooks/useLan';
import type { MinecraftAccount } from '@/features/account';
import { useAccountStore } from '@/features/account';
import { useSettingsStore } from '@/app/stores/useSettingsStore';
import { JavaFriendsAndLanItem } from './JavaFriendsAndLanItem';
import {
  getDeviceKey,
  mergeJavaFriendsAndLanItems,
  normalizeDeviceId,
} from './javaFriendsLanModel';
import type {
  DeviceInitInfo,
  JavaFriendStatus,
  JavaFriendsStatusPayload,
} from './javaFriendsLanTypes';

export type { DeviceInitInfo } from './javaFriendsLanTypes';

interface JavaFriendsAndLanPanelProps {
  account: MinecraftAccount;
  isPremium: boolean;
  discovered: DiscoveredDevice[];
  trusted: TrustedDevice[];
  friends: TrustedDevice[]; // LAN relationships
  isScanning: boolean;
  isRequesting: boolean;
  onRequestTrust: (ip: string, port: number, requestKind?: 'friend' | 'trusted') => void;
  onTrustDevice: (device: TrustedDevice) => void;
}

export const JavaFriendsAndLanPanel: React.FC<JavaFriendsAndLanPanelProps> = ({
  account,
  isPremium,
  discovered,
  trusted,
  friends: lanFriends,
  isScanning,
  isRequesting,
  onRequestTrust,
  onTrustDevice,
}) => {
  const updateAccount = useAccountStore((state) => state.updateAccount);
  const refreshTokenRef = useRef(account.refreshToken);
  const [javaFriends, setJavaFriends] = useState<JavaFriendStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedItemKey, setExpandedItemKey] = useState<string | null>(null);
  const [richInfos, setRichInfos] = useState<Record<string, DeviceInitInfo>>({});

  const { settings } = useSettingsStore();
  const { accounts } = useAccountStore();

  const selfDeviceId = normalizeDeviceId(settings.general.deviceId);
  const trustedDeviceIds = useMemo(
    () => new Set(trusted.map((item) => normalizeDeviceId(item.deviceId))),
    [trusted],
  );

  useEffect(() => {
    refreshTokenRef.current = account.refreshToken;
  }, [account.refreshToken]);

  // Load Java Friends status
  const loadFriends = useCallback(async () => {
    const refreshToken = refreshTokenRef.current;
    if (!isPremium || !refreshToken) {
      setJavaFriends([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    try {
      const payload = await invoke<JavaFriendsStatusPayload>('get_java_friends_status', {
        refreshToken,
      });

      setJavaFriends(payload.friends);
      setError(null);
      updateAccount(account.uuid, {
        accessToken: payload.authUpdate.accessToken,
        refreshToken: payload.authUpdate.refreshToken,
        expiresAt: payload.authUpdate.expiresAt,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [account.uuid, isPremium, updateAccount]);

  useEffect(() => {
    void loadFriends();

    let timeoutId: number | undefined;

    const scheduleNext = () => {
      const intervals = [30_000, 40_000, 60_000];
      const randomInterval = intervals[Math.floor(Math.random() * intervals.length)];

      timeoutId = window.setTimeout(async () => {
        await loadFriends();
        scheduleNext();
      }, randomInterval);
    };

    scheduleNext();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [loadFriends]);

  // Sync / fetch LAN device rich info
  const validDevices = useMemo(
    () => discovered.filter((device) => normalizeDeviceId(device.device_id) !== selfDeviceId),
    [discovered, selfDeviceId],
  );

  const candidateDevices = useMemo(
    () =>
      validDevices.filter((device) => !trustedDeviceIds.has(normalizeDeviceId(device.device_id))),
    [trustedDeviceIds, validDevices],
  );

  const lanFriendMap = useMemo(() => {
    const map = new Map<string, TrustedDevice>();
    lanFriends.forEach((item) => {
      map.set(normalizeDeviceId(item.deviceId), item);
    });
    return map;
  }, [lanFriends]);

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

    let timeoutId: number | undefined;

    const scheduleNext = () => {
      const intervals = [5_000, 10_000, 15_000];
      const randomInterval = intervals[Math.floor(Math.random() * intervals.length)];

      timeoutId = window.setTimeout(async () => {
        if (!cancelled) {
          await fetchRichInfo();
          scheduleNext();
        }
      }, randomInterval);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [validDevices]);

  // Clean expand state when devices go offline
  useEffect(() => {
    if (!expandedItemKey || !expandedItemKey.startsWith('lan-')) {
      return;
    }
    const rawKey = expandedItemKey.substring(4);
    const exists = validDevices.some((device) => getDeviceKey(device) === rawKey);
    if (!exists) {
      setExpandedItemKey(null);
    }
  }, [expandedItemKey, validDevices]);

  // Filter out offline friends
  const onlineJavaFriends = useMemo(() => {
    return javaFriends.filter((friend) => friend.isOnline === true);
  }, [javaFriends]);

  const mergedItems = useMemo(
    () =>
      mergeJavaFriendsAndLanItems({
        candidateDevices,
        onlineJavaFriends,
        richInfos,
        lanFriendMap,
        trustedDeviceIds,
        accounts,
      }),
    [accounts, candidateDevices, lanFriendMap, onlineJavaFriends, richInfos, trustedDeviceIds],
  );

  const handleRefresh = useCallback(async () => {
    void loadFriends();
    // Scan is triggered from prop
  }, [loadFriends]);

  const isRefreshLoading = isLoading || isScanning;

  return (
    <div className="flex flex-col gap-2">
      <div className="ore-ms-radar-header flex items-center justify-between text-[10px] font-bold uppercase tracking-wider font-minecraft ore-ms-list-item-text">
        <div className="flex items-center">
          <Users size={13} className="mr-2 text-gray-300" />
          <span>好友与设备 ({mergedItems.length})</span>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshLoading}
          className="inline-flex items-center gap-1.5 rounded-none border border-white/10 px-2 py-1 text-[10px] text-gray-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 font-minecraft"
          title="刷新好友和设备"
        >
          {isRefreshLoading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCcw size={10} />}
          刷新
        </button>
      </div>

      {error && isPremium && (
        <div className="mb-2 rounded-none border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-red-200 font-minecraft ore-ms-list-item-text">
          同步好友失败: {error}
        </div>
      )}

      {mergedItems.length === 0 && !isRefreshLoading && (
        <div className="ore-ms-radar-empty rounded-none p-4 text-center text-xs leading-relaxed font-minecraft text-gray-400">
          {isPremium ? '暂无在线好友或局域网设备。' : '登录 Microsoft 正版账号后可同步 Java 好友；未登录亦可发现局域网设备。'}
        </div>
      )}

      {mergedItems.length === 0 && isRefreshLoading && (
        <div className="ore-ms-radar-empty rounded-none flex items-center justify-center gap-2 p-4 text-center text-xs font-minecraft text-gray-400">
          <Loader2 size={13} className="animate-spin text-ore-green" />
          正在扫描局域网与同步好友...
        </div>
      )}

      {mergedItems.length > 0 && (
        <div className="custom-scrollbar flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-0.5">
          {mergedItems.map((item) => (
            <JavaFriendsAndLanItem
              key={item.key}
              item={item}
              isExpanded={expandedItemKey === item.key}
              onToggleExpand={() =>
                setExpandedItemKey((previous) => (previous === item.key ? null : item.key))
              }
              isRequesting={isRequesting}
              onRequestTrust={onRequestTrust}
              onTrustDevice={onTrustDevice}
            />
          ))}
        </div>
      )}
    </div>
  );
};
