// src/features/home/components/PlayStats.tsx
import React, { useState, useEffect } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { Bell, Book, MessageCircle, Twitter, Youtube, Github, Globe } from 'lucide-react';
import { OreButton } from '../../../ui/primitives/OreButton';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useLauncherStore } from '../../../store/useLauncherStore';

// ✅ 引入真实账号状态与我们做好的弹窗/侧边栏
import { useAccountStore } from '../../../store/useAccountStore';
import { useMicrosoftAuth } from '../../Settings/hooks/useMicrosoftAuth';
import { MicrosoftAuthModal } from '../../Settings/components/modals/MicrosoftAuthModal';
import { MicrosoftAccountSidebar } from './MicrosoftAccountSidebar';

interface PlayStatsProps {
  playTime: number;
  lastPlayed: string;
}

interface PiStyleConfig {
  buttonStyle?: React.CSSProperties; 
  wiki?: { url: string; label?: string };
  socials?: Array<{ type: 'discord' | 'twitter' | 'youtube' | 'github' | 'website'; url: string }>;
}

export const PlayStats: React.FC<PlayStatsProps> = ({ playTime, lastPlayed }) => {
  const selectedInstanceId = useLauncherStore(state => state.selectedInstanceId);
  const [unreadNewsCount, setUnreadNewsCount] = useState(3);
  const [piConfig, setPiConfig] = useState<PiStyleConfig | null>(null);

  // 1. 获取全局账号与微软登录 Hook
  const { accounts, activeAccountId } = useAccountStore();
  const msAuthState = useMicrosoftAuth();
  
  // 2. 控制侧边栏的状态
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // 3. 存储本地真实高清头像的路径
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  // 4. 判断当前是否有选中的正版微软账号
  const currentMSAccount = accounts.find(
    acc => acc.uuid === activeAccountId && acc.type?.toLowerCase() === 'microsoft'
  );

  // 5. 监听账号变化，调用后端获取本地头像缓存
  useEffect(() => {
    if (currentMSAccount) {
      const fetchAvatar = async () => {
        try {
          const localPath = await invoke<string>('get_or_fetch_account_avatar', { uuid: currentMSAccount.uuid });
          setAvatarSrc(convertFileSrc(localPath));
        } catch (e) {
          // 兜底：国内镜像源
          setAvatarSrc(`https://cravatar.cn/avatars/${currentMSAccount.uuid}?size=64&overlay=true`);
        }
      };
      fetchAvatar();
    }
  }, [currentMSAccount]);

  // 监听实例切换读取配置 (保持不变)
  useEffect(() => {
    const fetchPiConfig = async () => {
      if (!selectedInstanceId) return;
      try {
        if (selectedInstanceId === '1') { 
          setPiConfig({
            wiki: { url: 'https://example.com/wiki', label: 'Wiki' },
            socials: [
              { type: 'discord', url: 'https://discord.gg/...' },
              { type: 'github', url: 'https://github.com/...' },
            ]
          });
        } else {
          setPiConfig(null); 
        }
      } catch (error) {
        setPiConfig(null);
      }
    };
    fetchPiConfig();
  }, [selectedInstanceId]);

  const renderSocialIcon = (type: string) => {
    switch (type) {
      case 'discord': return <MessageCircle size={20} />;
      case 'twitter': return <Twitter size={20} />;
      case 'youtube': return <Youtube size={20} />;
      case 'github': return <Github size={20} />;
      default: return <Globe size={20} />;
    }
  };

  const squareBtnClass = "!min-w-0 !w-11 !h-11 [&>button]:!px-0";
  const accountSquareClass = "!min-w-0 !w-12 !h-12 [&>button]:!px-0";

  return (
    <>
      <div className="absolute left-8 bottom-12 flex flex-col space-y-6 z-30">
        
        {/* ================= 1. 动态拓展按钮区域 ================= */}
        <div className="flex flex-col space-y-3 mb-2">
          {piConfig?.wiki && (
            <OreButton
              focusKey="btn-wiki"
              variant="secondary"
              size="auto"
              className={squareBtnClass}
              style={piConfig.buttonStyle}
              onClick={() => window.open(piConfig.wiki!.url)}
              title={piConfig.wiki!.label || 'Wiki'}
            >
              <Book size={20} />
            </OreButton>
          )}

          {piConfig?.socials && piConfig.socials.length > 0 && (
            <div className="flex space-x-3">
              {piConfig.socials.slice(0, 5).map((social, index) => (
                <OreButton
                  key={index}
                  focusKey={`btn-social-${index}`}
                  variant="secondary"
                  size="auto"
                  className={squareBtnClass}
                  style={piConfig.buttonStyle}
                  onClick={() => window.open(social.url)}
                  title={social.type}
                >
                  {renderSocialIcon(social.type)}
                </OreButton>
              ))}
            </div>
          )}
        </div>

        {/* ================= 2. 账号控制区域 ================= */}
        <div className="flex items-center space-x-3">
          
          <div className="relative">
            <OreButton 
              focusKey="btn-notification" 
              variant="secondary"
              size="auto" 
              className={accountSquareClass}
              style={piConfig?.buttonStyle}
              onClick={() => setUnreadNewsCount(0)}
              title="通知与新闻"
            >
              <Bell size={24} fill="#FACC15" className="text-yellow-600 drop-shadow-md" />
            </OreButton>

            {unreadNewsCount > 0 && (
              <div className="absolute -top-1.5 -right-1.5 bg-ore-red text-white text-[10px] font-bold font-minecraft px-1.5 py-0.5 rounded-sm z-20 border-[2px] border-[#1E1E1F] shadow-sm pointer-events-none select-none">
                {unreadNewsCount > 99 ? '99+' : unreadNewsCount}
              </div>
            )}
          </div>

          {/* ✅ 核心修改：真实判断逻辑 */}
          {!currentMSAccount ? (
            <OreButton 
              focusKey="btn-login" 
              variant="secondary"
              size="auto"
              className="!h-12 !px-6"
              style={piConfig?.buttonStyle}
              // 未登录时：触发扫码登录模态框
              onClick={msAuthState.startMicrosoftLogin}
            >
              <span className="text-lg tracking-widest leading-none mt-0.5">正版验证</span>
            </OreButton>
          ) : (
            <OreButton 
              focusKey="btn-profile" 
              variant="secondary"
              size="auto"
              className="!h-12 !px-3 [&>button]:!justify-start"
              style={piConfig?.buttonStyle}
              // 已登录时：拉起基岩版侧边栏档案
              onClick={() => setIsSidebarOpen(true)}
            >
              <img 
                // ✅ 读取后端缓存获取的真实头像
                src={avatarSrc || `https://cravatar.cn/avatars/8667ba71b85a4004af54457a9734eed7?overlay=true&size=64`} 
                alt="Profile" 
                className={`w-7 h-7 mr-3 border border-black/20 shadow-sm transition-opacity duration-300 ${avatarSrc ? 'opacity-100' : 'opacity-30'}`}
                style={{ imageRendering: 'pixelated' }} 
              />
              <span className="text-lg tracking-widest leading-none mt-0.5">档案</span>
            </OreButton>
          )}

        </div>

        {/* ================= 3. 原有的游玩时间统计 ================= */}
        <div className="flex flex-col space-y-1 mt-4">
          <span className="text-ore-text-muted text-xs font-bold uppercase tracking-wider">Play Time</span>
          <span className="text-xl font-minecraft text-white drop-shadow-md">{playTime} H</span>
          
          <span className="text-ore-text-muted text-xs font-bold uppercase tracking-wider mt-3">Last Played</span>
          <span className="text-base font-minecraft text-white drop-shadow-md">{lastPlayed}</span>
        </div>
      </div>

      {/* ================= 全局弹窗挂载点 ================= */}
      
      {/* 扫码登录弹窗 (未登录时点击触发) */}
      <MicrosoftAuthModal 
        {...msAuthState} 
        isOpen={msAuthState.isLoginModalOpen}
        onClose={() => msAuthState.setIsLoginModalOpen(false)}
      />

      {/* 基岩版个人档案侧边栏 (已登录时点击触发) */}
      <MicrosoftAccountSidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </>
  );
};