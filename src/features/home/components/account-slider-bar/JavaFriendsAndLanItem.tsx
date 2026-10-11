import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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

import type { TrustedDevice } from '../../../../hooks/useLan';
import { resolveAccountAvatarAsset, resolveLanAvatarAsset } from '../../../../services/accountAppearance';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import defaultAvatarSvg from '../../../../assets/icons/user.svg';
import type { MergedFriendItem } from './javaFriendsLanTypes';

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

export const JavaFriendsAndLanItem: React.FC<{
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
    const javaFriend = item.javaFriend;
    if (!item.isLan) {
      if (!javaFriend?.uuid || !javaFriend.name) {
        setAvatarSrc(null);
        return;
      }

      let cancelled = false;
      void resolveAccountAvatarAsset({ uuid: javaFriend.uuid, name: javaFriend.name })
        .then((avatar) => {
          if (!cancelled) setAvatarSrc(avatar);
        });

      return () => {
        cancelled = true;
      };
    }

    if (!device) {
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
      const avatar = await resolveLanAvatarAsset({
        targetIp: device.ip,
        targetPort: device.port,
        uuid: userUuid,
        username,
      });
      if (!cancelled) {
        setAvatarSrc(avatar);
      }
    };

    void fetchAvatar();
    return () => {
      cancelled = true;
    };
  }, [item.isLan, item.javaFriend?.uuid, item.javaFriend?.name, device?.ip, device?.port, relationship?.userUuid, richInfo?.userUuid, username]);

  const getAvatarUrl = () => {
    if (item.isLan) {
      return avatarSrc || defaultAvatarSvg;
    }
    if (item.javaFriend) {
      if (avatarSrc) return avatarSrc;
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
              ref={ref as React.RefObject<HTMLButtonElement>}
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
                          ref={ref as React.RefObject<HTMLButtonElement>}
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
