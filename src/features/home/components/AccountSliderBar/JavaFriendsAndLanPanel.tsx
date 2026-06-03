import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  MonitorSmartphone,
  RefreshCcw,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';

import type { DiscoveredDevice, TrustedDevice } from '../../../../hooks/useLan';
import type { MinecraftAccount } from '../../../../store/useAccountStore';
import { useAccountStore } from '../../../../store/useAccountStore';
import { useSettingsStore } from '../../../../store/useSettingsStore';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import defaultAvatarSvg from '../../../../assets/icons/user.svg';

interface JavaFriendStatus {
  uuid: string;
  xuid?: string | null;
  name: string;
  isOnline: boolean;
  activity: string;
  canJoin: boolean;
  avatarUrl?: string | null;
}

interface JavaFriendsStatusPayload {
  friends: JavaFriendStatus[];
  authUpdate: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
}

export interface DeviceInitInfo {
  deviceId: string;
  deviceName: string;
  username: string;
  userUuid: string;
  isPremium: boolean;
  isDonor: boolean;
  launcherVersion: string;
  instanceName?: string;
  instanceId?: string;
  bgUrl: string;
}

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

interface MergedFriendItem {
  key: string;
  isLan: boolean;
  isJavaFriend: boolean;
  device?: DiscoveredDevice;
  richInfo?: DeviceInitInfo;
  relationship?: TrustedDevice;
  isTrusted?: boolean;
  isOwnAccount?: boolean;
  javaFriend?: JavaFriendStatus;
}

const normalizeDeviceId = (value?: string) => (value || '').trim().toLowerCase();
const getDeviceKey = (device: DiscoveredDevice) =>
  normalizeDeviceId(device.device_id) || `${device.ip}:${device.port}`;

const WifiIcon: React.FC<{ className?: string; title?: string }> = ({ className = 'h-4 w-4', title }) => (
  <svg
    viewBox="0 0 16 16"
    fill="currentColor"
    className={`${className} rendering-pixelated`}
  >
    {title && <title>{title}</title>}
    {/* Dot */}
    <rect x="7" y="13" width="2" height="2" />
    {/* Arc 1 */}
    <rect x="5" y="10" width="2" height="1" />
    <rect x="9" y="10" width="2" height="1" />
    <rect x="7" y="9" width="2" height="1" />
    {/* Arc 2 */}
    <rect x="3" y="7" width="2" height="1" />
    <rect x="11" y="7" width="2" height="1" />
    <rect x="5" y="6" width="6" height="1" />
    {/* Arc 3 */}
    <rect x="1" y="4" width="2" height="1" />
    <rect x="13" y="4" width="2" height="1" />
    <rect x="3" y="3" width="10" height="1" />
  </svg>
);

