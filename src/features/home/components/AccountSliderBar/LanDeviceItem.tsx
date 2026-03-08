// src/features/home/components/AccountSliderBar/LanDeviceItem.tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { ChevronDown, ChevronUp, Link, Send, Trash2, UserPlus, Ban, Loader2, MonitorSmartphone } from 'lucide-react';
import { FocusItem } from '../../../../ui/focus/FocusItem';

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
  device, richInfo, isExpanded, isFriend, isOwnAccount, isRequesting, onToggleExpand, onRequestTrust 
}) => {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  // 利用已有的 auth 方法拉取对方头像
  useEffect(() => {
    if (richInfo?.user_uuid) {
      const fetchAvatar = async () => {
        try {
          const localPath = await invoke<string>('get_or_fetch_account_avatar', { 
            uuid: richInfo.user_uuid, 
            username: displayName 
          });
          setAvatarSrc(`${convertFileSrc(localPath)}?t=${Date.now()}`);
        } catch (e) {
          setAvatarSrc(defaultAvatar); // ✅ 断网时，别人的设备头像也显示为你本地的默认头像
        }
      };
      fetchAvatar();
    }
  }, [richInfo, displayName]);

  // 显示的用户名 (名片没拉到时用设备名兜底)
  const displayName = richInfo?.username || device.device_name;
  // 是否允许查看正在游玩的实例 (自己的设备 或 已经加为好友的设备)
  const canSeeInstance = isFriend || isOwnAccount;

  return (
    <div className={`relative flex flex-col border-[2px] rounded-sm overflow-hidden transition-all duration-200 bg-[#2A2A2C]
      ${isOwnAccount ? 'border-blue-500/50' : 'border-[#313233]'}
    `}>
      {/* 设备头部 (点击展开/折叠) */}
      <FocusItem focusKey={`lan-player-${device.device_id}`} onEnter={onToggleExpand}>
        {({ ref, focused }) => (
          <button 
            ref={ref as any}
            onClick={onToggleExpand}
            className={`relative z-10 flex items-center p-3 outline-none transition-colors ${focused ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <div className={`w-10 h-10 bg-black/50 border-[2px] mr-3 flex-shrink-0 ${richInfo?.is_premium ? 'border-[#EAB308]' : 'border-[#313233]'}`}>
              <img 
                src={avatarSrc || `https://cravatar.cn/avatars/8667ba71b85a4004af54457a9734eed7?size=64&overlay=true`} 
                className="w-full h-full rendering-pixelated object-cover" 
                alt="avatar"
              />
            </div>
            
            <div className="flex-1 flex flex-col text-left min-w-0">
              <div className="flex items-center min-w-0">
                <span className={`font-bold truncate ${richInfo?.is_premium ? 'text-[#FBBF24]' : 'text-white'}`}>
                  {displayName}
                </span>
                {richInfo && (
                  <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded-sm border flex-shrink-0
                    ${isOwnAccount ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-black/50 text-gray-400 border-white/10'}`}>
                    {isOwnAccount ? '我的设备' : '玩家'}
                  </span>
                )}
              </div>

              <span className="text-gray-400 text-[10px] flex items-center gap-1.5 mt-0.5 truncate">
                <span>{device.device_name} ({device.ip})</span>
                
                {/* 好友/授信设备可见的游玩状态 */}
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

      {/* 操作面板 (展开内容) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="relative z-10 bg-black/40 border-t border-white/10">
            <div className="flex gap-2 p-2">
              {isFriend ? (
                <>
                  <button className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 p-2 flex justify-center items-center text-xs rounded-sm transition-colors"><Link size={14} className="mr-1.5"/> 联机 (施工中)</button>
                  <button className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 p-2 flex justify-center items-center text-xs rounded-sm transition-colors"><Send size={14} className="mr-1.5"/> 传输</button>
                  <button className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 p-2 flex justify-center items-center text-xs rounded-sm transition-colors"><Trash2 size={14} className="mr-1.5"/> 删除</button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => onRequestTrust(device.ip, device.port)}
                    disabled={isRequesting}
                    className={`flex-1 p-2 flex justify-center items-center text-xs rounded-sm transition-colors border
                      ${isOwnAccount ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 hover:bg-white/10 text-white border-white/10'}
                    `}
                  >
                    {isRequesting 
                      ? <Loader2 size={14} className="animate-spin mr-1.5" /> 
                      : (isOwnAccount ? <MonitorSmartphone size={14} className="mr-1.5"/> : <UserPlus size={14} className="mr-1.5"/>)
                    }
                    {isRequesting ? '请求中...' : (isOwnAccount ? '信任此设备' : '添加好友')}
                  </button>
                  {!isOwnAccount && (
                    <button className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 p-2 flex justify-center items-center text-xs rounded-sm transition-colors"><Ban size={14} className="mr-1.5"/> 屏蔽</button>
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