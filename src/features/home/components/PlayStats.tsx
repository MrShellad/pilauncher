// src/features/home/components/PlayStats.tsx
import React, { useState, useEffect } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { getButtonIcon } from '../../../ui/icons/SocialIcons';
import { NewspaperIcon } from '../../../ui/icons/NewspaperIcon';
import { OreButton } from '../../../ui/primitives/OreButton';
import { useLauncherStore } from '../../../store/useLauncherStore';
import { useNewsStore } from '../../../store/useNewsStore';
import { openExternalLink } from '../../../utils/openExternalLink';
import { formatPlayTime, formatRelativeTime } from '../../../utils/formatters';

import { useAccountStore } from '../../../store/useAccountStore';
import { useMicrosoftAuth } from '../../Settings/hooks/useMicrosoftAuth';
import { MicrosoftAuthModal } from '../../Settings/components/modals/MicrosoftAuthModal';
import { MicrosoftAccountSidebar } from './MicrosoftAccountSidebar';
import { LanTrustModal } from '../../lan/LanTrustModal';

// ✅ 引入本地默认头像作为终极兜底
import defaultAvatar from '../../../assets/home/account/128.png';

interface PlayStatsProps {
  instanceId: string;
  playTime: number;
  lastPlayed: string;
}

interface PiStyleConfig {
  buttonStyle?: React.CSSProperties;
  wiki?: { url: string; label?: string };
  socials?: Array<{ type: string; url: string; label?: string }>;
}

