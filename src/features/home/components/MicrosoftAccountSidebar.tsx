// src/features/home/components/modals/MicrosoftAccountSidebar.tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { 
  Monitor, Laptop, Smartphone, Gamepad2, Plus, 
  UserPlus, Ban, Link, Send, Trash2, ChevronDown, ChevronUp, Users, Loader2
} from 'lucide-react';

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useAccountStore } from '../../../store/useAccountStore';
import { useLan } from '../../../hooks/useLan'; // ✅ 引入局域网引擎

interface MicrosoftAccountSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MicrosoftAccountSidebar: React.FC<MicrosoftAccountSidebarProps> = ({ isOpen, onClose }) => {
  const { accounts, activeAccountId } = useAccountStore();
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  // ✅ 拉取真实的局域网状态
  const { discovered, trusted, isScanning, isRequesting, scan, sendTrustRequest } = useLan();

  const currentAccount = accounts.find(acc => acc.uuid === activeAccountId);
  const isPremium = currentAccount?.type?.toLowerCase() === 'microsoft';

  // 每次打开侧边栏，自动触发一次局域网雷达扫描
  useEffect(() => {
    if (isOpen) {
      scan();
    }
  }, [isOpen, scan]);

  useEffect(() => {
    if (currentAccount && isOpen) {
      const fetchAvatar = async () => {
        try {
          const localPath = await invoke<string>('get_or_fetch_account_avatar', { uuid: currentAccount.uuid });
          setAvatarSrc(`${convertFileSrc(localPath)}?t=${Date.now()}`);
        } catch (e) {
          setAvatarSrc(`https://cravatar.cn/avatars/${currentAccount.uuid}?size=128&overlay=true`);
        }
      };
      fetchAvatar();
    }
  }, [currentAccount, isOpen]);

  if (!currentAccount) return null;

