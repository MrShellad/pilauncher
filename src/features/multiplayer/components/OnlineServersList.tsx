import React, { useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { RefreshCw, Server } from 'lucide-react';
import type { AdSlot, OnlineServer } from '../types';
import { OreButton } from '../../../ui/primitives/OreButton';
import { useInputMode } from '../../../ui/focus/FocusProvider';
import { useInputAction } from '../../../ui/focus/InputDriver';
import { focusManager } from '../../../ui/focus/FocusManager';
import { OnlineServerCard } from './OnlineServerCard';
import { ServerBindModal } from './ServerBindModal';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { OreOverlayScrollArea } from '../../../ui/primitives/OreOverlayScrollArea';

interface OnlineServersListProps {
  servers: OnlineServer[];
  adSlots: AdSlot[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

interface LiveStatus {
  isOnline: boolean;
  online?: number;
  max?: number;
}

export const OnlineServersList: React.FC<OnlineServersListProps> = ({
  servers,
  adSlots: _adSlots,
  isLoading,
  error,
  onRefresh,
}) => {
  void _adSlots;

  const inputMode = useInputMode();
  const [selectedServer, setSelectedServer] = React.useState<OnlineServer | null>(null);
  const [liveStatuses, setLiveStatuses] = React.useState<Record<string, LiveStatus>>({});

  React.useEffect(() => {
    if (!servers.length) return;

    let mounted = true;
    servers.forEach(server => {
      if (!server.address) return;
      fetch(`https://api.mcstatus.io/v2/status/java/${server.address}`)
        .then(res => {
          if (!res.ok) throw new Error('API error');
          return res.json();
        })
        .then(data => {
          if (mounted && data) {
            setLiveStatuses(prev => ({
              ...prev,
              [server.id]: {
                isOnline: data.online,
                online: data.players?.online,
                max: data.players?.max,
              }
            }));
          }
        })
        .catch(() => {
          if (mounted) {
            setLiveStatuses(prev => ({
              ...prev,
              [server.id]: { isOnline: false }
            }));
          }
        });
    });

    return () => { mounted = false; };
  }, [servers]);

  const hasServers = !isLoading && !error && servers.length > 0;

  // Sort servers: online first, then higher sortId first, then newer createdAt first for ties
  const sortedServers = React.useMemo(() => {
    return [...servers].sort((a, b) => {
      const aOnline = liveStatuses[a.id]?.isOnline ?? true; // assume online until fetched
      const bOnline = liveStatuses[b.id]?.isOnline ?? true;

      if (aOnline !== bOnline) {
        return aOnline ? -1 : 1;
      }

      const aSort = a.sortId ?? 0;
      const bSort = b.sortId ?? 0;
      if (aSort !== bSort) {
        return bSort - aSort; // higher sortId first
      }

      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime; // newer first
    });
  }, [servers, liveStatuses]);



  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: sortedServers.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 520,
    overscan: 3,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateHeight = () => {
      setContainerHeight(container.clientHeight);
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  const headerHeight = Math.max(64, Math.min((containerHeight - 520) / 2 - 32, 96));
  const footerHeight = Math.max(64, Math.min((containerHeight - 520) / 2 - 32, 96));

  const handleRefresh = () => {
    onRefresh();
  };

  const handleControllerRefresh = React.useCallback(() => {
    if (inputMode !== 'controller' || isLoading || selectedServer) {
      return;
    }
    handleRefresh();
  }, [inputMode, isLoading, selectedServer]);

  useInputAction('ACTION_X', handleControllerRefresh);

  const focusServerControl = React.useCallback((focusKey: string, serverIndex: number) => {
    let attempts = 0;

    const tryFocus = () => {
      if (doesFocusableExist(focusKey)) {
        setFocus(focusKey);
        return;
      }

      if (attempts === 0) {
        rowVirtualizer.scrollToIndex(serverIndex, { align: 'center', behavior: 'smooth' });
      }

      attempts += 1;
      if (attempts <= 12) {
        window.setTimeout(tryFocus, 50);
      }
    };

    tryFocus();
  }, [rowVirtualizer]);

  const handleServerArrow = React.useCallback((direction: string) => {
    if (direction !== 'up' && direction !== 'down') return true;
    if (sortedServers.length === 0) return true;

    const currentFocusKey = getCurrentFocusKey();
    if (!currentFocusKey) return true;

    const match = currentFocusKey.match(/^server-card-(.+)-(play|copy)$/);
    if (!match) return true;

    const [_, currentServerId, controlType] = match;
    const currentServerIndex = sortedServers.findIndex(s => s.id === currentServerId);
    if (currentServerIndex < 0) return true;

    const nextServerIndex = direction === 'down'
      ? Math.min(sortedServers.length - 1, currentServerIndex + 1)
      : Math.max(0, currentServerIndex - 1);

    if (nextServerIndex === currentServerIndex) return false;

    const nextServer = sortedServers[nextServerIndex];
    if (!nextServer) return false;

    const targetKey = `server-card-${nextServer.id}-${controlType}`;
    focusServerControl(targetKey, nextServerIndex);
    return false;
  }, [focusServerControl, sortedServers]);

  const isInitialFocused = React.useRef(false);

  React.useEffect(() => {
    if (sortedServers.length > 0 && !isInitialFocused.current) {
      setTimeout(() => {
        focusManager.focus(`server-card-${sortedServers[0].id}-play`);
        rowVirtualizer.scrollToIndex(0, { align: 'center' });
      }, 50);
      isInitialFocused.current = true;
    }
  }, [sortedServers, rowVirtualizer]);

  const targetIndex = React.useRef(0);
  const visibleRange = React.useRef({ startIndex: 0, endIndex: 0 });
  const wheelAccumulator = React.useRef(0);
  const lastWheelTime = React.useRef(0);
  const lastSwitchTime = React.useRef(0);

  useEffect(() => {
    if (virtualItems.length > 0) {
      visibleRange.current = {
        startIndex: virtualItems[0].index,
        endIndex: virtualItems[virtualItems.length - 1].index,
      };
    }
  }, [virtualItems]);

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || sortedServers.length === 0) return;

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.overflow-y-auto') || target.closest('[data-orientation="vertical"]')) {
        return;
      }

      e.preventDefault();

      const now = Date.now();

      // 防抖：防止触控板的超高频触发导致连续跳过多张卡片
      if (now - lastSwitchTime.current < 150) {
        wheelAccumulator.current = 0;
        return;
      }

      // 如果较长时间未滚动，说明这是一次新的滚动动作
      if (now - lastWheelTime.current > 200) {
        wheelAccumulator.current = 0;

        // 只有当内部的 targetIndex 完全偏离了用户手动拖拽可视区时，才进行修正同步
        const { startIndex, endIndex } = visibleRange.current;
        if (targetIndex.current < startIndex || targetIndex.current > endIndex) {
          targetIndex.current = Math.floor((startIndex + endIndex) / 2);
        }
      }
      lastWheelTime.current = now;

      wheelAccumulator.current += e.deltaY;

      // 触发阈值减小，使得单次短促滚动更容易生效
      if (Math.abs(wheelAccumulator.current) >= 30) {
        if (wheelAccumulator.current > 0 && targetIndex.current < sortedServers.length - 1) {
          targetIndex.current += 1;
        } else if (wheelAccumulator.current < 0 && targetIndex.current > 0) {
          targetIndex.current -= 1;
        }

        rowVirtualizer.scrollToIndex(targetIndex.current, {
          behavior: 'smooth',
          align: 'center'
        });

        if (inputMode === 'mouse') {
          const nextServer = sortedServers[targetIndex.current];
          if (nextServer) {
            focusManager.focus(`server-card-${nextServer.id}-play`);
          }
        }

        lastSwitchTime.current = now;
        wheelAccumulator.current = 0;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [sortedServers, inputMode, rowVirtualizer]);

  return (
    <div className="relative flex flex-col flex-1 min-h-0 w-full h-full">
      <div className="ore-multiplayer-floating-action" style={{ top: '0.25rem', bottom: 'auto', right: 'max(1rem, 3vw)' }}>
        <OreButton
          type="button"
          size="auto"
          variant="secondary"
          className="ore-multiplayer-floating-action__button"
          onClick={handleRefresh}
          disabled={isLoading}
          focusable={false}
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

      <OreOverlayScrollArea
        ref={scrollContainerRef}
        className="ore-multiplayer-scroll ore-multiplayer-scroll--directory"
        contentSafePaddingRight={0}
        style={{
          maskImage: 'linear-gradient(to bottom, transparent, black 3rem, black calc(100% - 3rem), transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 3rem, black calc(100% - 3rem), transparent)',
          height: '100%',
          width: '100%',
        }}
      >
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
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize() + headerHeight + footerHeight}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            <div style={{ height: `${headerHeight}px` }} />

            {virtualItems.map((virtualRow) => {
              const index = virtualRow.index;
              const server = sortedServers[index];
              if (!server) return null;

              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start + headerHeight}px)`,
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '1.25rem max(1rem, 3vw)'
                  }}
                  role="listitem"
                >
                  <OnlineServerCard
                    server={server}
                    liveStatus={liveStatuses[server.id] || null}
                    onArrowPress={handleServerArrow}
                    onClick={(currentServer) => setSelectedServer(currentServer)}
                  />
                </div>
              );
            })}

            <div
              style={{
                position: 'absolute',
                top: `${rowVirtualizer.getTotalSize() + headerHeight}px`,
                height: `${footerHeight}px`,
                width: '100%',
              }}
            />
          </div>
        )}
      </OreOverlayScrollArea>

      <ServerBindModal
        isOpen={!!selectedServer}
        onClose={() => setSelectedServer(null)}
        server={selectedServer}
      />
    </div>
  );
};
