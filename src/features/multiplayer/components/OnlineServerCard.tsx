import React from 'react';
import { Globe, MessageSquareShare, Server } from 'lucide-react';
import type { OnlineServer } from '../types';
import { openLink } from '../utils';
import { FocusItem } from '../../../ui/focus/FocusItem';

interface OnlineServerCardProps {
  server: OnlineServer;
  onArrowPress: (direction: string) => boolean | void;
  onClick?: (server: OnlineServer) => void;
}

export const OnlineServerCard: React.FC<OnlineServerCardProps> = ({ server, onArrowPress, onClick }) => {
  return (
    <article 
      className="ore-multiplayer-server-card flex flex-col overflow-hidden relative transition-all group bg-[#232324] rounded-sm border border-transparent hover:border-[#FFE866]/50 cursor-pointer"
      onClick={() => onClick?.(server)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onClick?.(server);
        }
      }}
    >
      {/* 上层 - Hero 半部 */}
      <div className="relative h-[160px] md:h-[180px] 2xl:h-[220px] w-full bg-[#1e1e1f] overflow-hidden border-b-2 border-[#1e1e1f]">
        {server.hero ? (
          <img src={server.hero} alt={server.name} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500 ease-out" loading="lazy" />
        ) : server.icon ? (
          <img src={server.icon} alt={server.name} className="absolute inset-0 w-full h-full object-cover opacity-40 blur-md scale-110" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2E2E30] to-[#1E1E1F]">
            <Server size={48} className="text-[#58585A] opacity-50" />
          </div>
        )}
        


        {/* 推广角标 */}
        {server.isSponsored && (
            <div className="absolute top-0 right-0 bg-[var(--ore-color-background-warning-default,#FFE866)] text-black font-minecraft text-[10px] md:text-xs px-3 py-1 shadow-md z-10 border-b-2 border-l-2 border-[#D4C15A]">
              推广
            </div>
        )}

        {/* 左下角信息 (标题 + 标签) */}
        <div className="absolute bottom-3 left-3 flex flex-col gap-1.5 z-10">
          <h3 className="m-0 text-white font-minecraft text-xl md:text-2xl 2xl:text-3xl tracking-wide drop-shadow-[2px_2px_0_rgba(0,0,0,0.8)]">
            {server.name}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] md:text-xs font-bold text-white/90">
            {server.serverType && (
              <span className="bg-black/60 px-2 py-0.5 border border-white/10 shadow-inner">
                {server.serverType}
              </span>
            )}
            {server.versions && server.versions.length > 0 && (
              <span className="bg-black/60 px-2 py-0.5 border border-white/10 shadow-inner">
                {server.versions.join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* 右下角信息 (付费/年龄标签 + 在线人数) */}
        <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5 z-10">
          <div className="flex items-center gap-1.5">
            {server.hasPaidFeatures && (
              <span className="bg-[#FFE866] text-[#C33636] font-bold text-[10px] md:text-xs px-1.5 py-0.5 border border-white/10 shadow-inner">
                含付费
              </span>
            )}
            {server.ageRecommendation && (
              <span className="bg-white/20 backdrop-blur-md text-white font-bold text-[10px] md:text-xs px-1.5 py-0.5 border border-white/20 shadow-inner">
                {server.ageRecommendation}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 min-w-[70px] justify-end">
            <div className="w-2 h-2 rounded-full bg-[#6CC349] animate-[pulse_2s_ease-in-out_infinite]" />
            <span className="text-white/95 text-xs md:text-sm font-minecraft leading-none drop-shadow-[1px_1px_0_rgba(0,0,0,0.8)]">在线 {server.onlinePlayers}</span>
            {server.maxPlayers && <span className="text-white/50 text-[10px] font-minecraft leading-none drop-shadow-[1px_1px_0_rgba(0,0,0,0.8)]">/ {server.maxPlayers}</span>}
          </div>
        </div>
      </div>

      {/* 下层 - 标签与社交 */}
      <div className="flex flex-col flex-1 p-3 md:p-4 bg-gradient-to-b from-[#313233] to-[#2B2C2D] gap-3">
        {/* Features 特性标签 */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {(() => {
            const allTags = [
              ...(server.features || []),
              ...(server.mechanics || []),
              ...(server.elements || []),
            ];
            if (allTags.length > 0) {
              return allTags.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-black/30 border border-white/5 px-2 py-1 shadow-inner max-w-full" style={{ borderColor: feat.color ? `${feat.color}40` : '' }}>
                    {feat.iconSvg && (
                      <div className="w-3.5 h-3.5 md:w-4 md:h-4 flex items-center justify-center opacity-90 flex-shrink-0" dangerouslySetInnerHTML={{ __html: feat.iconSvg }} style={{ color: feat.color || '#fff' }} />
                    )}
                    <span className="text-[11px] md:text-xs font-bold truncate leading-none mt-0.5" style={{ color: feat.color || '#fff' }}>
                      {feat.label}
                    </span>
                  </div>
              ));
            }
            return <span className="text-[11px] md:text-xs text-white/40 italic py-1">精简标签卡</span>;
          })()}
        </div>

        {/* Socials 社交平台信息 (只显示图标) */}
        {server.socials && server.socials.length > 0 && (
          <div className="mt-auto pt-2 md:pt-3 border-t border-white/5 flex flex-wrap items-center justify-end gap-2">
            {server.socials.map((social, idx) => {
              if (!social.url) return null;
              const isWebsite = social.label.toLowerCase().includes('网页') || social.label.toLowerCase().includes('官网') || social.label.toLowerCase().includes('web');
              return (
                <FocusItem key={idx} focusKey={`server-${server.id}-social-${idx}`} onArrowPress={onArrowPress} onEnter={() => void openLink(social.url!)}>
                  {({ ref, focused }) => (
                    <button
                      ref={ref as React.RefObject<HTMLButtonElement>}
                      type="button"
                      className={`flex items-center justify-center w-7 h-7 md:w-8 md:h-8 bg-black/20 hover:bg-black/40 active:bg-black/60 border border-white/10 transition-colors ${focused ? 'outline outline-2 outline-white outline-offset-1' : ''}`}
                      title={social.label}
                      onClick={(e) => {
                        e.stopPropagation(); // 阻止冒泡触发服务器卡片点击
                        void openLink(social.url!);
                      }}
                      tabIndex={-1}
                    >
                      {isWebsite ? (
                        <Globe size={14} className="text-white/80" />
                      ) : (
                        <MessageSquareShare size={14} className="text-white/80" />
                      )}
                    </button>
                  )}
                </FocusItem>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
};