const JavaFriendsAndLanItem: React.FC<{
  item: MergedFriendItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isRequesting: boolean;
  onRequestTrust: (ip: string, port: number, requestKind?: 'friend' | 'trusted') => void;
  onTrustDevice: (device: TrustedDevice) => void;
}> = ({
  item,
  isExpanded,
  onToggleExpand,
  isRequesting,
  onRequestTrust,
  onTrustDevice,
}) => {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  const device = item.device;
  const richInfo = item.richInfo;
  const relationship = item.relationship;
  const isTrusted = item.isTrusted || false;
  const isOwnAccount = item.isOwnAccount || false;
  const isFriend = !!relationship;

  const username = richInfo?.username?.trim() || relationship?.username?.trim() || item.javaFriend?.name?.trim() || '';
  const hasRichProfile = username.length > 0;
  const displayName = item.javaFriend?.name || (hasRichProfile ? username : device?.device_name) || '未知用户';
  const canSeeInstance = isTrusted || isOwnAccount;

  // Load LAN avatar if applicable
  useEffect(() => {
    if (!item.isLan || !device) {
      setAvatarSrc(null);
      return;
    }

    let cancelled = false;
    const userUuid = richInfo?.userUuid || relationship?.userUuid;

    if (!userUuid) {
      setAvatarSrc(null);
      return;
    }

    const fetchAvatar = async () => {
      try {
        const lanAvatarPath = await invoke<string>('sync_lan_avatar', {
          targetIp: device.ip,
          targetPort: device.port,
          userUuid,
        });

        if (!cancelled) {
          setAvatarSrc(`${convertFileSrc(lanAvatarPath)}?t=${Date.now()}`);
        }
        return;
      } catch {
        // fall back to Mojang / local account avatar
      }

      if (!username) {
        if (!cancelled) {
          setAvatarSrc(null);
        }
        return;
      }

      try {
        const onlineAvatarPath = await invoke<string>('get_or_fetch_account_avatar', {
          uuid: userUuid,
          username,
        });
        if (!cancelled) {
          setAvatarSrc(`${convertFileSrc(onlineAvatarPath)}?t=${Date.now()}`);
        }
      } catch {
        if (!cancelled) {
          setAvatarSrc(null);
        }
      }
    };

    void fetchAvatar();
    return () => {
      cancelled = true;
    };
  }, [item.isLan, device?.ip, device?.port, relationship?.userUuid, richInfo?.userUuid, username]);

  const getAvatarUrl = () => {
    if (item.isLan) {
      return avatarSrc || defaultAvatarSvg;
    }
    if (item.javaFriend) {
      if (item.javaFriend.avatarUrl) {
        return item.javaFriend.avatarUrl;
      }
      const identity = item.javaFriend.uuid || item.javaFriend.name;
      return `https://minotar.net/helm/${encodeURIComponent(identity)}/48.png`;
    }
    return defaultAvatarSvg;
  };

  const frameColor =
    hasRichProfile && richInfo?.isDonor
      ? 'border-purple-500'
      : hasRichProfile && richInfo?.isPremium
        ? 'border-[#EAB308]'
        : hasRichProfile
          ? 'border-gray-500'
          : 'border-[#313233]';

  const nameColor =
    hasRichProfile && richInfo?.isDonor
      ? 'text-purple-400'
      : hasRichProfile && richInfo?.isPremium
        ? 'text-[#FBBF24]'
        : hasRichProfile
          ? 'text-gray-200'
          : 'text-gray-200';

  const handlePrimaryAction = () => {
    if (!device) return;
    if (isFriend && !isTrusted && relationship) {
      onTrustDevice(relationship);
      return;
    }
    onRequestTrust(device.ip, device.port, isOwnAccount ? 'trusted' : 'friend');
  };

  const primaryLabel = isFriend
    ? '设为信任设备'
    : isOwnAccount
      ? '信任此设备'
      : '添加好友';

  const primaryIcon = isFriend ? (
    <ShieldCheck size={16} className="mr-1.5" />
  ) : isOwnAccount ? (
    <MonitorSmartphone size={16} className="mr-1.5" />
  ) : (
    <UserPlus size={16} className="mr-1.5" />
  );

  const innerContent = (
    <>
      <div className={`mr-2.5 h-8 w-8 flex-shrink-0 border-2 bg-black/40 ${frameColor} rounded-none`}>
        <img
          src={getAvatarUrl()}
          className="h-full w-full object-cover rendering-pixelated rounded-none"
          alt=""
          onError={(event) => {
            event.currentTarget.src = defaultAvatarSvg;
          }}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex min-w-0 items-center pr-1.5 gap-1.5">
          {item.isLan && (
            <WifiIcon className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" title="局域网活跃好友/设备" />
          )}
          <span className={`truncate font-minecraft text-[14px] font-bold ore-ms-list-item-text leading-[18px] ${nameColor}`}>
            {displayName}
          </span>
          <div className="flex flex-shrink-0 items-center gap-1">
            {isOwnAccount && (
              <span className="rounded-none border border-blue-500/30 bg-blue-500/20 px-1 py-0.5 text-[9px] text-blue-400 font-minecraft ore-ms-list-item-text leading-none">
                我的设备
              </span>
            )}
            {isTrusted && (
              <span className="rounded-none border border-emerald-500/30 bg-emerald-500/20 px-1 py-0.5 text-[9px] text-emerald-300 font-minecraft ore-ms-list-item-text leading-none">
                已授信
              </span>
            )}
            {isFriend && !isTrusted && (
              <span className="rounded-none border border-sky-500/30 bg-sky-500/20 px-1 py-0.5 text-[9px] text-sky-300 font-minecraft ore-ms-list-item-text leading-none">
                好友
              </span>
            )}
            {!item.isLan && item.isJavaFriend && (
              <span className="rounded-none border border-sky-500/25 bg-sky-500/10 px-1 py-0.5 text-[9px] text-sky-200 font-minecraft ore-ms-list-item-text leading-none">
                好友
              </span>
            )}
          </div>
        </div>

        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-[#a8a9ad] leading-[14px] ore-ms-list-item-text">
          {item.isLan && device ? (
            <span className="truncate">
              设备: {device.device_name} ({device.ip})
              {canSeeInstance && richInfo?.instanceName && (
                <> | <span className="text-ore-green">当前实例: {richInfo.instanceName}</span></>
              )}
            </span>
          ) : (
            <span className="truncate">{item.javaFriend?.activity || '在线'}</span>
          )}
        </div>
      </div>

      {item.isLan && (
        <div className="ml-1 text-gray-400 flex-shrink-0">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      )}
    </>
  );

  return (
    <div className="ore-ms-list-item flex flex-col overflow-hidden rounded-none">
      {item.isLan ? (
        <FocusItem focusKey={`lan-player-${device?.device_id || device?.ip}`} onEnter={onToggleExpand}>
          {({ ref, focused }) => (
            <button
              ref={ref as any}
              onClick={onToggleExpand}
              className={`relative z-10 flex items-center p-2.5 text-left outline-none transition-colors border-none bg-transparent w-full ${
                focused ? 'is-focused' : ''
              }`}
            >
              {innerContent}
            </button>
          )}
        </FocusItem>
      ) : (
        <div className="flex items-center p-2.5 text-left bg-transparent w-full">
          {innerContent}
        </div>
      )}

      {item.isLan && device && (
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="relative z-10 border-t border-white/10 bg-black/30"
            >
              <div className="flex flex-col gap-2 p-2">
                {!isTrusted && (
                  <>
                    <FocusItem
                      focusKey={`lan-action-${device.device_id || device.ip}`}
                      onEnter={handlePrimaryAction}
                    >
                      {({ ref, focused }) => (
                        <button
                          ref={ref as any}
                          onClick={handlePrimaryAction}
                          disabled={isRequesting}
                          className={`flex min-h-[36px] items-center justify-center rounded-none border p-2 text-xs outline-none transition-colors ${
                            isFriend
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                              : isOwnAccount
                                ? 'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                                : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                          } ${focused ? 'ring-2 ring-white' : ''}`}
                        >
                          {isRequesting ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : primaryIcon}
                          {isRequesting ? '处理中...' : primaryLabel}
                        </button>
                      )}
                    </FocusItem>

                    <div className="rounded-none border border-white/10 bg-white/5 px-2.5 py-2 text-[10px] leading-relaxed text-[#a8a9ad] font-minecraft ore-ms-list-item-text">
                      {isFriend
                        ? '当前仅为局域网好友，不可传输实例/存档。点击“设为信任设备”同意授权后，即可投送。'
                        : '添加为局域网好友后，可申请升级为可信设备。'}
                    </div>
                  </>
                )}

                {isTrusted && (
                  <div className="flex items-center justify-center rounded-none border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-300 font-minecraft ore-ms-list-item-text">
                    <Send size={12} className="mr-1.5" />
                    已信任，可打开左侧投送会话。
                  </div>
                )}

                {isFriend && !isTrusted && (
                  <div className="flex items-center rounded-none border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-200 font-minecraft ore-ms-list-item-text">
                    <Lock size={12} className="mr-1.5 flex-shrink-0" />
                    仅好友状态下不会暴露实例详情，也不会开放隔空投送。
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

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

  // Merge Java Friends & LAN Devices
  const mergedItems = useMemo(() => {
    const list: MergedFriendItem[] = [];
    const matchedJavaUuids = new Set<string>();
    const matchedJavaNames = new Set<string>();

    // 1. Process candidate LAN devices
    candidateDevices.forEach((device) => {
      const key = getDeviceKey(device);
      const richInfo = richInfos[key];
      const deviceId = normalizeDeviceId(richInfo?.deviceId || device.device_id);
      const relationship = lanFriendMap.get(deviceId);

      // Match LAN device to online Java friends
      let matchedFriend: JavaFriendStatus | undefined;
      if (richInfo) {
        matchedFriend = onlineJavaFriends.find((f) => {
          if (f.uuid && richInfo.userUuid) {
            return f.uuid.toLowerCase() === richInfo.userUuid.toLowerCase();
          }
          if (f.name && richInfo.username) {
            return f.name.toLowerCase() === richInfo.username.toLowerCase();
          }
          return false;
        });
      }

      if (matchedFriend) {
        if (matchedFriend.uuid) {
          matchedJavaUuids.add(matchedFriend.uuid.toLowerCase());
        }
        if (matchedFriend.name) {
          matchedJavaNames.add(matchedFriend.name.toLowerCase());
        }
      }

      list.push({
        key: `lan-${key}`,
        isLan: true,
        isJavaFriend: !!matchedFriend,
        device,
        richInfo,
        relationship,
        isTrusted: trustedDeviceIds.has(deviceId),
        isOwnAccount: richInfo ? accounts.some((item) => item.uuid === richInfo.userUuid) : false,
        javaFriend: matchedFriend,
      });
    });

    // 2. Process remaining online Java friends
    onlineJavaFriends.forEach((friend) => {
      const uuidKey = friend.uuid?.toLowerCase();
      const nameKey = friend.name?.toLowerCase();

      if ((uuidKey && matchedJavaUuids.has(uuidKey)) || (nameKey && matchedJavaNames.has(nameKey))) {
        return; // already matched & merged
      }

      list.push({
        key: `java-${friend.uuid || friend.name}`,
        isLan: false,
        isJavaFriend: true,
        javaFriend: friend,
      });
    });

    // 3. Sort: LAN devices/friends (isLan === true) first, then pure Java friends.
    return list.sort((a, b) => {
      if (a.isLan !== b.isLan) {
        return a.isLan ? -1 : 1;
      }

      if (a.isLan) {
        const aIsOwn = a.isOwnAccount || false;
        const bIsOwn = b.isOwnAccount || false;
        if (aIsOwn !== bIsOwn) {
          return aIsOwn ? -1 : 1;
        }

        const aIsFriend = !!a.relationship || a.isJavaFriend;
        const bIsFriend = !!b.relationship || b.isJavaFriend;
        if (aIsFriend !== bIsFriend) {
          return aIsFriend ? -1 : 1;
        }

        const aName = a.richInfo?.username || a.device?.device_name || '';
        const bName = b.richInfo?.username || b.device?.device_name || '';
        return aName.localeCompare(bName);
      } else {
        const aName = a.javaFriend?.name || '';
        const bName = b.javaFriend?.name || '';
        return aName.localeCompare(bName);
      }
    });
  }, [candidateDevices, onlineJavaFriends, richInfos, lanFriendMap, trustedDeviceIds, accounts]);

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
