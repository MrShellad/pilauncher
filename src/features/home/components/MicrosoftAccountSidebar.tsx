// src/features/home/components/AccountSliderBar/MicrosoftAccountSidebar.tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { UserPlus } from 'lucide-react'; 

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { useAccountStore } from '../../../store/useAccountStore';
import { useSettingsStore } from '../../../store/useSettingsStore'; // ✅ 引入设置库获取设备信息
import { useLan } from '../../../hooks/useLan';

import { UserProfileCard } from './AccountSliderBar/UserProfileCard';
import { LanRadar } from './AccountSliderBar/LanRadar';
import defaultAvatar from '../../../assets/home/account/128.png';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { OreModal } from '../../../ui/primitives/OreModal'; 
import { OreButton } from '../../../ui/primitives/OreButton'; 

interface MicrosoftAccountSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MicrosoftAccountSidebar: React.FC<MicrosoftAccountSidebarProps> = ({ isOpen, onClose }) => {
  const { accounts, activeAccountId, setActiveAccount } = useAccountStore();
  const { settings } = useSettingsStore(); // ✅ 获取本机的 deviceId 和 deviceName
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  const { 
    discovered, trusted, isScanning, isRequesting, 
    incomingRequest, resolveTrustRequest, 
    scan, sendTrustRequest, fetchTrusted 
  } = useLan();

  const currentAccount = accounts.find(acc => acc.uuid === activeAccountId);
  const isPremium = currentAccount?.type?.toLowerCase() === 'microsoft';
  const hasPremiumAnywhere = accounts.some(acc => acc.type?.toLowerCase() === 'microsoft');

  const handleCycleAccount = () => {
    if (accounts.length <= 1) return;
    const currentIndex = accounts.findIndex(acc => acc.uuid === activeAccountId);
    const nextIndex = (currentIndex + 1) % accounts.length;
    setActiveAccount(accounts[nextIndex].uuid);
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setFocus('account-sidebar-boundary'), 100);
      fetchTrusted();
      scan();
    }
  }, [isOpen, fetchTrusted, scan]);

  // ✅ 核心修复：当当前账号改变时，主动将自己的 MC 身份推送给本地 Rust 后端！
  // 这样局域网内的其他设备扫描到你时，就能拿到你的头像和真实玩家名了。
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

  if (!currentAccount) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <FocusBoundary id="account-sidebar-boundary" trapFocus={true} onEscape={onClose} className="fixed inset-0 z-[100] flex outline-none">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
              onClick={onClose}
            />

            <motion.div 
              initial={{ x: '-100%', opacity: 0 }} 
              animate={{ x: 0, opacity: 1 }} 
              exit={{ x: '-100%', opacity: 0 }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
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
                    />
                    
                    <LanRadar 
                      discovered={discovered} 
                      trusted={trusted} 
                      isScanning={isScanning} 
                      isRequesting={isRequesting} 
                      onRequestTrust={sendTrustRequest} 
                    />
                  </div>

                  {/* 右侧：预留功能区 */}
                  <div className="flex-1 hidden sm:flex flex-col min-w-0 border-[2px] border-dashed border-[#313233] rounded-sm items-center justify-center bg-[#1E1E1F]/50">
                    <div className="text-gray-500 font-minecraft text-center flex flex-col items-center">
                      <span className="text-4xl mb-4 opacity-50">🚧</span>
                      <p className="text-lg mb-2 text-gray-400">Pro 核心功能区</p>
                      <p className="text-xs opacity-60 max-w-[200px] leading-relaxed">此区域已预留给后期的实例共享、跨设备存档同步与数据分析面板。</p>
                    </div>
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