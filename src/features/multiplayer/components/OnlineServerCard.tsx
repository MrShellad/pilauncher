import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { focusManager } from '@/ui/focus/FocusManager';
import { useInputMode } from '@/ui/focus/FocusProvider';
import type { OnlineServer } from '../types';
import { copyText } from '../utils';
import { OnlineServerCardBody } from './OnlineServerCardBody';
import { OnlineServerCardFooter } from './OnlineServerCardFooter';
import {
  formatServerPlayers,
  getOnlineServerDrawerLinks,
  getOnlineServerFooterFeatures,
  localizeServerType,
  type OnlineServerLiveStatus,
} from './onlineServerCardModel';

interface OnlineServerCardProps {
  server: OnlineServer;
  liveStatus: OnlineServerLiveStatus | null;
  onArrowPress: (direction: string) => boolean | void;
  onClick?: (server: OnlineServer) => void;
}

export const OnlineServerCard: React.FC<OnlineServerCardProps> = ({
  server,
  liveStatus,
  onArrowPress,
  onClick,
}) => {
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const [isCardFocused, setIsCardFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const inputMode = useInputMode();

  useEffect(() => {
    if (copyState === 'idle') {
      return undefined;
    }

    const timer = window.setTimeout(() => setCopyState('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const serverTypeLabel = localizeServerType(server);
  const playerCount = formatServerPlayers(server, liveStatus);
  const drawerLinks = useMemo(() => getOnlineServerDrawerLinks(server), [server]);
  const footerFeatures = useMemo(() => getOnlineServerFooterFeatures(server), [server]);
  const versionLabel = server.versions?.[0]?.trim();
  const genreLabel = (
    server.tags?.slice(0, 4).join(' · ') ||
    `${serverTypeLabel} · ${server.isModded ? '模组' : '原版'} · 社交`
  ).trim();
  const description =
    server.description?.trim() ||
    '这是一个经过精选收录的社区服务器，展开后可查看详细介绍与外部入口。';
  const heroImage = server.hero || server.icon;
  const isLiveOffline = liveStatus?.isOnline === false;

  const handleToggleDrawer = () => {
    setIsExpanded(!isExpanded);
  };

  const handleChildFocused = useCallback(() => {
    if (inputMode !== 'mouse' && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [inputMode]);

  const handleCopyIp = async () => {
    try {
      const copied = await copyText(server.address);
      setCopyState(copied ? 'success' : 'error');
    } catch {
      setCopyState('error');
    }
  };

  const handleCardClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const fromInteractive = Boolean(target.closest('button, a, [role="button"]'));

    if (!isCardFocused) {
      focusManager.focus(`server-card-${server.id}-play`);
    }

    if (!fromInteractive && !isExpanded) {
      setIsExpanded(true);
    }
  };

  return (
    <article
      ref={cardRef}
      role="listitem"
      aria-label={`${server.name} - ${serverTypeLabel} - 版本 ${versionLabel || '未知'}`}
      className={`group relative h-[30rem] w-[min(90vw,80rem)] flex-[0_0_auto] overflow-hidden rounded-[1rem] border bg-[#111827] font-minecraft transition-[border-color,box-shadow,filter] duration-300 ${
        isCardFocused && inputMode !== 'mouse'
          ? 'border-[#F5C542] brightness-[1.04] shadow-[0_1.5rem_3.5rem_rgba(0,0,0,0.58),0_0_2rem_rgba(245,197,66,0.3)] ring-4 ring-[#F5C542]/45'
          : 'border-white/10 shadow-[0_1.25rem_3.125rem_rgba(0,0,0,0.5)]'
      }`}
      style={{
        scrollSnapAlign: 'center',
        contentVisibility: 'auto',
        containIntrinsicSize: '30rem',
      }}
      onFocus={() => setIsCardFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsCardFocused(false);
        }
      }}
      onClick={handleCardClick}
      onMouseEnter={() => {
        if (inputMode === 'mouse') {
          focusManager.focus(`server-card-${server.id}-play`);
        }
      }}
      onKeyDown={(event) => {
        if (event.key.toLowerCase() === 'y') {
          event.preventDefault();
          handleToggleDrawer();
        }
      }}
    >
      <OnlineServerCardBody
        server={server}
        heroImage={heroImage}
        serverTypeLabel={serverTypeLabel}
        playerCount={playerCount}
        versionLabel={versionLabel}
        genreLabel={genreLabel}
        description={description}
        isLiveOffline={isLiveOffline}
        isExpanded={isExpanded}
        drawerLinks={drawerLinks}
        inputMode={inputMode}
        onToggleDrawer={handleToggleDrawer}
      />

      <OnlineServerCardFooter
        server={server}
        footerFeatures={footerFeatures}
        copyState={copyState}
        inputMode={inputMode}
        onArrowPress={onArrowPress}
        onCopyIp={handleCopyIp}
        onPlay={() => onClick?.(server)}
        onToggleDrawer={handleToggleDrawer}
        onChildFocused={handleChildFocused}
        canPlay={Boolean(onClick)}
      />
    </article>
  );
};
