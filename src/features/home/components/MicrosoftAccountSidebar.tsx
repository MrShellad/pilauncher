// src/features/home/components/modals/MicrosoftAccountSidebar.tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { 
  Monitor, Laptop, Smartphone, Gamepad2, Plus, // 设备相关图标
  UserPlus, Ban, Link, Send, Trash2, ChevronDown, ChevronUp, Users // 局域网相关图标
} from 'lucide-react';

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useAccountStore } from '../../../store/useAccountStore';

interface MicrosoftAccountSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MicrosoftAccountSidebar: React.FC<MicrosoftAccountSidebarProps> = ({ isOpen, onClose }) => {
  const { accounts, activeAccountId } = useAccountStore();
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  
  // 局域网玩家列表的展开状态管理
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  // ✅ 核心修改：不再限制只有 Microsoft 账号能打开，获取当前所有类型的活动账号
  const currentAccount = accounts.find(acc => acc.uuid === activeAccountId);
  // 判断是否为正版用户
  const isPremium = currentAccount?.type?.toLowerCase() === 'microsoft';

  // 获取高清头像
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

  // ================= 模拟数据区 =================

  // 模拟设备数据
  const mockDevices = [
    { id: 'dev-1', name: 'Desktop-HANZO', type: 'windows', isCurrent: true },
    { id: 'dev-2', name: 'Pi-SteamDeck', type: 'linux', isCurrent: false },
    { id: 'dev-3', name: 'MacBook Pro 14', type: 'mac', isCurrent: false },
  ];

  // 模拟局域网玩家数据
  const mockLanPlayers = [
    { 
      id: 'lan-1', name: 'Notch_Official', isPremium: true, isFriend: true, 
      bg: 'https://images.unsplash.com/photo-1623934199716-ee2820b9d07c?q=80&w=600&auto=format&fit=crop',
      avatar: 'https://cravatar.cn/avatars/069a79f444e94726a5befca90e38aaf5?size=64&overlay=true'
    },
    { 
      id: 'lan-2', name: 'Steve_Player_1', isPremium: false, isFriend: false, 
      bg: '',
      avatar: 'https://cravatar.cn/avatars/8667ba71b85a4004af54457a9734eed7?size=64&overlay=true'
    },
  ];

  // ================= 工具函数 =================

  // 渲染不同系统的设备图标
  const renderDeviceIcon = (type: string) => {
    switch(type) {
      case 'windows': return <Monitor size={16} className="text-blue-400" />;
      case 'linux': return <Gamepad2 size={16} className="text-orange-400" />; // Linux 暂用手柄代替 Deck
      case 'mac': return <Laptop size={16} className="text-gray-300" />;
      default: return <Smartphone size={16} className="text-green-400" />;
    }
  };

