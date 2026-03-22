// src/features/home/components/PlayStats.tsx
import React, { useState, useEffect } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { Bell } from 'lucide-react';
import { getButtonIcon } from '../../../ui/icons/SocialIcons';
import { OreButton } from '../../../ui/primitives/OreButton';
import { useLauncherStore } from '../../../store/useLauncherStore';

import { useAccountStore } from '../../../store/useAccountStore';
import { useMicrosoftAuth } from '../../Settings/hooks/useMicrosoftAuth';
import { MicrosoftAuthModal } from '../../Settings/components/modals/MicrosoftAuthModal';
import { MicrosoftAccountSidebar } from './MicrosoftAccountSidebar';
import { LanTrustModal } from '../../lan/LanTrustModal';

// ✅ 引入本地默认头像作为终极兜底
import defaultAvatar from '../../../assets/home/account/128.png';

interface PlayStatsProps {
  playTime: number;
  lastPlayed: string;
}

interface PiStyleConfig {
  buttonStyle?: React.CSSProperties; 
  wiki?: { url: string; label?: string };
  socials?: Array<{ type: string; url: string; label?: string }>;
}

export const PlayStats: React.FC<PlayStatsProps> = ({ playTime, lastPlayed }) => {
  const selectedInstanceId = useLauncherStore(state => state.selectedInstanceId);
  const [unreadNewsCount, setUnreadNewsCount] = useState(3);
  const [piConfig, setPiConfig] = useState<PiStyleConfig | null>(null);

  // 获取全局账号与 setActiveAccount 方法
  const { accounts, activeAccountId, setActiveAccount } = useAccountStore();
  const msAuthState = useMicrosoftAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  // ✅ 优化 1：自动优先级策略。如果用户未选择账号，但列表里有正版，强制优先展示正版。
  useEffect(() => {
    if (!activeAccountId && accounts.length > 0) {
      const premiumAcc = accounts.find(a => a.type?.toLowerCase() === 'microsoft');
      if (premiumAcc) {
        setActiveAccount(premiumAcc.uuid);
      } else {
        setActiveAccount(accounts[0].uuid);
      }
    }
  }, [accounts, activeAccountId, setActiveAccount]);

  // ✅ 优化 2：不再限制只有 MS 账号，获取当前的任何活动账号
  const currentAccount = accounts.find(acc => acc.uuid === activeAccountId);

  useEffect(() => {
    if (currentAccount) {
      const fetchAvatar = async () => {
        try {
          const localPath = await invoke<string>('get_or_fetch_account_avatar', { 
            uuid: currentAccount.uuid,
            username: currentAccount.name 
          });
          
          // ✅ 核心修复：使用与 3D 皮肤同源的稳定时间戳，杜绝切页重载
          const cacheBuster = currentAccount.skinUrl?.split('?t=')[1] || 'init';
          setAvatarSrc(`${convertFileSrc(localPath)}?t=${cacheBuster}`);
          
        } catch (e) {
          setAvatarSrc(defaultAvatar);
        }
      };
      fetchAvatar();
    }
  }, [currentAccount]);

  // ... (PiConfig 相关的 useEffect 更新为动态获取)
  useEffect(() => {
    const fetchPiConfig = async () => {
      if (!selectedInstanceId) return;
      try {
        const detail = await invoke<any>('get_instance_detail', { id: selectedInstanceId });
        const customBtns = detail.custom_buttons || [];
        
        if (customBtns.length === 0) {
           setPiConfig(null);
           return;
        }

        const wikiBtn = customBtns.find((b: any) => b.type === 'wiki');
        const socialBtns = customBtns.filter((b: any) => b.type !== 'wiki');

        setPiConfig({
          wiki: wikiBtn ? { url: wikiBtn.url, label: wikiBtn.label } : undefined,
          socials: socialBtns.length > 0 ? socialBtns : undefined
        });
      } catch (error) {
        setPiConfig(null);
      }
    };
    fetchPiConfig();
  }, [selectedInstanceId]);

  const renderSocialIcon = (type: string) => {
    const IconComp = getButtonIcon(type);
    return <IconComp size={20} />;
  };

  const squareBtnClass = "!min-w-0 !w-11 !h-11 [&>button]:!px-0";
  const accountSquareClass = "!min-w-0 !w-12 !h-12 [&>button]:!px-0";

  return (
    <>
      <div className="absolute left-8 bottom-12 flex flex-col space-y-6 z-30">
        
        <div className="flex flex-col space-y-3 mb-2">
          {piConfig?.wiki && (() => {
            const WikiIcon = getButtonIcon('wiki');
            return (
              <OreButton focusKey="btn-wiki" variant="secondary" size="auto" className={squareBtnClass} style={piConfig.buttonStyle} onClick={() => window.open(piConfig.wiki!.url)} title={piConfig.wiki!.label || 'Wiki'} autoScroll={false}>
                <WikiIcon size={20} />
              </OreButton>
            );
          })()}

          {piConfig?.socials && piConfig.socials.length > 0 && (
            <div className="flex space-x-3">
              {piConfig.socials.slice(0, 5).map((social, index) => (
                <OreButton key={index} focusKey={`btn-social-${index}`} variant="secondary" size="auto" className={squareBtnClass} style={piConfig.buttonStyle} onClick={() => window.open(social.url)} title={social.type} autoScroll={false}>
                  {renderSocialIcon(social.type)}
                </OreButton>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <OreButton focusKey="btn-notification" variant="secondary" size="auto" className={accountSquareClass} style={piConfig?.buttonStyle} onClick={() => setUnreadNewsCount(0)} title="通知与新闻" autoScroll={false}>
              <Bell size={24} fill="#FACC15" className="text-yellow-600 drop-shadow-md" />
            </OreButton>
            {unreadNewsCount > 0 && (
              <div className="absolute -top-1.5 -right-1.5 bg-ore-red text-white text-[10px] font-bold font-minecraft px-1.5 py-0.5 rounded-sm z-20 border-[2px] border-[#1E1E1F] shadow-sm pointer-events-none select-none">
                {unreadNewsCount > 99 ? '99+' : unreadNewsCount}
              </div>
            )}
          </div>

          {!currentAccount ? (
            <OreButton focusKey="btn-login" variant="secondary" size="auto" className="!h-12 !px-6" style={piConfig?.buttonStyle} onClick={msAuthState.startMicrosoftLogin} autoScroll={false}>
              <span className="text-lg tracking-widest leading-none mt-0.5">添加账号</span>
            </OreButton>
          ) : (
            <OreButton focusKey="btn-profile" variant="secondary" size="auto" className="!h-12 !px-3 [&>button]:!justify-start" style={piConfig?.buttonStyle} onClick={() => setIsSidebarOpen(true)} autoScroll={false}>
              {/* ✅ 彻底采用本地图片作为 onerror 断网兜底 */}
              <img 
                src={avatarSrc || defaultAvatar} 
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = defaultAvatar; }}
                alt="Profile" 
                className={`w-7 h-7 mr-3 border border-black/20 shadow-sm transition-opacity duration-300 ${avatarSrc ? 'opacity-100' : 'opacity-30'}`}
                style={{ imageRendering: 'pixelated' }} 
              />
              <span className="text-lg tracking-widest leading-none mt-0.5">档案</span>
            </OreButton>
          )}
        </div>

        <div className="flex flex-col space-y-1 mt-4">
          <span className="text-ore-text-muted text-xs font-bold uppercase tracking-wider">Play Time</span>
          <span className="text-xl font-minecraft text-white drop-shadow-md">{playTime} H</span>
          <span className="text-ore-text-muted text-xs font-bold uppercase tracking-wider mt-3">Last Played</span>
          <span className="text-base font-minecraft text-white drop-shadow-md">{lastPlayed}</span>
        </div>
      </div>

      <MicrosoftAuthModal {...msAuthState} isOpen={msAuthState.isLoginModalOpen} onClose={() => msAuthState.setIsLoginModalOpen(false)} />
      <MicrosoftAccountSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <LanTrustModal />
    </>
  );
};