import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';
import { RefreshCw, Server } from 'lucide-react';
import type { AdSlot, OnlineServer } from '../types';
import { OreButton } from '../../../ui/primitives/OreButton';
import { useInputMode } from '../../../ui/focus/FocusProvider';
import { useInputAction } from '../../../ui/focus/InputDriver';
import { focusManager } from '../../../ui/focus/FocusManager';
import { OnlineServerCard } from './OnlineServerCard';
import { ServerBindModal } from './ServerBindModal';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

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

const VirtuosoHeader = () => <div style={{ height: 'max(calc(50vh - 18rem), 6rem)' }} />;
const VirtuosoFooter = () => <div style={{ height: 'max(calc(50vh - 18rem), 6rem)' }} />;

const VirtuosoScroller = React.forwardRef<HTMLDivElement, any>((props, ref) => (
  <div {...props} ref={ref} style={{ ...props.style, overflowY: 'overlay' as any }} />
));
VirtuosoScroller.displayName = 'VirtuosoScroller';

const virtuosoComponents = {
  Header: VirtuosoHeader,
  Footer: VirtuosoFooter,
  Scroller: VirtuosoScroller,
};

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
        return aOnline ? -1 : 1; // online first
      }

      if (a.sortId !== b.sortId) {
        return b.sortId - a.sortId;
      }
      // Tie-break by createdAt descending (newer first)
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
        return 0;
      }
      return bTime - aTime;
    });
  }, [servers, liveStatuses]);



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

  const virtuosoRef = React.useRef<VirtuosoHandle>(null);
  const serverFocusKeys = React.useMemo(
    () => sortedServers.flatMap((s) => [`server-card-${s.id}-copy`, `server-card-${s.id}-play`]),
    [sortedServers]
  );
  const focusServerControl = React.useCallback((focusKey: string, serverIndex: number) => {
    let attempts = 0;

    const tryFocus = () => {
      if (doesFocusableExist(focusKey)) {
        setFocus(focusKey);
        return;
      }

      if (attempts === 0) {
        virtuosoRef.current?.scrollToIndex({ index: serverIndex, align: 'center', behavior: 'smooth' });
      }

      attempts += 1;
      if (attempts <= 12) {
        window.setTimeout(tryFocus, 50);
      }
    };

    tryFocus();
  }, []);

  const handleServerArrow = React.useCallback((direction: string) => {
    if (direction !== 'up' && direction !== 'down') return true;
    if (sortedServers.length === 0) return true;

    const currentFocusKey = getCurrentFocusKey();
    const currentIndex = serverFocusKeys.indexOf(currentFocusKey);
    const nextIndex = currentIndex < 0
      ? 0
      : direction === 'down'
        ? Math.min(serverFocusKeys.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1);

    if (nextIndex === currentIndex) return false;

    const targetKey = serverFocusKeys[nextIndex];
    const targetServerIndex = Math.floor(nextIndex / 2);
    focusServerControl(targetKey, targetServerIndex);
    return false;
  }, [focusServerControl, serverFocusKeys, sortedServers.length]);

  const isInitialFocused = React.useRef(false);

  React.useEffect(() => {
    if (serverFocusKeys.length > 0 && !isInitialFocused.current) {
      setTimeout(() => {
        focusManager.focus(serverFocusKeys[0]);
      }, 50);
      isInitialFocused.current = true;
    }
  }, [serverFocusKeys]);

  const virtuosoContext = React.useMemo(() => ({
    liveStatuses,
    handleServerArrow,
    setSelectedServer,
  }), [liveStatuses, handleServerArrow, setSelectedServer]);

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const targetIndex = React.useRef(0);
  const visibleRange = React.useRef({ startIndex: 0, endIndex: 0 });
  const wheelAccumulator = React.useRef(0);
  const lastWheelTime = React.useRef(0);
  const lastSwitchTime = React.useRef(0);

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

        virtuosoRef.current?.scrollToIndex({
          index: targetIndex.current,
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
  }, [sortedServers, inputMode]);

  return (
    <>
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

      <div 
        ref={scrollContainerRef}
        className="ore-multiplayer-scroll ore-multiplayer-scroll--directory"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent, black 3rem, black calc(100% - 3rem), transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 3rem, black calc(100% - 3rem), transparent)'
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
          <Virtuoso
            ref={virtuosoRef}
            data={sortedServers}
            context={virtuosoContext}
            rangeChanged={(range) => {
              visibleRange.current = range;
            }}
            itemContent={(_index, server, context) => (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '1.25rem max(1rem, 3vw)' }}>
                <OnlineServerCard
                  server={server}
                  liveStatus={context.liveStatuses[server.id] || null}
                  onArrowPress={context.handleServerArrow}
                  onClick={(currentServer) => context.setSelectedServer(currentServer)}
                />
              </div>
            )}
            components={virtuosoComponents}
            style={{ height: '100%', width: '100%' }}
            itemSize={() => 520}
            initialTopMostItemIndex={{ index: 0, align: 'center' }}
          />
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