  // 支持视频/图片的背景渲染引擎
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
          {/* ✅ 背景遮罩：点击关闭侧边栏 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm"
          />

          {/* ✅ 侧边栏主体：固定左侧滑出 */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 left-0 h-full w-full max-w-[750px] bg-[#1E1E1F] z-[101] shadow-2xl border-r-[2px] border-[#2A2A2C] flex flex-col font-minecraft select-none"
          >
            {/* ✅ 移除了顶部的 X 关闭按钮 */}

            {/* 内容区：左右分栏 */}
            <div className="flex-1 flex flex-col sm:flex-row gap-6 p-6 pt-10 overflow-y-auto custom-scrollbar">
              
              {/* ================= 左侧：玩家档案与社交 ================= */}
              <div className="w-full sm:w-[320px] flex flex-col flex-shrink-0 gap-6">
                
                {/* 1. 核心用户信息卡片 */}
                <div className={`
                  relative flex flex-col border-[2px] shadow-xl overflow-hidden rounded-sm
                  ${isPremium ? 'border-[#EAB308] bg-[#1A1A1C]' : 'border-[#313233] bg-[#2A2A2C]'}
                `}>
                  {/* 正版专属动态/静态背景 */}
                  {isPremium && (
                    <div className="absolute inset-0 z-0 overflow-hidden">
                      {/* ✅ 支持 webm, webp, gif 格式扩展 */}
                      {renderMediaBackground('/src/assets/home/account/bg.jpg')}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#141415] via-[#141415]/80 to-transparent" />
                    </div>
                  )}

                  {/* 身份头衔与头像 */}
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

                  {/* 在线设备卡片区域 */}
                  <div className="relative z-10 p-4 bg-black/20">
                    <div className="flex items-center text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">
                      <Monitor size={14} className="mr-2"/> 当前信任设备
                    </div>
                    <div className="flex flex-col gap-2">
                      {mockDevices.map(device => (
                        <div key={device.id} className="flex items-center justify-between bg-white/5 border border-white/5 p-2 rounded-sm hover:bg-white/10 transition-colors">
                          <div className="flex items-center gap-2.5">
                            {renderDeviceIcon(device.type)}
                            <span className="text-sm text-gray-200">{device.name}</span>
                          </div>
                          {device.isCurrent && (
                            <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-sm border border-green-500/30">本机</span>
                          )}
                        </div>
                      ))}
                      
                      {/* 添加设备按钮 */}
                      <FocusItem focusKey="btn-add-device">
                        {({ ref, focused }) => (
                          <button 
                            ref={ref as any}
                            className={`
                              flex items-center justify-center gap-1.5 w-full mt-1 p-2 rounded-sm text-sm transition-all outline-none border-[2px] border-dashed
                              ${focused ? 'border-white text-white bg-white/10' : 'border-white/10 text-gray-400 bg-white/5 hover:text-white hover:border-white/30'}
                            `}
                          >
                            <Plus size={14} /> 添加受信任设备
                          </button>
                        )}
                      </FocusItem>
                    </div>
                  </div>
                </div>

                {/* 2. 局域网玩家列表 */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">
                    <Users size={14} className="mr-2"/> 局域网内发现的玩家
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {mockLanPlayers.map(player => {
                      const isExpanded = expandedPlayerId === player.id;
                      
                      return (
                        <div key={player.id} className={`relative flex flex-col border-[2px] rounded-sm overflow-hidden transition-all duration-200 ${player.isPremium ? 'border-[#EAB308]/60 bg-[#1A1A1C]' : 'border-[#313233] bg-[#2A2A2C]'}`}>
                          
                          {/* 玩家独立名片背景 */}
                          {player.isPremium && player.bg && (
                            <div className="absolute inset-0 z-0">
                              <img src={player.bg} className="w-full h-full object-cover opacity-30 mix-blend-screen" alt="player-bg"/>
                            </div>
                          )}

                          {/* 玩家卡片头部 (点击展开/折叠) */}
                          <FocusItem focusKey={`lan-player-${player.id}`} onEnter={() => setExpandedPlayerId(isExpanded ? null : player.id)}>
                            {({ ref, focused }) => (
                              <button 
                                ref={ref as any}
                                onClick={() => setExpandedPlayerId(isExpanded ? null : player.id)}
                                className={`relative z-10 flex items-center p-3 outline-none transition-colors ${focused ? 'bg-white/10' : 'hover:bg-white/5'}`}
                              >
                                <div className={`w-10 h-10 bg-black/50 border-[2px] mr-3 flex-shrink-0 ${player.isPremium ? 'border-[#EAB308]' : 'border-[#313233]'}`}>
                                  <img src={player.avatar} className="w-full h-full rendering-pixelated object-cover" alt="lan-avatar"/>
                                </div>
                                <div className="flex-1 flex flex-col text-left min-w-0">
                                  <span className={`font-bold truncate ${player.isPremium ? 'text-[#FBBF24]' : 'text-white'}`}>{player.name}</span>
                                  <span className="text-gray-400 text-[10px]">{player.isPremium ? 'Premium Player' : 'Offline Player'}</span>
                                </div>
                                <div className="text-gray-400 ml-2">
                                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                              </button>
                            )}
                          </FocusItem>

                          {/* 玩家操作面板 (折叠内容) */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="relative z-10 bg-black/40 border-t border-white/10"
                              >
                                <div className="flex gap-2 p-2">
                                  {player.isFriend ? (
                                    <>
                                      <button className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 p-2 flex justify-center items-center text-xs rounded-sm transition-colors"><Link size={14} className="mr-1.5"/> 联机</button>
                                      <button className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 p-2 flex justify-center items-center text-xs rounded-sm transition-colors"><Send size={14} className="mr-1.5"/> 传输</button>
                                      <button className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 p-2 flex justify-center items-center text-xs rounded-sm transition-colors"><Trash2 size={14} className="mr-1.5"/> 删除</button>
                                    </>
                                  ) : (
                                    <>
                                      <button className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 p-2 flex justify-center items-center text-xs rounded-sm transition-colors"><UserPlus size={14} className="mr-1.5"/> 添加好友</button>
                                      <button className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 p-2 flex justify-center items-center text-xs rounded-sm transition-colors"><Ban size={14} className="mr-1.5"/> 屏蔽</button>
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

              {/* ================= 右侧：留空隐藏的预留区 ================= */}
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