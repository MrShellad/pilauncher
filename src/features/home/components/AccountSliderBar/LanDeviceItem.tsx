import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  MonitorSmartphone,
  Send,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';

import type { DiscoveredDevice, TrustedDevice } from '../../../../hooks/useLan';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import defaultAvatarSvg from '../../../../assets/icons/user.svg';

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

interface LanDeviceItemProps {
  device: DiscoveredDevice;
  richInfo?: DeviceInitInfo;
  relationship?: TrustedDevice;
  isExpanded: boolean;
  isFriend: boolean;
  isTrusted: boolean;
  isOwnAccount: boolean;
  isRequesting: boolean;
  onToggleExpand: () => void;
  onRequestTrust: (ip: string, port: number, requestKind?: 'friend' | 'trusted') => void;
  onTrustDevice: (device: TrustedDevice) => void;
}

export const LanDeviceItem: React.FC<LanDeviceItemProps> = ({
  device,
  richInfo,
  relationship,
  isExpanded,
  isFriend,
  isTrusted,
  isOwnAccount,
  isRequesting,
  onToggleExpand,
  onRequestTrust,
  onTrustDevice,
}) => {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  const username = richInfo?.username?.trim() || relationship?.username?.trim() || '';
  const hasRichProfile = username.length > 0;
  const displayName = hasRichProfile ? username : device.device_name;
  const canSeeInstance = isTrusted || isOwnAccount;

  useEffect(() => {
    let cancelled = false;
    const userUuid = richInfo?.userUuid || relationship?.userUuid;

    if (!userUuid) {
      setAvatarSrc(null);
      return () => {
        cancelled = true;
      };
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
  }, [device.ip, device.port, relationship?.userUuid, richInfo?.userUuid, username]);

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
          : 'text-gray-400';

  const handlePrimaryAction = () => {
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
    <ShieldCheck size="clamp(0.875rem,1vw,1.25rem)" className="mr-1.5" />
  ) : isOwnAccount ? (
    <MonitorSmartphone size="clamp(0.875rem,1vw,1.25rem)" className="mr-1.5" />
  ) : (
    <UserPlus size="clamp(0.875rem,1vw,1.25rem)" className="mr-1.5" />
  );

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-sm border-[2px] bg-[#2A2A2C] transition-all duration-200 ${
        isOwnAccount ? 'border-blue-500/50' : 'border-[#313233]'
      }`}
    >
      <FocusItem focusKey={`lan-player-${device.device_id || device.ip}`} onEnter={onToggleExpand}>
        {({ ref, focused }) => (
          <button
            ref={ref as any}
            onClick={onToggleExpand}
            className={`relative z-10 flex items-center p-3 text-left outline-none transition-colors ${
              focused ? 'bg-white/10' : 'hover:bg-white/5'
            }`}
          >
            <div className={`mr-3 h-10 w-10 flex-shrink-0 border-[2px] bg-black/50 ${frameColor}`}>
              <img
                src={avatarSrc || defaultAvatarSvg}
                className="h-full w-full object-cover rendering-pixelated"
                alt="avatar"
                onError={(event) => {
                  event.currentTarget.src = defaultAvatarSvg;
                }}
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex min-w-0 items-center pr-2">
                <span className={`truncate font-bold ${nameColor}`}>{displayName}</span>
                <div className="ml-2 flex flex-shrink-0 items-center gap-1">
                  {isOwnAccount && (
                    <span className="rounded-sm border border-blue-500/30 bg-blue-500/20 px-1.5 py-0.5 text-[9px] text-blue-400">
                      我的设备
                    </span>
                  )}
                  {isTrusted && (
                    <span className="rounded-sm border border-emerald-500/30 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-300">
                      已授信
                    </span>
                  )}
                  {isFriend && !isTrusted && (
                    <span className="rounded-sm border border-sky-500/30 bg-sky-500/20 px-1.5 py-0.5 text-[9px] text-sky-300">
                      好友
                    </span>
                  )}
                </div>
              </div>

              <span className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] text-gray-400">
                <span>
                  设备: {device.device_name} ({device.ip})
                </span>

                {canSeeInstance && richInfo?.instanceName && (
                  <>
                    <span className="opacity-50">|</span>
                    <span className="truncate text-ore-green">当前实例: {richInfo.instanceName}</span>
                  </>
                )}
              </span>
            </div>

            <div className="ml-2 text-gray-400">
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>
        )}
      </FocusItem>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-10 border-t border-white/10 bg-black/40"
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
                        className={`flex min-h-[clamp(2.5rem,4.2vh,3.75rem)] items-center justify-center rounded-sm border p-[clamp(0.5rem,0.8vw,1rem)] text-[clamp(0.75rem,0.9vw,1.125rem)] outline-none transition-colors ${
                          isFriend
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                            : isOwnAccount
                              ? 'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                              : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                        } ${focused ? 'ring-2 ring-white' : ''}`}
                      >
                        {isRequesting ? <Loader2 size="clamp(0.875rem,1vw,1.25rem)" className="mr-1.5 animate-spin" /> : primaryIcon}
                        {isRequesting ? '处理中...' : primaryLabel}
                      </button>
                    )}
                  </FocusItem>

                  <div className="rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-gray-400">
                    {isFriend
                      ? '当前只是好友关系，还不能直接投送实例或存档。手动提升为信任设备后，右侧才会开放隔空投送。'
                      : '先建立好友关系，再决定是否把这台设备提升为可信设备。'}
                  </div>
                </>
              )}

              {isTrusted && (
                <div className="flex items-center justify-center rounded-sm border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  <Send size={14} className="mr-1.5" />
                  已授信，可在左侧信任设备列表中打开投送会话。
                </div>
              )}

              {isFriend && !isTrusted && (
                <div className="flex items-center rounded-sm border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                  <Lock size={13} className="mr-1.5 flex-shrink-0" />
                  仅好友状态下不会暴露实例详情，也不会开放隔空投送。
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
