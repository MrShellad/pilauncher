// /src/features/home/components/PlayStats.tsx
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Bell, Book, MessageCircle, Twitter, Youtube, Github, Globe } from 'lucide-react';
import { OreButton } from '../../../ui/primitives/OreButton';
import { useLauncherStore } from '../../../store/useLauncherStore';

interface PlayStatsProps {
  playTime: number;
  lastPlayed: string;
}

// 扩展 pistyle.json 数据结构，允许整合包作者注入自定义 CSS
interface PiStyleConfig {
  buttonStyle?: React.CSSProperties; // 作者可自定义按钮背景、颜色等
  wiki?: { url: string; label?: string };
  socials?: Array<{ type: 'discord' | 'twitter' | 'youtube' | 'github' | 'website'; url: string }>;
}

export const PlayStats: React.FC<PlayStatsProps> = ({ playTime, lastPlayed }) => {
  const selectedInstanceId = useLauncherStore(state => state.selectedInstanceId);
  
  // 模拟：判断是否登录了正版微软账号
  const [isLoggedIn, setIsLoggedIn] = useState(false); 
  const mockSkinUrl = 'https://minotar.net/avatar/Steve/64.png'; 
  
  // 模拟：新闻/通知的未读数量
  const [unreadNewsCount, setUnreadNewsCount] = useState(3);

  const [piConfig, setPiConfig] = useState<PiStyleConfig | null>(null);

  // 监听实例切换，动态读取 pistyle.json
  useEffect(() => {
    const fetchPiConfig = async () => {
      if (!selectedInstanceId) return;
      try {
        // 🟢 模拟测试数据
        if (selectedInstanceId === '1') { 
          setPiConfig({
            // buttonStyle: { backgroundColor: '#2A2A2C', color: '#FFF' }, // 解开注释可测试整合包自定义样式
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

  // ✅ 核心魔法：使用 [&>button]:!px-0 穿透覆盖 OreButton 的默认 padding，确保纯图标绝对居中
  const squareBtnClass = "!min-w-0 !w-11 !h-11 [&>button]:!px-0";
  const accountSquareClass = "!min-w-0 !w-12 !h-12 [&>button]:!px-0";

  return (
    <div className="absolute left-8 bottom-12 flex flex-col space-y-6 z-30">
      
      {/* ================= 1. 动态拓展按钮区域 ================= */}
      <div className="flex flex-col space-y-3 mb-2">
        {piConfig?.wiki && (
          <OreButton
            focusKey="btn-wiki"
            variant="secondary"
            size="auto"
            className={squareBtnClass}
            style={piConfig.buttonStyle} // 接收 JSON 样式注入
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

      {/* ================= 2. 账号控制区域 (完美还原截图布局) ================= */}
      <div className="flex items-center space-x-3">
        
        {/* 新闻与通知中心 (常驻显示) */}
        <div className="relative">
          <OreButton 
            focusKey="btn-notification" 
            variant="secondary"
            size="auto" 
            className={accountSquareClass}
            style={piConfig?.buttonStyle}
            onClick={() => {
              console.log('打开新闻/通知中心');
              setUnreadNewsCount(0); // 点击后清除角标
            }}
            title="通知与新闻"
          >
            {/* 使用 Drop Shadow 让铃铛在界面上更立体 */}
            <Bell size={24} fill="#FACC15" className="text-yellow-600 drop-shadow-md" />
          </OreButton>

          {/* ✅ MC 风格红点角标 */}
          {unreadNewsCount > 0 && (
            <div className="absolute -top-1.5 -right-1.5 bg-ore-red text-white text-[10px] font-bold font-minecraft px-1.5 py-0.5 rounded-sm z-20 border-[2px] border-[#1E1E1F] shadow-sm pointer-events-none select-none">
              {unreadNewsCount > 99 ? '99+' : unreadNewsCount}
            </div>
          )}
        </div>

        {/* 登录 / 档案按钮 */}
        {!isLoggedIn ? (
          <OreButton 
            focusKey="btn-login" 
            variant="secondary"
            size="auto"
            className="!h-12 !px-6"
            style={piConfig?.buttonStyle}
            onClick={() => console.log('触发登录弹窗')}
          >
            <span className="text-lg tracking-widest leading-none mt-0.5">登录</span>
          </OreButton>
        ) : (
          <OreButton 
            focusKey="btn-profile" 
            variant="secondary"
            size="auto"
            // 图片和文字的左对齐与间距处理
            className="!h-12 !px-3 [&>button]:!justify-start"
            style={piConfig?.buttonStyle}
            onClick={() => console.log('打开个人档案')}
          >
            <img 
              src={mockSkinUrl} 
              alt="Profile" 
              className="w-7 h-7 mr-3 border border-black/20 shadow-sm"
              style={{ imageRendering: 'pixelated' }} 
            />
            <span className="text-lg tracking-widest leading-none mt-0.5">档案</span>
          </OreButton>
        )}

      </div>

      {/* ================= 3. 原有的游玩时间统计 ================= */}
      <div className="flex flex-col space-y-1 mt-4">
        <span className="text-ore-text-muted text-xs font-bold uppercase tracking-wider">
          Play Time
        </span>
        <span className="text-xl font-minecraft text-white drop-shadow-md">{playTime} H</span>
        
        <span className="text-ore-text-muted text-xs font-bold uppercase tracking-wider mt-3">
          Last Played
        </span>
        <span className="text-base font-minecraft text-white drop-shadow-md">{lastPlayed}</span>
      </div>

    </div>
  );
};