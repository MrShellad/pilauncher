import React from 'react';
import {
  Server,
  RefreshCw
} from 'lucide-react';
import type { AdSlot, OnlineServer } from '../types';
import { formatDate } from '../utils';
import { OreButton } from '../../../ui/primitives/OreButton';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../ui/focus/useLinearNavigation';
import { OnlineServerCard } from './OnlineServerCard';
import { ServerBindModal } from './ServerBindModal';

interface OnlineServersListProps {
  servers: OnlineServer[];
  adSlots: AdSlot[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
  onRefresh: () => void;
}



export const OnlineServersList: React.FC<OnlineServersListProps> = ({
  servers,
  adSlots,
  isLoading,
  error,
  lastUpdated,
  onRefresh
}) => {
  const [selectedServer, setSelectedServer] = React.useState<OnlineServer | null>(null);

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
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] 2xl:grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-4 md:gap-5 2xl:gap-8">
              {servers.map((server) => (
                <OnlineServerCard 
                  key={server.id} 
                  server={server} 
                  onArrowPress={handleLinearArrow}
                  onClick={(server) => setSelectedServer(server)}
                />
              ))}
            </div>

          </div>
        )}

        {/* 暂时隐藏推广位，根据后续更新需要再启用 */}
        {/* !hasServers && !error && !isLoading && adSlots.length > 0 && (
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
        )*/}
      </div>

      <ServerBindModal
        isOpen={!!selectedServer}
        onClose={() => setSelectedServer(null)}
        server={selectedServer}
      />
    </section>
  );
};