export const PlayStats: React.FC<PlayStatsProps> = ({ instanceId, playTime, lastPlayed }) => {
  const { t } = useTranslation();
  const setActiveTab = useLauncherStore(state => state.setActiveTab);
  const unreadNewsCount = useNewsStore(state => state.unreadCount);
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
      if (!instanceId) return;
      try {
        const detail = await invoke<any>('get_instance_detail', { id: instanceId });
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
  }, [instanceId]);

  const renderSocialIcon = (type: string) => {
    const IconComp = getButtonIcon(type);
    return <IconComp size="var(--home-side-icon)" />;
  };

  const squareBtnClass = "!min-w-0 !w-[var(--home-side-button)] !h-[var(--home-side-button)] !p-0 !justify-center !items-center !text-[#111214] [&_svg]:!text-[#111214]";
  const accountSquareClass = "!min-w-0 !w-[var(--home-side-button)] !h-[var(--home-side-button)] !p-0 !justify-center !items-center !text-[#111214] [&_svg]:!text-[#111214]";
  const profileButtonClass = "!h-[var(--home-side-button)] !min-w-0 !px-[clamp(1rem,1.5vw,2rem)] !text-[length:var(--home-side-font)] !text-[#111214] [&_svg]:!text-[#111214]";

  return (
    <>
      <div className="absolute bottom-[clamp(1.5rem,5vh,5rem)] left-[var(--home-panel-edge)] z-30 flex flex-col gap-[clamp(1.25rem,2.4vh,3rem)]">

        <div className="mb-[clamp(0.375rem,0.8vh,1rem)] flex flex-col gap-[clamp(0.75rem,1.3vh,1.5rem)]">
          {piConfig?.wiki && (() => {
            const WikiIcon = getButtonIcon('wiki');
            return (
              <OreButton focusKey="btn-wiki" variant="secondary" size="auto" className={squareBtnClass} style={piConfig.buttonStyle} onClick={() => void openExternalLink(piConfig.wiki!.url)} title={piConfig.wiki!.label || 'Wiki'} autoScroll={false}>
                <WikiIcon size="var(--home-side-icon)" />
              </OreButton>
            );
          })()}

          {piConfig?.socials && piConfig.socials.length > 0 && (
            <div className="flex gap-[clamp(0.75rem,1.2vw,1.5rem)]">
              {piConfig.socials.slice(0, 5).map((social, index) => (
                <OreButton key={index} focusKey={`btn-social-${index}`} variant="secondary" size="auto" className={squareBtnClass} style={piConfig.buttonStyle} onClick={() => void openExternalLink(social.url)} title={social.type} autoScroll={false}>
                  {renderSocialIcon(social.type)}
                </OreButton>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-[clamp(0.75rem,1.2vw,1.5rem)]">
          <div className="relative">
            <OreButton
              focusKey="btn-notification"
              variant="secondary"
              size="auto"
              className={accountSquareClass}
              style={piConfig?.buttonStyle}
              onClick={() => {
                setActiveTab('news');
              }}
              title={t('home.notification')}
              autoScroll={false}
            >
              <NewspaperIcon className="block h-[var(--home-side-icon)] w-[var(--home-side-icon)] shrink-0 text-black drop-shadow-md" />
            </OreButton>
            {unreadNewsCount > 0 && (
              <div className="pointer-events-none absolute right-[-0.5rem] top-[-0.5rem] z-20 min-w-[clamp(1.45rem,1.7vw,2.25rem)] select-none rounded-sm border-[0.125rem] border-[#1E1E1F] bg-ore-red px-[0.375rem] py-[0.125rem] text-center font-minecraft text-[clamp(0.625rem,0.75vw,0.9375rem)] font-bold leading-none text-white shadow-sm">
                {unreadNewsCount > 99 ? '99+' : unreadNewsCount}
              </div>
            )}
          </div>

          {!currentAccount ? (
            <OreButton focusKey="btn-login" variant="secondary" size="auto" className={profileButtonClass} style={piConfig?.buttonStyle} onClick={msAuthState.startMicrosoftLogin} autoScroll={false}>
              <span className="mt-[0.03125rem] leading-none tracking-widest">{t('home.addAccount')}</span>
            </OreButton>
          ) : (
            <OreButton focusKey="btn-profile" variant="secondary" size="auto" className={`${profileButtonClass} !justify-start`} style={piConfig?.buttonStyle} onClick={() => setIsSidebarOpen(true)} autoScroll={false}>
              {/* ✅ 彻底采用本地图片作为 onerror 断网兜底 */}
              <img
                src={avatarSrc || defaultAvatar}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = defaultAvatar; }}
                alt="Profile"
                className={`mr-[clamp(0.75rem,1vw,1.25rem)] h-[clamp(1.75rem,2vw,2.75rem)] w-[clamp(1.75rem,2vw,2.75rem)] border border-black/20 shadow-sm transition-opacity duration-300 ${avatarSrc ? 'opacity-100' : 'opacity-30'}`}
                style={{ imageRendering: 'pixelated' }}
              />
              <span className="mt-[0.03125rem] leading-none tracking-widest">{t('home.profile')}</span>
            </OreButton>
          )}
        </div>

        <div 
          key={instanceId}
          className="mt-[clamp(0.75rem,1.6vh,2rem)] flex flex-col gap-[clamp(0.25rem,0.55vh,0.625rem)]"
        >
          <span className="text-[clamp(0.75rem,0.9vw,1.125rem)] font-bold uppercase tracking-wider text-ore-text-muted">{t('home.playTime')}</span>
          <span 
            key={playTime}
            className="font-minecraft text-[clamp(1.25rem,1.5vw,2.25rem)] text-white drop-shadow-md"
          >
            {formatPlayTime(playTime, t)}
          </span>
          
          <span className="mt-[clamp(0.75rem,1.3vh,1.5rem)] text-[clamp(0.75rem,0.9vw,1.125rem)] font-bold uppercase tracking-wider text-ore-text-muted">{t('home.lastPlayed')}</span>
          <span 
            key={lastPlayed}
            className="font-minecraft text-[clamp(1rem,1.2vw,1.75rem)] text-white drop-shadow-md"
          >
            {lastPlayed ? formatRelativeTime(lastPlayed, t) : t('home.neverPlayed', { defaultValue: '从未进行游戏' })}
          </span>
        </div>
      </div>

      <MicrosoftAuthModal {...msAuthState} isOpen={msAuthState.isLoginModalOpen} onClose={() => msAuthState.setIsLoginModalOpen(false)} />
      <MicrosoftAccountSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <LanTrustModal />
    </>
  );
};
