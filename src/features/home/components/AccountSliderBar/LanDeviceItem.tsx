import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import {
  ChevronDown,
  ChevronUp,
  Link,
  Send,
  Trash2,
  UserPlus,
  Ban,
  Loader2,
  MonitorSmartphone,
} from 'lucide-react';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import defaultAvatarSvg from '../../../../assets/icons/user.svg';

export interface DeviceInitInfo {
  device_id: string;
  device_name: string;
  username: string;
  user_uuid: string;
  is_premium: boolean;
  is_donor: boolean;
  launcher_version: string;
  instance_name?: string;
  instance_id?: string;
  bg_url: string;
}

interface DiscoveredDevice {
  device_id: string;
  device_name: string;
  ip: string;
  port: number;
}

interface LanDeviceItemProps {
  device: DiscoveredDevice;
  richInfo?: DeviceInitInfo;
  isExpanded: boolean;
  isFriend: boolean;
  isOwnAccount: boolean;
  isRequesting: boolean;
  onToggleExpand: () => void;
  onRequestTrust: (ip: string, port: number) => void;
}

export const LanDeviceItem: React.FC<LanDeviceItemProps> = ({
  device,
  richInfo,
  isExpanded,
  isFriend,
  isOwnAccount,
  isRequesting,
  onToggleExpand,
  onRequestTrust,
}) => {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const username = richInfo?.username?.trim() || '';
  const hasRichProfile = username.length > 0;
  const displayName = hasRichProfile ? username : device.device_name;
  const canSeeInstance = isFriend || isOwnAccount;

  useEffect(() => {
    let isCancelled = false;
    const userUuid = richInfo?.user_uuid;

    if (!userUuid) {
      setAvatarSrc(null);
      return () => {
        isCancelled = true;
      };
    }

    const fetchAvatar = async () => {
      try {
        const lanAvatarPath = await invoke<string>('sync_lan_avatar', {
          targetIp: device.ip,
          targetPort: device.port,
          userUuid,
        });

        if (!isCancelled) {
          setAvatarSrc(`${convertFileSrc(lanAvatarPath)}?t=${Date.now()}`);
        }
        return;
      } catch {
        // Keep fallback flow.
      }

      if (!username) {
        if (!isCancelled) {
          setAvatarSrc(null);
        }
        return;
      }

      try {
        const onlineAvatarPath = await invoke<string>('get_or_fetch_account_avatar', {
          uuid: userUuid,
          username,
        });

        if (!isCancelled) {
          setAvatarSrc(`${convertFileSrc(onlineAvatarPath)}?t=${Date.now()}`);
        }
      } catch {
        if (!isCancelled) {
          setAvatarSrc(null);
        }
      }
    };

    fetchAvatar();

    return () => {
      isCancelled = true;
    };
  }, [device.ip, device.port, richInfo?.user_uuid, username]);

  const frameColor = (hasRichProfile && richInfo?.is_donor)
    ? 'border-purple-500'
    : (hasRichProfile && richInfo?.is_premium)
      ? 'border-[#EAB308]'
      : hasRichProfile
        ? 'border-gray-500'
        : 'border-[#313233]';

  const nameColor = (hasRichProfile && richInfo?.is_donor)
    ? 'text-purple-400'
    : (hasRichProfile && richInfo?.is_premium)
      ? 'text-[#FBBF24]'
      : hasRichProfile
        ? 'text-gray-200'
        : 'text-gray-400';

  return (
    <div className={`relative flex flex-col border-[2px] rounded-sm overflow-hidden transition-all duration-200 bg-[#2A2A2C]
      ${isOwnAccount ? 'border-blue-500/50' : 'border-[#313233]'}
    `}>
      <FocusItem focusKey={`lan-player-${device.device_id}`} onEnter={onToggleExpand}>
        {({ ref, focused }) => (
          <button
            ref={ref as any}
            onClick={onToggleExpand}
            className={`relative z-10 flex items-center p-3 outline-none transition-colors ${focused ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <div className={`w-10 h-10 bg-black/50 border-[2px] mr-3 flex-shrink-0 ${frameColor}`}>
              <img
                src={avatarSrc || defaultAvatarSvg}
                className="w-full h-full rendering-pixelated object-cover"
                alt="avatar"
                onError={(e) => {
                  e.currentTarget.src = defaultAvatarSvg;
                }}
              />
            </div>

            <div className="flex-1 flex flex-col text-left min-w-0">
              <div className="flex items-center min-w-0 pr-2">
                <span className={`font-bold truncate ${nameColor}`}>{displayName}</span>

                {hasRichProfile && (
                  <div className="flex items-center ml-2 gap-1 flex-shrink-0">
                    {isOwnAccount && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-sm border bg-blue-500/20 text-blue-400 border-blue-500/30">
                        我的设备
                      </span>
                    )}
                    {richInfo?.is_donor ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-sm border bg-purple-500/20 text-purple-400 border-purple-500/30">
                        捐赠者
                      </span>
                    ) : richInfo?.is_premium ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-sm border bg-[#EAB308]/20 text-[#FBBF24] border-[#EAB308]/30">
                        正版
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              <span className="text-gray-400 text-[10px] flex items-center gap-1.5 mt-0.5 truncate">
                <span>设备: {device.device_name} ({device.ip})</span>

                {canSeeInstance && richInfo?.instance_name && (
                  <>
                    <span className="opacity-50">|</span>
                    <span className="text-ore-green truncate">🎮 {richInfo.instance_name}</span>
                  </>
                )}
              </span>
            </div>

            <div className="text-gray-400 ml-2">
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
            className="relative z-10 bg-black/40 border-t border-white/10"
          >
            <div className="flex gap-2 p-2">
              {isFriend ? (
                <>
                  <FocusItem focusKey={`lan-conn-${device.device_id}`}>
                    {({ ref, focused }) => (
                      <button ref={ref as any} className={`flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 p-2 flex justify-center items-center text-xs rounded-sm transition-colors outline-none ${focused ? 'ring-2 ring-white' : ''}`}>
                        <Link size={14} className="mr-1.5" />
                        联机 (施工中)
                      </button>
                    )}
                  </FocusItem>
                  <FocusItem focusKey={`lan-send-${device.device_id}`}>
                    {({ ref, focused }) => (
                      <button ref={ref as any} className={`flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 p-2 flex justify-center items-center text-xs rounded-sm transition-colors outline-none ${focused ? 'ring-2 ring-white' : ''}`}>
                        <Send size={14} className="mr-1.5" />
                        传输
                      </button>
                    )}
                  </FocusItem>
                  <FocusItem focusKey={`lan-del-${device.device_id}`}>
                    {({ ref, focused }) => (
                      <button ref={ref as any} className={`flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 p-2 flex justify-center items-center text-xs rounded-sm transition-colors outline-none ${focused ? 'ring-2 ring-white' : ''}`}>
                        <Trash2 size={14} className="mr-1.5" />
                        删除
                      </button>
                    )}
                  </FocusItem>
                </>
              ) : (
                <>
                  <FocusItem focusKey={`lan-req-${device.device_id}`} onEnter={() => onRequestTrust(device.ip, device.port)}>
                    {({ ref, focused }) => (
                      <button
                        ref={ref as any}
                        onClick={() => onRequestTrust(device.ip, device.port)}
                        disabled={isRequesting}
                        className={`flex-1 p-2 flex justify-center items-center text-xs rounded-sm transition-colors border outline-none
                          ${isOwnAccount ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 hover:bg-white/10 text-white border-white/10'}
                          ${focused ? 'ring-2 ring-white' : ''}
                        `}
                      >
                        {isRequesting
                          ? <Loader2 size={14} className="animate-spin mr-1.5" />
                          : (isOwnAccount ? <MonitorSmartphone size={14} className="mr-1.5" /> : <UserPlus size={14} className="mr-1.5" />)}
                        {isRequesting ? '请求中...' : (isOwnAccount ? '信任此设备' : '添加好友')}
                      </button>
                    )}
                  </FocusItem>
                  {!isOwnAccount && (
                    <FocusItem focusKey={`lan-ban-${device.device_id}`}>
                      {({ ref, focused }) => (
                        <button ref={ref as any} className={`flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 p-2 flex justify-center items-center text-xs rounded-sm transition-colors outline-none ${focused ? 'ring-2 ring-white' : ''}`}>
                          <Ban size={14} className="mr-1.5" />
                          屏蔽
                        </button>
                      )}
                    </FocusItem>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
