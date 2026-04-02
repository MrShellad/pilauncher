import React from 'react';
import {
  BadgeDollarSign,
  Globe,
  Megaphone,
  MessageSquareShare,
  Server,
  Wifi,
  RefreshCw
} from 'lucide-react';
import type { AdSlot, OnlineServer } from '../types';
import { formatDate, openLink } from '../utils';
import { OreButton } from '../../../ui/primitives/OreButton';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../ui/focus/useLinearNavigation';

interface OnlineServersListProps {
  servers: OnlineServer[];
  adSlots: AdSlot[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
  apiUrl: string;
  onRefresh: () => void;
}

const getPingTone = (ping?: number) => {
  if (ping === undefined) return 'unknown';
  if (ping <= 80) return 'good';
  if (ping <= 160) return 'mid';
  return 'bad';
};

export const OnlineServersList: React.FC<OnlineServersListProps> = ({
  servers,
  adSlots,
  isLoading,
  error,
  lastUpdated,
  apiUrl,
  onRefresh
}) => {
  const hasServers = !isLoading && !error && servers.length > 0;

  const serverFocusOrder = [
    'online-servers-refresh',
    ...servers.map((s) => `server-website-${s.id}`),
    ...servers.map((s) => `server-social-${s.id}`),
    ...adSlots.slice(0, 3).map((a) => `ad-slot-${a.id}`)
  ];
  const { handleLinearArrow } = useLinearNavigation(serverFocusOrder, 'online-servers-refresh');

  return (
    <section className="ore-multiplayer-surface">
      <header className="ore-multiplayer-panel-header">
        <div className="ore-multiplayer-panel-heading">
          <h2 className="ore-multiplayer-panel-title">社区服务器目录</h2>
          <p className="ore-multiplayer-panel-subtitle">
            {lastUpdated ? `上次同步 ${formatDate(lastUpdated)}` : '尚未完成首次拉取'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="ore-multiplayer-meta" title={apiUrl || '未配置 VITE_ONLINE_SERVERS_API_URL'}>
            API · {apiUrl || '未配置'}
          </div>
          <FocusItem focusKey="online-servers-refresh" onArrowPress={handleLinearArrow} onEnter={onRefresh}>
            {({ ref, focused }) => (
              <div ref={ref as React.RefObject<HTMLDivElement>} className={`rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
                <OreButton
                  type="button"
                  size="auto"
                  variant="secondary"
                  onClick={onRefresh}
                  disabled={isLoading}
                  tabIndex={-1}
                >
                  <span className="inline-flex items-center gap-2">
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    刷新
                  </span>
                </OreButton>
              </div>
            )}
          </FocusItem>
        </div>
      </header>

      <div className="ore-multiplayer-scroll">
        {isLoading && (
          <div className="ore-multiplayer-empty-state">
            <Server size={28} />
            <div>正在从远端 API 拉取服务器目录...</div>
          </div>
        )}

        {!isLoading && error && (
          <div className="ore-multiplayer-banner" data-tone="danger">
            <Server size={18} />
            <div>{error}</div>
          </div>
        )}

        {!isLoading && !error && servers.length === 0 && (
          <div className="ore-multiplayer-empty-state">
            <Server size={28} />
            <div>接口请求成功，但没有返回可渲染的服务器数据。</div>
          </div>
        )}

        {hasServers && (
          <div className="ore-multiplayer-stack">
            <div className="ore-multiplayer-server-grid">
              {servers.map((server) => (
                <article key={server.id} className="ore-multiplayer-server-card">
                  <div className="ore-multiplayer-server-media">
                    {server.icon ? (
                      <img src={server.icon} alt={server.name} loading="lazy" />
                    ) : (
                      <Server size={48} className="text-[var(--ore-color-text-muted-default)]" />
                    )}

                    {server.isSponsored && (
                      <div className="ore-multiplayer-ribbon">推广</div>
                    )}

                    <div className="ore-multiplayer-ping">
                      <span className="ore-multiplayer-ping-dot" data-tone={getPingTone(server.ping)} />
                      {server.ping !== undefined ? `${server.ping} ms` : '未知延迟'}
                    </div>
                  </div>

                  <div className="ore-multiplayer-card-body">
                    <div className="ore-multiplayer-card-topline">
                      <div>
                        <h3 className="ore-multiplayer-card-title-text">{server.name}</h3>
                        <div className="ore-multiplayer-card-subline">
                          <strong>{server.serverType}</strong>
                          <span>
                            玩家 {server.onlinePlayers}
                            {server.maxPlayers ? ` / ${server.maxPlayers}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {server.description && (
                      <p className="ore-multiplayer-card-description">{server.description}</p>
                    )}

                    <div className="ore-multiplayer-tags">
                      <span className="ore-multiplayer-tag">{server.isModded ? 'Mod 服' : '原版 / 轻改'}</span>
                      <span className="ore-multiplayer-tag">{server.requiresWhitelist ? '需要白名单' : '免白名单'}</span>
                      <span className="ore-multiplayer-tag">{server.hasPaidFeatures ? '含付费内容' : '无付费门槛'}</span>
                      {server.hasVoiceChat && <span className="ore-multiplayer-tag">语音协作</span>}
                    </div>
                  </div>

                  <footer className="ore-multiplayer-card-footer">
                    <div className="ore-multiplayer-address">
                      <Wifi size={14} />
                      <span>{server.address || '未提供连接地址'}</span>
                    </div>

                    <div className="ore-multiplayer-link-row">
                      {server.homepageUrl && (
                        <FocusItem focusKey={`server-website-${server.id}`} onArrowPress={handleLinearArrow} onEnter={() => void openLink(server.homepageUrl!)}>
                          {({ ref, focused }) => (
                            <button
                              ref={ref as React.RefObject<HTMLButtonElement>}
                              type="button"
                              className={`ore-multiplayer-link-button ${focused ? 'outline outline-[3px] outline-offset-[2px] outline-white' : ''}`}
                              onClick={() => void openLink(server.homepageUrl!)}
                              tabIndex={-1}
                            >
                              <Globe size={14} />
                              官网
                            </button>
                          )}
                        </FocusItem>
                      )}

                      {server.socials[0]?.url && (
                        <FocusItem focusKey={`server-social-${server.id}`} onArrowPress={handleLinearArrow} onEnter={() => void openLink(server.socials[0].url)}>
                          {({ ref, focused }) => (
                            <button
                              ref={ref as React.RefObject<HTMLButtonElement>}
                              type="button"
                              className={`ore-multiplayer-link-button ore-multiplayer-link-button--primary ${focused ? 'outline outline-[3px] outline-offset-[2px] outline-white' : ''}`}
                              onClick={() => void openLink(server.socials[0].url)}
                              tabIndex={-1}
                            >
                              <MessageSquareShare size={14} />
                              {server.socials[0].label}
                            </button>
                          )}
                        </FocusItem>
                      )}
                    </div>
                  </footer>
                </article>
              ))}
            </div>

            <div className="ore-multiplayer-stack">
              <div className="ore-multiplayer-panel-heading">
                <h3 className="ore-multiplayer-panel-title">推广位</h3>
                <p className="ore-multiplayer-panel-subtitle">
                  为活动服、联机季和合作专区预留的内容位置。
                </p>
              </div>

              <div className="ore-multiplayer-ad-grid">
                {adSlots.slice(0, 3).map((ad) => (
                  <FocusItem key={ad.id} focusKey={`ad-slot-${ad.id}`} onArrowPress={handleLinearArrow} onEnter={() => { if (ad.url) void openLink(ad.url); }}>
                    {({ ref, focused }) => (
                      <article
                        ref={ref as React.RefObject<HTMLElement>}
                        className={`ore-multiplayer-ad-card ${focused ? 'outline outline-[3px] outline-offset-[2px] outline-white' : ''}`}
                        onClick={() => ad.url && void openLink(ad.url)}
                        tabIndex={-1}
                      >
                        <div className="ore-multiplayer-ad-card-body">
                          <Megaphone size={20} className="text-[var(--ore-color-background-warning-default)]" />
                          <h3 className="ore-multiplayer-ad-title">{ad.title}</h3>
                          <p className="ore-multiplayer-ad-description">{ad.description}</p>
                        </div>

                        <div className="ore-multiplayer-ad-footer">
                          <span>{ad.expiresAt ? `截止 ${formatDate(ad.expiresAt)}` : '等待素材投放'}</span>
                          <strong>{ad.url ? '查看详情' : '预留中'}</strong>
                        </div>
                      </article>
                    )}
                  </FocusItem>
                ))}
              </div>
            </div>
          </div>
        )}

        {!hasServers && !error && !isLoading && adSlots.length > 0 && (
          <div className="ore-multiplayer-stack">
            <div className="ore-multiplayer-panel-heading">
              <h3 className="ore-multiplayer-panel-title">预留推广位</h3>
              <p className="ore-multiplayer-panel-subtitle">
                当前目录为空时，仍保留推广和活动位，避免页面出现大片留白。
              </p>
            </div>

            <div className="ore-multiplayer-ad-grid">
              {adSlots.slice(0, 3).map((ad) => (
                <article key={ad.id} className="ore-multiplayer-ad-card">
                  <div className="ore-multiplayer-ad-card-body">
                    <BadgeDollarSign size={20} className="text-[var(--ore-color-background-warning-default)]" />
                    <h3 className="ore-multiplayer-ad-title">{ad.title}</h3>
                    <p className="ore-multiplayer-ad-description">{ad.description}</p>
                  </div>
                  <div className="ore-multiplayer-ad-footer">
                    <span>{ad.expiresAt ? `截止 ${formatDate(ad.expiresAt)}` : '等待素材投放'}</span>
                    <strong>{ad.url ? '待跳转' : '预留中'}</strong>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
