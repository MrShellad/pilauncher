// src/features/home/components/AccountSliderBar/MicrosoftAccountSidebar.tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { useAccountStore } from '../../../store/useAccountStore';
import { useLan } from '../../../hooks/useLan';

import { UserProfileCard } from './AccountSliderBar/UserProfileCard';
import { LanRadar } from './AccountSliderBar/LanRadar';
import defaultAvatar from '../../../assets/home/account/128.png';

interface MicrosoftAccountSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MicrosoftAccountSidebar: React.FC<MicrosoftAccountSidebarProps> = ({ isOpen, onClose }) => {
  const { accounts, activeAccountId, setActiveAccount } = useAccountStore();
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  const { discovered, trusted, isScanning, isRequesting, scan, sendTrustRequest } = useLan();

  const currentAccount = accounts.find(acc => acc.uuid === activeAccountId);
  const isPremium = currentAccount?.type?.toLowerCase() === 'microsoft';
  const hasPremiumAnywhere = accounts.some(acc => acc.type?.toLowerCase() === 'microsoft');

  const handleCycleAccount = () => {
    if (accounts.length <= 1) return;
    const currentIndex = accounts.findIndex(a => a.uuid === activeAccountId);
    const nextIndex = (currentIndex + 1) % accounts.length;
    setActiveAccount(accounts[nextIndex].uuid);
  };

  useEffect(() => {
    if (isOpen) scan();
  }, [isOpen, scan]);

  useEffect(() => {
    if (currentAccount && isOpen) {
      const fetchAvatar = async () => {
        try {
          const localPath = await invoke<string>('get_or_fetch_account_avatar', { 
            uuid: currentAccount.uuid,
            username: currentAccount.name
          });
          setAvatarSrc(`${convertFileSrc(localPath)}?t=${Date.now()}`);
        } catch (e) {
          // ✅ 失败直接用本地兜底
          setAvatarSrc(defaultAvatar);
        }
      };
      fetchAvatar();
    }
  }, [currentAccount, isOpen]);

  if (!currentAccount) return null;

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
                />
                
                <LanRadar 
                  discovered={discovered} 
                  trusted={trusted} 
                  isScanning={isScanning} 
                  isRequesting={isRequesting} 
                  onRequestTrust={sendTrustRequest} 
                />
              </div>

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