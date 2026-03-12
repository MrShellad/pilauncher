import React from 'react';
import {
  BadgeDollarSign,
  Globe,
  Megaphone,
  MessageSquareShare,
  Server,
  Wifi
} from 'lucide-react';
import type { AdSlot, OnlineServer } from '../types';
import { formatDate, openLink } from '../utils';

interface OnlineServersListProps {
  servers: OnlineServer[];
  adSlots: AdSlot[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
  apiUrl: string;
}

export const OnlineServersList: React.FC<OnlineServersListProps> = ({
  servers,
  adSlots,
  isLoading,
  error,
  lastUpdated,
  apiUrl
}) => {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-2">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ore-gray-border bg-ore-nav px-5 py-3" style={{ boxShadow: 'inset 2px 2px rgba(255, 255, 255, 0.05), inset -2px -2px rgba(0, 0, 0, 0.1)' }}>
          <div>
            <h2 className="text-xl font-minecraft font-bold text-white tracking-widest text-shadow">在线服务器</h2>
            <p className="text-sm text-ore-text-muted font-minecraft">
              {lastUpdated ? `上次更新 ${formatDate(lastUpdated)}` : '尚未完成首次拉取'}
            </p>
          </div>

          <div className="bg-black/20 border border-black/30 px-3 py-1 text-xs text-ore-text-muted font-minecraft shadow-inner">
            API: {apiUrl || '未配置'}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pt-4 pb-2">
          {isLoading && (
            <div className="w-full bg-ore-nav border-2 border-ore-gray-border p-10 text-center text-ore-button font-minecraft" style={{ boxShadow: 'inset 2px 2px rgba(255, 255, 255, 0.05), inset -2px -2px rgba(0, 0, 0, 0.1)' }}>
              正在从远端 API 获取服务器 JSON 列表...
            </div>
          )}

          {!isLoading && error && (
            <div className="w-full bg-ore-red/20 border-2 border-ore-red p-6 text-ore-text font-minecraft" style={{ boxShadow: 'inset 2px 2px rgba(255, 255, 255, 0.05), inset -2px -2px rgba(0, 0, 0, 0.1)' }}>
              {error}
            </div>
          )}

          {!isLoading && !error && servers.length === 0 && (
            <div className="w-full bg-ore-nav border-2 border-ore-gray-border p-10 text-center text-ore-text-muted font-minecraft" style={{ boxShadow: 'inset 2px 2px rgba(255, 255, 255, 0.05), inset -2px -2px rgba(0, 0, 0, 0.1)' }}>
              接口请求成功，但没有返回可渲染的服务器数据。
            </div>
          )}

          {!isLoading && !error && servers.length > 0 && (
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
              {servers.map((server) => (
                <article
                  key={server.id}
                  className="group flex flex-col w-full bg-ore-nav border-2 border-ore-gray-border hover:bg-ore-nav-hover active:bg-ore-nav-active transition-none cursor-default overflow-hidden"
                  style={{
                    boxShadow: 'inset 2px 2px rgba(255, 255, 255, 0.05), inset -2px -2px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <div className="w-full h-32 flex-shrink-0 bg-[#1E1E1F] border-b-2 border-ore-gray-border flex items-center justify-center relative overlow-hidden" style={{ boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' }}>
                    {server.icon ? (
                      <img
                        src={server.icon}
                        alt={server.name}
                        className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        loading="lazy"
                      />
                    ) : (
                      <Server size={48} className="text-ore-text-muted opacity-30" />
                    )}
                    {server.isSponsored && (
                      <div className="absolute top-2 right-2 bg-amber-500/90 border border-black/50 px-2 py-0.5 text-[10px] text-black font-minecraft font-bold shadow-md">
                        推广
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 bg-black/60 border border-black px-2 py-0.5 text-[10px] text-white font-minecraft flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${server.ping && server.ping < 100 ? 'bg-core-green' : server.ping && server.ping < 200 ? 'bg-amber-400' : 'bg-ore-red'}`}></div>
                      {server.ping !== undefined ? `${server.ping} ms` : '未知'}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col p-4">
                    <h3 className="font-minecraft font-bold text-xl text-white truncate w-full shadow-black drop-shadow-md">{server.name}</h3>
                    <div className="flex items-center justify-between mt-1">
                       <p className="text-ore-green text-sm font-minecraft">{server.serverType}</p>
                       <p className="text-ore-text-muted text-xs font-minecraft">
                         玩家: <span className="text-white">{server.onlinePlayers}{server.maxPlayers ? `/${server.maxPlayers}` : ''}</span>
                       </p>
                    </div>
                    
                    {server.description && (
                      <p className="text-ore-text-muted text-xs font-minecraft mt-3 line-clamp-2 leading-relaxed h-8">
                        {server.description}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-1.5 text-[10px] font-minecraft">
                      <span className="bg-black/30 border border-black/50 px-1.5 py-0.5 text-ore-text-muted">
                        {server.isModded ? 'Mod 服' : '原版/轻改'}
                      </span>
                      <span className="bg-black/30 border border-black/50 px-1.5 py-0.5 text-ore-text-muted">
                        {server.requiresWhitelist ? '需白名单' : '免白名单'}
                      </span>
                      <span className="bg-black/30 border border-black/50 px-1.5 py-0.5 text-ore-text-muted">
                        {server.hasPaidFeatures ? '含内购' : '无内购'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-black/20 border-t border-white/5 w-full py-2.5 px-3 flex flex-col gap-2 mt-auto">
                    <div className="flex items-center gap-2 text-xs font-minecraft text-ore-text-muted">
                      <Wifi size={14} className="text-ore-green" />
                      <span className="truncate">{server.address || '未提供地址'}</span>
                    </div>
                    
                    <div className="flex gap-2">
                       {server.homepageUrl && (
                          <button
                            type="button"
                            onClick={() => void openLink(server.homepageUrl)}
                            className="flex-1 bg-ore-button border-2 border-ore-gray-border text-black text-xs font-minecraft py-1 active:mt-0.5 hover:brightness-110 flex items-center justify-center gap-1"
                            style={{ boxShadow: 'inset 0 -2px #58585A, inset 2px 2px rgba(255, 255, 255, 0.6)' }}
                          >
                            <Globe size={12} />
                            官网
                          </button>
                       )}
                       {server.socials.length > 0 && (
                          <button
                            type="button"
                            onClick={() => void openLink(server.socials[0].url)}
                            className="flex-1 bg-ore-green border-2 border-ore-gray-border text-white text-xs font-minecraft py-1 active:mt-0.5 hover:brightness-110 flex items-center justify-center gap-1"
                            style={{ boxShadow: 'inset 0 -2px #1D4D13, inset 2px 2px rgba(255, 255, 255, 0.2)' }}
                          >
                            <MessageSquareShare size={12} />
                            {server.socials[0].label}
                          </button>
                       )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pt-2 border-t-2 border-ore-gray-border/50">
        <div className="mb-3 flex items-center gap-2 text-sm text-ore-text-muted font-minecraft px-2">
          <Megaphone size={16} className="text-amber-400" />
          <span>推广位</span>
        </div>
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {adSlots.slice(0, 3).map((ad) => (
            <article
              key={ad.id}
              className="group flex flex-col w-full bg-ore-nav border-2 border-ore-gray-border hover:bg-ore-nav-hover active:bg-ore-nav-active transition-none cursor-pointer overflow-hidden"
              style={{
                boxShadow: 'inset 2px 2px rgba(255, 255, 255, 0.05), inset -2px -2px rgba(0, 0, 0, 0.1)'
              }}
              onClick={() => ad.url && void openLink(ad.url)}
            >
              <div className="flex-1 flex flex-col p-4 relative">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                   <BadgeDollarSign size={48} />
                </div>
                <h3 className="font-minecraft font-bold text-lg text-white mb-2 relative z-10 text-shadow">{ad.title}</h3>
                <p className="text-ore-text-muted text-xs font-minecraft leading-relaxed relative z-10">{ad.description}</p>
              </div>

              <div className="bg-black/20 border-t border-white/5 w-full py-2 px-4 flex justify-between items-center mt-auto">
                 <span className="text-[10px] text-ore-text-muted font-minecraft">
                   {ad.expiresAt ? `截止 ${formatDate(ad.expiresAt)}` : '等待素材投放'}
                 </span>
                 <span className="text-[10px] text-amber-400 font-minecraft font-bold">
                   {ad.url ? '查看详情 >' : '预留中'}
                 </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};
