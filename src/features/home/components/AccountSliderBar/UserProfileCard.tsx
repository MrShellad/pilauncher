// src/features/home/components/AccountSliderBar/UserProfileCard.tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Monitor, Laptop, Smartphone, Gamepad2, Loader2, RefreshCcw, Send, CheckCircle, X, Trash2 } from 'lucide-react';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';

interface DiscoveredDevice {
  device_id: string;
  device_name: string;
  ip: string;
  port: number;
}

interface TrustedDevice {
  device_id: string;
  device_name: string;
}

interface UserProfileCardProps {
  name: string;
  isPremium: boolean;
  hasPremiumAnywhere: boolean; 
  accountsCount: number;       
  avatarSrc: string | null;
  trusted: TrustedDevice[];
  discovered: DiscoveredDevice[];
  onScan: () => void;
  isScanning: boolean;
  onCycleAccount: () => void;
  onRemoveTrust: (deviceId: string) => void;
  onSelectTrustedDevice: (device: DiscoveredDevice | null) => void;
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({ 
  name, isPremium, hasPremiumAnywhere, accountsCount, avatarSrc, trusted, discovered, onScan, isScanning, onCycleAccount, onRemoveTrust, onSelectTrustedDevice
}) => {
  // 接收弹窗状态
  const [incomingData, setIncomingData] = useState<any>(null);
  const [receiveTargetInstance, setReceiveTargetInstance] = useState<string>('');
  const [isApplying, setIsApplying] = useState(false);
  const [instances, setInstances] = useState<{id: string, name: string}[]>([]);

  // 监听底层发来的文件接收事件
  useEffect(() => {
    const unlisten = listen('transfer_received', (event) => {
      setIncomingData(event.payload);
      invoke<any[]>('get_local_instances').then(setInstances).catch(() => {});
    });
    return () => { unlisten.then(f => f()); }
  }, []);

  const executeApply = async () => {
    if (!incomingData) return;
    setIsApplying(true);
    try {
      const result = await invoke<string>('apply_received_transfer', {
        tempPath: incomingData.tempPath,
        transferType: incomingData.type,
        targetInstanceId: incomingData.type === 'save' ? receiveTargetInstance : null
      });
      
      if (result !== incomingData.name) {
        alert(`导入完成！检测到同名项目，已自动添加时间戳重命名为: ${result}`);
      } else {
        alert("导入完成！已解压并部署到对应目录。");
      }
      
      setIncomingData(null);
    } catch (e) {
      alert(`部署失败: ${e}`);
    } finally {
      setIsApplying(false);
    }
  };

  const renderDeviceIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('windows') || lower.includes('mac')) return <Laptop size={16} className="text-gray-400" />;
    if (lower.includes('steamdeck') || lower.includes('rog')) return <Gamepad2 size={16} className="text-gray-400" />;
    if (lower.includes('tv') || lower.includes('box')) return <Monitor size={16} className="text-gray-400" />;
    return <Smartphone size={16} className="text-gray-400" />;
  };

  return (
    <>
      <div className="flex flex-col border-[2px] border-[#313233] bg-[#1E1E1F] rounded-sm overflow-hidden shadow-xl">
        {/* 头像与名片区 */}
        <div className="relative h-28 w-full bg-[#111112] overflow-hidden">
          {avatarSrc ? (
             <img src={avatarSrc} className="w-full h-full object-cover opacity-60 mix-blend-screen blur-sm" />
          ) : (
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />
          )}
          <div className="absolute inset-0 flex items-end p-4 bg-gradient-to-t from-[#1E1E1F] to-transparent">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 bg-black/80 border-[2px] rounded-sm shadow-lg overflow-hidden flex-shrink-0 ${isPremium ? 'border-[#EAB308]' : 'border-[#313233]'}`}>
                <img src={avatarSrc || `https://cravatar.cn/avatars/8667ba71b85a4004af54457a9734eed7?size=64&overlay=true`} className="w-full h-full rendering-pixelated object-cover" alt="Avatar"/>
              </div>
              <div className="flex flex-col drop-shadow-md">
                <span className={`text-lg font-minecraft font-bold ${isPremium ? 'text-[#FBBF24]' : 'text-white'}`}>{name}</span>
                <span className="text-[10px] text-gray-300 flex items-center mt-0.5">
                  {hasPremiumAnywhere ? <span className="bg-[#EAB308]/20 text-[#FBBF24] border border-[#EAB308]/30 px-1.5 py-0.5 rounded-sm mr-1.5">Premium 尊享</span> : <span className="bg-white/10 text-gray-300 border border-white/10 px-1.5 py-0.5 rounded-sm mr-1.5">Offline 离线</span>}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 bg-[#1A1A1B] border-t-2 border-[#2A2A2C] flex justify-between items-center">
          <span className="text-xs text-gray-400 font-minecraft">当前活动身份</span>
          {accountsCount > 1 && (
            <OreButton variant="secondary" size="sm" onClick={onCycleAccount} className="!py-1 !px-2 !h-auto text-[10px]">
              <RefreshCcw size={12} className="mr-1" /> 切换
            </OreButton>
          )}
        </div>

        {/* 信任设备列表 — 显示设备名 */}
        <div className="flex flex-col bg-[#141415] p-3">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>授信的设备 ({trusted.length})</span>
          </div>
          
          <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
            {trusted.length === 0 && <div className="text-xs text-gray-500 text-center py-2">暂无信任的其他设备</div>}
            
            {trusted.map(device => {
              const onlineInfo = discovered.find(d => d.device_id === device.device_id);
              const isOnline = !!onlineInfo;

              return (
                <FocusItem key={device.device_id} focusKey={`trusted-${device.device_id}`} onEnter={() => isOnline && onSelectTrustedDevice(onlineInfo)}>
                  {({ ref, focused }) => (
                    <div 
                      className={`flex items-center justify-between bg-white/5 border p-2 rounded-sm transition-all text-left ${
                        isOnline ? 'border-white/10' : 'border-transparent opacity-50'
                      } ${focused && isOnline ? 'ring-2 ring-white bg-white/10' : ''}`}
                    >
                      <button
                        ref={ref as any}
                        onClick={() => isOnline && onSelectTrustedDevice(onlineInfo)}
                        className={`flex items-center gap-2.5 min-w-0 pr-2 outline-none flex-1 ${isOnline ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                      >
                        {renderDeviceIcon(device.device_name)}
                        <span className="text-sm text-gray-200 truncate">{device.device_name}</span>
                      </button>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isOnline ? (
                          <span className="text-[10px] text-ore-green flex items-center bg-ore-green/10 px-1.5 py-0.5 rounded-sm border border-ore-green/20">
                            <span className="w-1.5 h-1.5 bg-ore-green rounded-full mr-1 animate-pulse" /> 在线
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-500">离线</span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveTrust(device.device_id); }}
                          className="p-1 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded-sm transition-colors"
                          title="移除信任"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </FocusItem>
              );
            })}
          </div>
          
          <FocusItem focusKey="btn-rescan-device" onEnter={onScan}>
            {({ ref, focused }) => (
              <button 
                ref={ref as any} onClick={onScan} disabled={isScanning}
                className={`flex items-center justify-center gap-1.5 w-full mt-2 p-2 rounded-sm text-sm transition-all outline-none border-[2px] border-dashed backdrop-blur-sm
                  ${focused ? 'border-white text-white bg-white/10' : 'border-white/10 text-gray-400 bg-white/5 hover:text-white hover:border-white/30'}
                  ${isScanning ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isScanning ? <Loader2 size={14} className="animate-spin text-ore-green" /> : <RefreshCcw size={14} />}
                {isScanning ? '正在扫描局域网...' : '扫描新设备'}
              </button>
            )}
          </FocusItem>
        </div>
      </div>

      {/* ✅ 接收确认弹窗 */}
      <OreModal isOpen={!!incomingData} onClose={() => setIncomingData(null)} title="📥 收到局域网投送" closeOnOutsideClick={false}>
        {incomingData && (
          <div className="p-6 font-minecraft flex flex-col items-center">
            <div className="bg-blue-500/10 p-4 rounded-full mb-4">
              <CheckCircle size={40} className="text-blue-400" />
            </div>
            <p className="text-center text-white mb-2">
              来自 <strong>{incomingData.from}</strong> 的文件传输已送达本地。
            </p>
            <div className="bg-[#141415] border border-[#2A2A2C] p-3 w-full my-4 text-center">
              <span className="text-xs text-gray-500 block mb-1">内容类型: {incomingData.type === 'instance' ? '完整游戏实例' : '世界存档'}</span>
              <span className="text-lg text-ore-green">{incomingData.name}</span>
            </div>

            {incomingData.type === 'save' && (
              <div className="w-full mb-4 text-left">
                <label className="text-xs text-gray-400 mb-2 block">请指定接收该存档的本地实例：</label>
                <FocusItem focusKey="select-receive-instance">
                  {({ ref, focused }) => (
                    <select ref={ref as any} className={`w-full bg-[#141415] border-2 border-[#2A2A2C] text-white p-2 rounded-sm outline-none transition-all ${focused ? 'ring-2 ring-white' : ''}`} value={receiveTargetInstance} onChange={(e) => setReceiveTargetInstance(e.target.value)}>
                      <option value="" disabled>-- 选择本地实例 --</option>
                      {instances.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                    </select>
                  )}
                </FocusItem>
              </div>
            )}

            <div className="flex gap-4 w-full mt-4">
              <OreButton className="flex-1" variant="secondary" onClick={() => setIncomingData(null)}>拒绝并丢弃</OreButton>
              <OreButton className="flex-1 flex justify-center" variant="primary" onClick={executeApply} disabled={isApplying || (incomingData.type === 'save' && !receiveTargetInstance)}>
                {isApplying ? <Loader2 size={16} className="animate-spin mr-2"/> : null}
                {isApplying ? '正在解压部署...' : '接收并解压'}
              </OreButton>
            </div>
          </div>
        )}
      </OreModal>
    </>
  );
};