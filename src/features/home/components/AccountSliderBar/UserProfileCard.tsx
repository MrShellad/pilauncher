// src/features/home/components/AccountSliderBar/UserProfileCard.tsx
import React from 'react';
import { Monitor, Laptop, Smartphone, Gamepad2, Plus, Loader2, RefreshCcw } from 'lucide-react';
import { FocusItem } from '../../../../ui/focus/FocusItem';

interface TrustedDevice {
  device_id: string;
  device_name: string;
}

interface UserProfileCardProps {
  name: string;
  isPremium: boolean;
  hasPremiumAnywhere: boolean; // ✅ 新增：用于判断是否享有继承特权
  accountsCount: number;       // ✅ 新增：用于判断是否显示切换按钮
  avatarSrc: string | null;
  trusted: TrustedDevice[];
  onScan: () => void;
  isScanning: boolean;
  onCycleAccount: () => void;  // ✅ 新增：一键循环切换账号
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({ 
  name, isPremium, hasPremiumAnywhere, accountsCount, avatarSrc, trusted, onScan, isScanning, onCycleAccount
}) => {

  const renderMediaBackground = (src: string) => {
    if (src.endsWith('.webm') || src.endsWith('.mp4')) {
      return <video src={src} autoPlay loop muted className="w-full h-full object-cover opacity-60 mix-blend-screen" />;
    }
    return <img src={src} className="w-full h-full object-cover opacity-60 mix-blend-screen" alt="background" />;
  };

  const renderDeviceIcon = (deviceName: string) => {
    const lower = deviceName.toLowerCase();
    if (lower.includes('deck') || lower.includes('steam')) return <Gamepad2 size={16} className="text-orange-400" />;
    if (lower.includes('mac') || lower.includes('book')) return <Laptop size={16} className="text-gray-300" />;
    if (lower.includes('phone') || lower.includes('pad')) return <Smartphone size={16} className="text-green-400" />;
    return <Monitor size={16} className="text-blue-400" />;
  };

  // ✅ 核心样式降级与特权继承逻辑
  const showMediaBg = isPremium || hasPremiumAnywhere;
  
  let wrapperClass = 'border-[#313233] bg-[#2A2A2C]'; // 默认离线：深灰边框、纯色底
  let avatarBorderClass = 'border-black/50';
  let nameColorClass = 'text-white';

  if (isPremium) {
    // 纯正版：黄金边框、外发光、金色名字
    wrapperClass = 'border-[#EAB308] bg-[#1A1A1C] shadow-[0_0_15px_rgba(234,179,8,0.15)]';
    avatarBorderClass = 'border-[#EAB308]';
    nameColorClass = 'text-[#FBBF24]';
  } else if (hasPremiumAnywhere) {
    // 离线账号 + 继承特权：银色边框、继承壁纸
    wrapperClass = 'border-[#D1D5DB] bg-[#1A1A1C] shadow-[0_0_15px_rgba(209,213,219,0.15)]';
    avatarBorderClass = 'border-[#D1D5DB]';
    nameColorClass = 'text-white';
  }

  return (
    <div className={`relative flex flex-col border-[2px] overflow-hidden rounded-sm transition-colors duration-500 ${wrapperClass}`}>
      
      {/* 统一壁纸层：正版或特权继承者可见 */}
      {showMediaBg && (
        <div className="absolute inset-0 z-0 overflow-hidden">
          {renderMediaBackground('/src/assets/home/account/bg.jpg')}
          <div className="absolute inset-0 bg-gradient-to-t from-[#141415] via-[#141415]/80 to-transparent" />
        </div>
      )}

      {/* ✅ 账号切换按钮 (仅当账号数量 > 1 时显示) */}
      {accountsCount > 1 && (
        <div className="absolute top-3 right-3 z-20">
          <FocusItem focusKey="btn-cycle-account" onEnter={onCycleAccount}>
            {({ ref, focused }) => (
              <button 
                ref={ref as any} 
                onClick={onCycleAccount}
                title="切换账号"
                className={`p-1.5 rounded-sm transition-all outline-none backdrop-blur-md ${focused ? 'bg-white text-black ring-2 ring-white/50' : 'bg-black/40 text-gray-300 hover:text-white hover:bg-black/60'}`}
              >
                <RefreshCcw size={16} className={focused ? 'animate-spin-slow' : ''} />
              </button>
            )}
          </FocusItem>
        </div>
      )}

      {/* 上半部分：身份头衔与头像 */}
      <div className="relative z-10 p-5 pb-4 border-b border-white/10 mt-2">
        <div className="flex items-start mb-1 pr-8">
          <div className={`relative w-16 h-16 bg-[#111112] border-[2px] mr-4 flex-shrink-0 transition-colors duration-500 ${avatarBorderClass}`}>
            <img 
              src={avatarSrc || `https://cravatar.cn/avatars/8667ba71b85a4004af54457a9734eed7?overlay=true&size=64`} 
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "https://cravatar.cn/avatars/8667ba71b85a4004af54457a9734eed7?overlay=true&size=64"; }}
              className="w-full h-full rendering-pixelated object-cover" 
              alt="Avatar" 
            />
            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#3C8527] border-[2px] border-[#2A2A2C] rounded-full" title="在线" />
          </div>
          <div className="flex flex-col min-w-0 flex-1 pt-1">
            <span className={`text-xl font-bold truncate tracking-wider drop-shadow-md transition-colors duration-500 ${nameColorClass}`}>
              {name}
            </span>
            <span className="text-gray-400 text-xs truncate mt-0.5">
              {isPremium ? 'Premium (Microsoft)' : (hasPremiumAnywhere ? 'Offline (Premium Benefits)' : 'Offline Account')}
            </span>
          </div>
        </div>
      </div>

      {/* 下半部分：在线信任设备 */}
      <div className="relative z-10 p-4 bg-black/20">
        <div className="flex items-center text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">
  <Monitor size={14} className="mr-2"/> 信任的好友与设备 ({trusted.length})
</div>
        
        <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
          {trusted.length === 0 && <div className="text-xs text-gray-500 text-center py-2">暂无信任的其他设备</div>}
          
          {trusted.map(device => (
            <div key={device.device_id} className="flex items-center justify-between bg-white/5 border border-white/5 p-2 rounded-sm hover:bg-white/10 transition-colors backdrop-blur-sm">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                {renderDeviceIcon(device.device_name)}
                <span className="text-sm text-gray-200 truncate">{device.device_name}</span>
              </div>
            </div>
          ))}
          
          <FocusItem focusKey="btn-rescan-device" onEnter={onScan}>
            {({ ref, focused }) => (
              <button 
                ref={ref as any} onClick={onScan} disabled={isScanning}
                className={`flex items-center justify-center gap-1.5 w-full mt-1 p-2 rounded-sm text-sm transition-all outline-none border-[2px] border-dashed backdrop-blur-sm
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
  );
};