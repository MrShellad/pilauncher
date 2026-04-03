// src/features/home/components/AccountSliderBar/MicrosoftAccountSidebar.tsx
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { UserPlus, Send, Loader2, ArrowLeft } from 'lucide-react'; 

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useAccountStore } from '../../../store/useAccountStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { useLan } from '../../../hooks/useLan';
import { useInputAction } from '../../../ui/focus/InputDriver';

import { UserProfileCard } from './AccountSliderBar/UserProfileCard';
import { LanRadar } from './AccountSliderBar/LanRadar';
import defaultAvatar from '../../../assets/home/account/128.png';
import { setFocus, getCurrentFocusKey, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation';
import { OreModal } from '../../../ui/primitives/OreModal'; 
import { OreButton } from '../../../ui/primitives/OreButton'; 

interface MicrosoftAccountSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DiscoveredDevice {
  device_id: string;
  device_name: string;
  ip: string;
  port: number;
}

export const MicrosoftAccountSidebar: React.FC<MicrosoftAccountSidebarProps> = ({ isOpen, onClose }) => {
  const { accounts, activeAccountId, setActiveAccount } = useAccountStore();
  const { settings } = useSettingsStore();
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  const { 
    discovered, trusted, isScanning, isRequesting, 
    incomingRequest, resolveTrustRequest, 
    scan, sendTrustRequest, fetchTrusted,
    removeTrustedDevice
  } = useLan();

  const currentAccount = accounts.find(acc => acc.uuid === activeAccountId);
  const isPremium = currentAccount?.type?.toLowerCase() === 'microsoft';
  const hasPremiumAnywhere = accounts.some(acc => acc.type?.toLowerCase() === 'microsoft');

  // 核心功能区：传输面板状态
  const [transferTarget, setTransferTarget] = useState<DiscoveredDevice | null>(null);
  const [transferType, setTransferType] = useState<'instance' | 'save'>('instance');
  const [instances, setInstances] = useState<{id: string, name: string}[]>([]);
  const [saves, setSaves] = useState<string[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [selectedSave, setSelectedSave] = useState<string>('');
  const [isPushing, setIsPushing] = useState(false);

  const handleCycleAccount = () => {
    if (accounts.length <= 1) return;
    const currentIndex = accounts.findIndex(acc => acc.uuid === activeAccountId);
    const nextIndex = (currentIndex + 1) % accounts.length;
    setActiveAccount(accounts[nextIndex].uuid);
  };

  // 记录打开侧边栏前的焦点，关闭时恢复
  const lastFocusRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = getCurrentFocusKey();
      if (current && current !== 'SN:ROOT') {
        lastFocusRef.current = current;
      }
    }
  }, [isOpen]);

  const handleClose = () => {
    onClose();
    const last = lastFocusRef.current;
    const fallback = 'btn-profile';
    const target = last && doesFocusableExist(last) ? last : (doesFocusableExist(fallback) ? fallback : null);
    if (target) {
      setTimeout(() => setFocus(target), 80);
    }
  };

  useInputAction('CANCEL', () => {
    if (isOpen) {
      handleClose();
    }
  });

  useEffect(() => {
    if (isOpen) {
      fetchTrusted();
      scan();
      const timer = window.setInterval(() => {
        scan();
      }, 5000);
      return () => {
        window.clearInterval(timer);
      };
    } else {
      setTransferTarget(null);
    }
  }, [isOpen, fetchTrusted, scan]);

  // 推送自己的 MC 身份给本地 Rust 后端
  useEffect(() => {
    if (currentAccount && settings.general.deviceId) {
      invoke('update_lan_device_info', {
        info: {
          device_id: settings.general.deviceId,
          device_name: settings.general.deviceName,
          username: currentAccount.name,
          user_uuid: currentAccount.uuid,
          is_premium: isPremium,
          is_donor: false, 
          launcher_version: "1.0.0",
          instance_name: null,
          instance_id: null,
          bg_url: "/device/bg"
        },
        localBgPath: "" 
      }).catch(console.error);
    }
  }, [currentAccount, settings.general.deviceId, settings.general.deviceName, isPremium]);

  useEffect(() => {
    if (currentAccount) {
      const fetchAvatar = async () => {
        try {
          const localPath = await invoke<string>('get_or_fetch_account_avatar', { 
            uuid: currentAccount.uuid, 
            username: currentAccount.name 
          });
          const cacheBuster = currentAccount.skinUrl?.split('?t=')[1] || 'init';
          setAvatarSrc(`${convertFileSrc(localPath)}?t=${cacheBuster}`);
        } catch (e) {
          setAvatarSrc(defaultAvatar);
        }
      };
      fetchAvatar();
    }
  }, [currentAccount]);

  // 传输面板逻辑
  const handleSelectTrustedDevice = async (device: DiscoveredDevice | null) => {
    setTransferTarget(device);
    if (device) {
      try {
        const list = await invoke<any[]>('get_local_instances');
        setInstances(list);
        if (list.length > 0) setSelectedInstance(list[0].id);
      } catch (e) {}
    }
  };

  const handleFetchSaves = async (instanceId: string) => {
    setSelectedInstance(instanceId);
    try {
      const saveList = await invoke<string[]>('get_instance_saves', { instanceId });
      setSaves(saveList);
      if (saveList.length > 0) setSelectedSave(saveList[0]);
    } catch (e) {}
  };

  const executePush = async () => {
    if (!transferTarget || !selectedInstance) return;
    setIsPushing(true);
    try {
      await invoke('push_to_device', {
        targetIp: transferTarget.ip,
        targetPort: transferTarget.port,
        transferType: transferType,
        targetId: selectedInstance,
        saveName: transferType === 'save' ? selectedSave : null
      });
      alert("推送成功！");
      setTransferTarget(null);
    } catch (e) {
      alert(`推送失败: ${e}`);
    } finally {
      setIsPushing(false);
    }
  };

  if (!currentAccount) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <FocusBoundary id="account-sidebar-boundary" trapFocus={true} onEscape={handleClose} className="fixed inset-0 z-[100] flex outline-none">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
              onClick={handleClose}
            />

            <motion.div 
              initial={{ x: '-100%', opacity: 0 }} 
              animate={{ x: 0, opacity: 1 }} 
              exit={{ x: '-100%', opacity: 0 }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onAnimationComplete={() => setFocus('account-sidebar-boundary')}
              className="absolute left-0 top-0 bottom-0 w-full md:w-[70vw] lg:w-[55vw] xl:w-[900px] bg-[#18181B] border-r-2 border-[#2A2A2C] shadow-2xl flex flex-col"
            >
              <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-6">
                
                <div className="flex-1 flex flex-col sm:flex-row gap-6 mb-6">
                  {/* 左侧：用户信息与信任雷达 */}
                  <div className="w-full sm:w-[320px] flex flex-col flex-shrink-0 gap-6">
                    <UserProfileCard 
                      name={currentAccount.name} 
                      isPremium={isPremium} 
                      hasPremiumAnywhere={hasPremiumAnywhere}
                      accountsCount={accounts.length}
                      avatarSrc={avatarSrc}
                      trusted={trusted}
                      onScan={scan}
                      isScanning={isScanning}
                      onCycleAccount={handleCycleAccount}
                      discovered={discovered}
                      onRemoveTrust={removeTrustedDevice}
                      onSelectTrustedDevice={handleSelectTrustedDevice}
                    />
                    
                    <LanRadar 
                      discovered={discovered} 
                      trusted={trusted} 
                      isScanning={isScanning} 
                      isRequesting={isRequesting} 
                      onRequestTrust={sendTrustRequest} 
                    />
                  </div>

                  {/* 右侧：核心功能区 — 传输面板 */}
                  <div className="flex-1 hidden sm:flex flex-col min-w-0">
                    <AnimatePresence mode="wait">
                      {transferTarget ? (
                        <motion.div 
                          key="transfer-panel"
                          initial={{ opacity: 0, y: 10 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          exit={{ opacity: 0, y: -10 }}
                          className="flex flex-col h-full border-[2px] border-[#313233] bg-[#1E1E1F] rounded-sm overflow-hidden"
                        >
                          {/* 标题栏 */}
                          <div className="p-4 border-b-2 border-[#2A2A2C] flex justify-between items-center bg-[#141415]">
                            <div>
                              <h3 className="text-white text-base font-bold flex items-center font-minecraft">
                                <Send size={16} className="mr-2 text-blue-400" /> 隔空投送
                              </h3>
                              <span className="text-xs text-gray-400 mt-0.5 block">目标设备: {transferTarget.device_name} ({transferTarget.ip})</span>
                            </div>
                            <FocusItem focusKey="btn-back-transfer" onEnter={() => setTransferTarget(null)}>
                              {({ ref, focused }) => (
                                <button ref={ref as any} onClick={() => setTransferTarget(null)} className={`p-1.5 hover:bg-white/10 text-gray-400 rounded-sm transition-colors outline-none ${focused ? 'ring-2 ring-white' : ''}`}>
                                  <ArrowLeft size={18}/>
                                </button>
                              )}
                            </FocusItem>
                          </div>

                          {/* 传输类型切换 */}
                          <div className="flex p-3 gap-2 bg-[#1A1A1B]">
                            <FocusItem focusKey="btn-transfer-type-instance">
                              {({ ref, focused }) => (
                                <button ref={ref as any} onClick={() => setTransferType('instance')} className={`flex-1 py-2 text-sm border-b-2 transition-colors outline-none font-minecraft ${transferType === 'instance' ? 'border-blue-400 text-blue-400' : 'border-transparent text-gray-500'} ${focused ? 'bg-white/5' : ''}`}>打包实例</button>
                              )}
                            </FocusItem>
                            <FocusItem focusKey="btn-transfer-type-save">
                              {({ ref, focused }) => (
                                <button ref={ref as any} onClick={() => setTransferType('save')} className={`flex-1 py-2 text-sm border-b-2 transition-colors outline-none font-minecraft ${transferType === 'save' ? 'border-green-400 text-green-400' : 'border-transparent text-gray-500'} ${focused ? 'bg-white/5' : ''}`}>提取存档</button>
                              )}
                            </FocusItem>
                          </div>

                          {/* 选择区域 */}
                          <div className="p-5 flex-1 overflow-y-auto">
                            <label className="text-xs text-gray-400 mb-2 block font-minecraft">{transferType === 'instance' ? '选择要发送的实例' : '从实例中提取'}</label>
                            <FocusItem focusKey="select-transfer-inst">
                              {({ ref, focused }) => (
                                <select ref={ref as any} className={`w-full bg-[#141415] border-2 border-[#2A2A2C] text-white p-2 rounded-sm outline-none mb-4 transition-all font-minecraft ${focused ? 'ring-2 ring-blue-500' : ''}`} value={selectedInstance} onChange={(e) => transferType === 'save' ? handleFetchSaves(e.target.value) : setSelectedInstance(e.target.value)}>
                                  <option value="" disabled>-- 请选择 --</option>
                                  {instances.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                                </select>
                              )}
                            </FocusItem>

                            {transferType === 'save' && (
                              <>
                                <label className="text-xs text-gray-400 mb-2 block mt-2 font-minecraft">选择世界存档</label>
                                <FocusItem focusKey="select-transfer-save">
                                  {({ ref, focused }) => (
                                    <select ref={ref as any} className={`w-full bg-[#141415] border-2 border-[#2A2A2C] text-white p-2 rounded-sm outline-none transition-all font-minecraft ${focused ? 'ring-2 ring-green-500' : ''}`} value={selectedSave} onChange={(e) => setSelectedSave(e.target.value)}>
                                      <option value="" disabled>-- 请选择 --</option>
                                      {saves.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                  )}
                                </FocusItem>
                              </>
                            )}
                          </div>

                          {/* 发送按钮 */}
                          <div className="p-4 border-t-2 border-[#2A2A2C] bg-[#141415]">
                            <OreButton onClick={executePush} disabled={isPushing || !selectedInstance || (transferType === 'save' && !selectedSave)} variant="primary" className="w-full flex justify-center !h-11">
                              {isPushing ? <Loader2 size={16} className="animate-spin mr-2" /> : <Send size={16} className="mr-2" />}
                              {isPushing ? '打包并发送中...' : '开始传送'}
                            </OreButton>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div 
                          key="placeholder"
                          initial={{ opacity: 0 }} 
                          animate={{ opacity: 1 }} 
                          exit={{ opacity: 0 }}
                          className="flex flex-col h-full border-[2px] border-dashed border-[#313233] rounded-sm items-center justify-center bg-[#1E1E1F]/50"
                        >
                          <div className="text-gray-500 font-minecraft text-center flex flex-col items-center">
                            <span className="text-4xl mb-4 opacity-50">📡</span>
                            <p className="text-lg mb-2 text-gray-400">传输控制台</p>
                            <p className="text-xs opacity-60 max-w-[200px] leading-relaxed">点击左侧信任设备列表中的在线设备，即可在此处进行实例或存档的跨设备传输。</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

              </div>
            </motion.div>
          </FocusBoundary>
        )}
      </AnimatePresence>

      <OreModal isOpen={!!incomingRequest} onClose={() => resolveTrustRequest(false)} title="✨ 收到好友请求" closeOnOutsideClick={false}>
        <div className="p-6 flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-500/20 border-2 border-blue-500/50 rounded-full flex items-center justify-center mb-4">
            <UserPlus size={28} className="text-blue-400" />
          </div>
          <p className="text-white text-lg font-minecraft mb-2">
            设备 <strong className="text-ore-green">{incomingRequest?.device_name}</strong> 请求与您建立局域网信任
          </p>
          <p className="text-gray-400 text-xs mb-8 text-center max-w-xs leading-relaxed">
            同意后，双方将可以跨端互传游戏实例与存档，并相互查看实时游戏状态。请确保这是您认识的设备。
          </p>
          <div className="flex w-full gap-4">
            <OreButton className="flex-1 !h-12" variant="secondary" onClick={() => resolveTrustRequest(false)}>拒绝并忽略</OreButton>
            <OreButton className="flex-1 !h-12" variant="primary" onClick={() => resolveTrustRequest(true)}>接受并信任</OreButton>
          </div>
        </div>
      </OreModal>
    </>
  );
};
