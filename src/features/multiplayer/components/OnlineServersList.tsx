import React from 'react';
import { RefreshCw, Server } from 'lucide-react';
import type { AdSlot, OnlineServer } from '../types';
import { formatDate } from '../utils';
import { OreButton } from '../../../ui/primitives/OreButton';
import { useInputMode } from '../../../ui/focus/FocusProvider';
import { useInputAction } from '../../../ui/focus/InputDriver';
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
  adSlots: _adSlots,
  isLoading,
  error,
  lastUpdated,
  onRefresh,
}) => {
  void _adSlots;

  const inputMode = useInputMode();
  const [selectedServer, setSelectedServer] = React.useState<OnlineServer | null>(null);

  const hasServers = !isLoading && !error && servers.length > 0;

  const handleRefresh = React.useCallback(() => {
    if (!isLoading) {
      onRefresh();
    }
  }, [isLoading, onRefresh]);

  const handleControllerRefresh = React.useCallback(() => {
    if (inputMode !== 'controller' || isLoading || selectedServer) {
      return;
    }

    onRefresh();
  }, [inputMode, isLoading, onRefresh, selectedServer]);

  useInputAction('ACTION_X', handleControllerRefresh);

  const serverFocusOrder = ['online-servers-refresh'];
  const { handleLinearArrow } = useLinearNavigation(serverFocusOrder, 'online-servers-refresh');

  return (
    <>
      <header className="ore-multiplayer-panel-header">
        <div className="ore-multiplayer-panel-heading">
          <h2 className="ore-multiplayer-panel-title">社区服务器目录</h2>
          <p className="ore-multiplayer-panel-subtitle">
            {lastUpdated ? `上次同步 ${formatDate(lastUpdated)}` : '尚未完成首次拉取'}
          </p>
        </div>
      </header>

      <div className="ore-multiplayer-floating-action">
        <OreButton
          type="button"
          size="auto"
          variant="secondary"
          className="ore-multiplayer-floating-action__button"
          onClick={handleRefresh}
          disabled={isLoading}
          focusKey="online-servers-refresh"
          onArrowPress={handleLinearArrow}
          autoScroll={false}
        >
          <span className="ore-multiplayer-floating-action__content">
            {inputMode === 'controller' && (
              <span className="ore-multiplayer-floating-action__badge" aria-hidden="true">
                X
              </span>
            )}
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            <span>{inputMode === 'controller' ? '按 X 刷新' : '刷新目录'}</span>
          </span>
        </OreButton>
      </div>

      <div className="ore-multiplayer-scroll ore-multiplayer-scroll--directory">
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
          <div className="ore-multiplayer-stack ore-multiplayer-stack--server-directory">
            <div className="ore-online-server-grid">
              {servers.map((server) => (
                <OnlineServerCard
                  key={server.id}
                  server={server}
                  onArrowPress={handleLinearArrow}
                  onClick={(currentServer) => setSelectedServer(currentServer)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <ServerBindModal
        isOpen={!!selectedServer}
        onClose={() => setSelectedServer(null)}
        server={selectedServer}
      />
    </>
  );
};
