// src/features/home/components/AccountSliderBar/LanDeviceItem.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Link, Send, Trash2, UserPlus, Ban, Loader2 } from 'lucide-react';
import { FocusItem } from '../../../../ui/focus/FocusItem';

interface DiscoveredDevice {
  device_id: string;
  device_name: string;
  ip: string;
  port: number;
}

interface LanDeviceItemProps {
  device: DiscoveredDevice;
  isExpanded: boolean;
  isFriend: boolean;
  isRequesting: boolean;
  onToggleExpand: () => void;
  onRequestTrust: (ip: string, port: number) => void;
}

export const LanDeviceItem: React.FC<LanDeviceItemProps> = ({ 
  device, isExpanded, isFriend, isRequesting, onToggleExpand, onRequestTrust 
}) => {
  return (
    <div className="relative flex flex-col border-[2px] rounded-sm overflow-hidden transition-all duration-200 border-[#313233] bg-[#2A2A2C]">
      {/* 设备头部 (点击展开/折叠) */}
      <FocusItem focusKey={`lan-player-${device.device_id}`} onEnter={onToggleExpand}>
        {({ ref, focused }) => (
          <button 
            ref={ref as any}
            onClick={onToggleExpand}
            className={`relative z-10 flex items-center p-3 outline-none transition-colors ${focused ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <div className="w-10 h-10 bg-black/50 border-[2px] mr-3 flex-shrink-0 border-[#313233]">
              <img src="https://cravatar.cn/avatars/8667ba71b85a4004af54457a9734eed7?size=64&overlay=true" className="w-full h-full rendering-pixelated object-cover" alt="lan-avatar"/>
            </div>
            <div className="flex-1 flex flex-col text-left min-w-0">
              <span className="font-bold truncate text-white">{device.device_name}</span>
              <span className="text-gray-400 text-[10px]">{device.ip}:{device.port}</span>
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
                  <button className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 p-2 flex justify-center items-center text-xs rounded-sm transition-colors cursor-not-allowed opacity-50"><Link size={14} className="mr-1.5"/> 联机 (施工中)</button>
                  <button className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 p-2 flex justify-center items-center text-xs rounded-sm transition-colors cursor-not-allowed opacity-50"><Send size={14} className="mr-1.5"/> 传输</button>
                  <button className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 p-2 flex justify-center items-center text-xs rounded-sm transition-colors cursor-not-allowed opacity-50"><Trash2 size={14} className="mr-1.5"/> 删除</button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => onRequestTrust(device.ip, device.port)}
                    disabled={isRequesting}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 p-2 flex justify-center items-center text-xs rounded-sm transition-colors"
                  >
                    {isRequesting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <UserPlus size={14} className="mr-1.5"/>}
                    {isRequesting ? '请求中...' : '添加好友'}
                  </button>
                  <button className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 p-2 flex justify-center items-center text-xs rounded-sm transition-colors cursor-not-allowed opacity-50"><Ban size={14} className="mr-1.5"/> 屏蔽</button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};