  // 根据设备名初步推测平台图标
  const renderDeviceIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('deck') || lower.includes('steam')) return <Gamepad2 size={16} className="text-orange-400" />;
    if (lower.includes('mac') || lower.includes('book')) return <Laptop size={16} className="text-gray-300" />;
    if (lower.includes('phone') || lower.includes('pad')) return <Smartphone size={16} className="text-green-400" />;
    return <Monitor size={16} className="text-blue-400" />;
  };

  const renderMediaBackground = (src: string) => {
    if (src.endsWith('.webm') || src.endsWith('.mp4')) {
      return <video src={src} autoPlay loop muted className="w-full h-full object-cover opacity-60 mix-blend-screen" />;
    }
    return <img src={src} className="w-full h-full object-cover opacity-60 mix-blend-screen" alt="background" />;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <FocusBoundary id="sidebar-profile" trapFocus onEscape={onClose}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm"
          />

          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 left-0 h-full w-full max-w-[750px] bg-[#1E1E1F] z-[101] shadow-2xl border-r-[2px] border-[#2A2A2C] flex flex-col font-minecraft select-none"
          >
            <div className="flex-1 flex flex-col sm:flex-row gap-6 p-6 pt-10 overflow-y-auto custom-scrollbar">
              
              <div className="w-full sm:w-[320px] flex flex-col flex-shrink-0 gap-6">
                {/* 核心用户信息卡片 */}
                <div className={`relative flex flex-col border-[2px] shadow-xl overflow-hidden rounded-sm ${isPremium ? 'border-[#EAB308] bg-[#1A1A1C]' : 'border-[#313233] bg-[#2A2A2C]'}`}>
                  {isPremium && (
                    <div className="absolute inset-0 z-0 overflow-hidden">
                      {renderMediaBackground('/src/assets/home/account/bg.jpg')}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#141415] via-[#141415]/80 to-transparent" />
                    </div>
                  )}

                  <div className="relative z-10 p-5 pb-4 border-b border-white/10">
                    <div className="flex items-start mb-1">
                      <div className={`relative w-16 h-16 bg-[#111112] border-[2px] mr-4 flex-shrink-0 ${isPremium ? 'border-[#EAB308]' : 'border-black/50'}`}>
                        <img 
                          src={avatarSrc || `https://cravatar.cn/avatars/8667ba71b85a4004af54457a9734eed7?overlay=true&size=64`} 
                          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "https://cravatar.cn/avatars/8667ba71b85a4004af54457a9734eed7?overlay=true&size=64"; }}
                          className="w-full h-full rendering-pixelated object-cover" 
                          alt="Avatar" 
                        />
                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#3C8527] border-[2px] border-[#2A2A2C] rounded-full" title="在线" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1 pt-1">
                        <span className={`text-xl font-bold truncate tracking-wider drop-shadow-md ${isPremium ? 'text-[#FBBF24]' : 'text-white'}`}>
                          {currentAccount.name}
                        </span>
                        <span className="text-gray-400 text-xs truncate mt-0.5">
                          {isPremium ? 'Premium (Microsoft)' : 'Offline Account'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ✅ 真实：在线信任设备卡片区域 */}
                  <div className="relative z-10 p-4 bg-black/20">
                    <div className="flex items-center text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">
                      <Monitor size={14} className="mr-2"/> 当前信任设备 ({trusted.length})
                    </div>
                    <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto">
                      {trusted.length === 0 && <div className="text-xs text-gray-500 text-center py-2">暂无信任的其他设备</div>}
                      {trusted.map(device => (
                        <div key={device.device_id} className="flex items-center justify-between bg-white/5 border border-white/5 p-2 rounded-sm hover:bg-white/10 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            {renderDeviceIcon(device.device_name)}
                            <span className="text-sm text-gray-200 truncate">{device.device_name}</span>
                          </div>
                        </div>
                      ))}
                      
                      {/* ✅ 重新扫描按钮 */}
                      <FocusItem focusKey="btn-rescan-device" onEnter={scan}>
                        {({ ref, focused }) => (
                          <button 
                            ref={ref as any} onClick={scan} disabled={isScanning}
                            className={`flex items-center justify-center gap-1.5 w-full mt-1 p-2 rounded-sm text-sm transition-all outline-none border-[2px] border-dashed
                              ${focused ? 'border-white text-white bg-white/10' : 'border-white/10 text-gray-400 bg-white/5 hover:text-white hover:border-white/30'}
                              ${isScanning ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isScanning ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} 
                            {isScanning ? '雷达扫描中...' : '扫描局域网设备'}
                          </button>
                        )}
                      </FocusItem>
                    </div>
                  </div>
                </div>

                {/* ✅ 真实：局域网玩家/设备大盘 */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">
                    <Users size={14} className="mr-2"/> 雷达发现的设备 ({discovered.length})
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {discovered.length === 0 && !isScanning && (
                      <div className="text-sm text-gray-500 border-2 border-dashed border-[#313233] p-4 text-center">
                        局域网内空空如也。
                      </div>
                    )}
                    
                    {discovered.map(dev => {
                      const isExpanded = expandedPlayerId === dev.device_id;
                      // 如果这个扫出来的设备已经在我的信任列表里了，那他就是我的好友！
                      const isFriend = trusted.some(t => t.device_id === dev.device_id);
                      
                      return (
                        <div key={dev.device_id} className={`relative flex flex-col border-[2px] rounded-sm overflow-hidden transition-all duration-200 border-[#313233] bg-[#2A2A2C]`}>
                          <FocusItem focusKey={`lan-player-${dev.device_id}`} onEnter={() => setExpandedPlayerId(isExpanded ? null : dev.device_id)}>
                            {({ ref, focused }) => (
                              <button 
                                ref={ref as any}
                                onClick={() => setExpandedPlayerId(isExpanded ? null : dev.device_id)}
                                className={`relative z-10 flex items-center p-3 outline-none transition-colors ${focused ? 'bg-white/10' : 'hover:bg-white/5'}`}
                              >
                                <div className={`w-10 h-10 bg-black/50 border-[2px] mr-3 flex-shrink-0 border-[#313233]`}>
                                  {/* 给所有外来设备默认展示史蒂夫头像 */}
                                  <img src="https://cravatar.cn/avatars/8667ba71b85a4004af54457a9734eed7?size=64&overlay=true" className="w-full h-full rendering-pixelated object-cover" alt="lan-avatar"/>
                                </div>
                                <div className="flex-1 flex flex-col text-left min-w-0">
                                  <span className={`font-bold truncate text-white`}>{dev.device_name}</span>
                                  <span className="text-gray-400 text-[10px]">{dev.ip}:{dev.port}</span>
                                </div>
                                <div className="text-gray-400 ml-2">
                                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                              </button>
                            )}
                          </FocusItem>

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
                                        onClick={() => sendTrustRequest(dev.ip, dev.port)}
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
                    })}
                  </div>
                </div>
              </div>

              {/* 右侧：留空隐藏的预留区 */}
              <div className="flex-1 hidden sm:flex flex-col min-w-0 border-[2px] border-dashed border-[#313233] rounded-sm items-center justify-center bg-[#1E1E1F]/50">
                <div className="text-gray-500 font-minecraft text-center flex flex-col items-center">
                  <span className="text-4xl mb-4 opacity-50">🚧</span>
                  <p className="text-lg mb-2 text-gray-400">Pro 核心功能区</p>
                  <p className="text-xs opacity-60 max-w-[200px] leading-relaxed">此区域已预留给后期的实例共享、跨设备存档同步与数据分析面板。</p>
                </div>
              </div>

            </div>
          </motion.div>
        </FocusBoundary>
      )}
    </AnimatePresence>
  );
};