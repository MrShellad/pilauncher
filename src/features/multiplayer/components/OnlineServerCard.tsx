import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Globe, MessageCircle, MessageSquare, Server, Tv, Twitter, Youtube } from 'lucide-react';
import type { OnlineServer, SocialLink } from '../types';
import { copyText, openLink } from '../utils';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { focusManager } from '../../../ui/focus/FocusManager';
import { useInputAction } from '../../../ui/focus/InputDriver';
import { useInputMode } from '../../../ui/focus/FocusProvider';

/** Headless handler: listens for ACTION_Y and toggles the drawer only when this card is focused */
const CardYHandler: React.FC<{ focused: boolean; onAction: () => void }> = ({ focused, onAction }) => {
  const actionRef = useRef(onAction);
  useEffect(() => { actionRef.current = onAction; }, [onAction]);

  useInputAction('ACTION_Y', useCallback(() => {
    if (focused) {
      actionRef.current();
    }
  }, [focused]));

  return null;
};

interface OnlineServerCardProps {
  server: OnlineServer;
  onArrowPress: (direction: string) => boolean | void;
  onClick?: (server: OnlineServer) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

type WarningTone = 'version' | 'age' | 'paid';

interface WarningChip {
  tone: WarningTone;
  label: string;
}

interface DrawerLink {
  label: string;
  url: string;
  isWebsite: boolean;
  platform: string;
}

const localizeServerType = (server: OnlineServer): string => {
  const normalizedType = server.serverType?.trim().toLowerCase();
  
  if (server.isModded || normalizedType === 'modded') {
    return 'MOD服';
  }
  
  if (normalizedType === 'plugin') {
    return '插件服';
  }

  if (normalizedType === 'vanilla') {
    return '纯净服';
  }

  return server.serverType?.trim() || '社区服';
};

const getWarningChips = (server: OnlineServer): WarningChip[] => {
  const chips: WarningChip[] = [];

  if (server.versions?.length) {
    chips.push({
      tone: 'version',
      label: server.versions[0],
    });
  }

  if (server.ageRecommendation) {
    chips.push({
      tone: 'age',
      label: server.ageRecommendation,
    });
  }

  if (server.hasPaidFeatures) {
    chips.push({
      tone: 'paid',
      label: '含内购',
    });
  }

  return chips;
};

interface LiveStatus {
  isOnline: boolean;
  online?: number;
  max?: number;
}

const getMetaTags = (
  server: OnlineServer, 
  serverTypeLabel: string,
  liveStatus: LiveStatus | null
): Array<{ tone: 'green' | 'blue'; label: string }> => {
  const tags: Array<{ tone: 'green' | 'blue'; label: string }> = [];

  let playerLabel = server.maxPlayers
    ? `${server.onlinePlayers}/${server.maxPlayers} 在线`
    : `${server.onlinePlayers} 在线`;

  if (liveStatus) {
    if (liveStatus.isOnline && liveStatus.online !== undefined) {
      playerLabel = liveStatus.max !== undefined
        ? `${liveStatus.online}/${liveStatus.max} 在线`
        : `${liveStatus.online} 在线`;
    } else if (!liveStatus.isOnline) {
      playerLabel = '离线 / 检索中';
    }
  }

  tags.push({ tone: 'green', label: playerLabel });

  if (serverTypeLabel) {
    tags.push({ tone: 'blue', label: serverTypeLabel });
  }

  tags.push({
    tone: 'blue',
    label: server.isModded ? '模组整合' : '纯净原版',
  });

  if (server.requiresWhitelist) {
    tags.push({
      tone: 'blue',
      label: '白名单准入',
    });
  } else if (server.hasVoiceChat) {
    tags.push({
      tone: 'blue',
      label: '语音社群',
    });
  }

  return tags.slice(0, 4);
};

const getDrawerLinks = (server: OnlineServer): DrawerLink[] => {
  const seen = new Set<string>();
  const links: DrawerLink[] = [];

  const pushLink = (label: string, url?: string) => {
    const href = url?.trim();
    if (!href || seen.has(href)) {
      return;
    }

    seen.add(href);
    const lowerLabel = label.toLowerCase();
    const isWebsite =
      lowerLabel.includes('官网') ||
      lowerLabel.includes('网站') ||
      lowerLabel.includes('网页') ||
      lowerLabel.includes('web');

    links.push({
      label,
      url: href,
      isWebsite,
      platform: lowerLabel,
    });
  };

  pushLink('官方网站', server.homepageUrl);
  server.socials.forEach((social: SocialLink) => pushLink(social.label || '社区链接', social.url));

  return links;
};

const WarningIcon: React.FC<{ tone: WarningTone }> = ({ tone }) => {
  if (tone === 'version') {
    return (
      <svg className="ore-online-server-card__warning-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM12 22.27L5 18.27v-8.54L12 13.73v8.54zm1-8.54 7-4v8.54l-7 4v-8.54zM12 11.73 5 7.73l7-4 7 4-7 4z" />
      </svg>
    );
  }

  if (tone === 'age') {
    return (
      <svg className="ore-online-server-card__warning-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
    );
  }

  return (
    <svg className="ore-online-server-card__warning-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  );
};

const SocialIcon: React.FC<{ platform: string; isWebsite: boolean; size?: number; className?: string }> = ({ 
  platform, 
  isWebsite, 
  size = 16, 
  className 
}) => {
  if (isWebsite || platform.includes('官网') || platform.includes('网站') || platform.includes('web')) {
    return <Globe size={size} className={className} />;
  }

  if (platform.includes('qq') || platform.includes('群') || platform.includes('协作')) {
    return <MessageSquare size={size} className={className} />;
  }

  if (platform.includes('bilibili') || platform.includes('哔哩哔哩') || platform.includes('b站') || platform.includes('tv')) {
    return <Tv size={size} className={className} />;
  }

  if (platform.includes('discord')) {
    return <MessageCircle size={size} className={className} />;
  }

  if (platform.includes('youtube') || platform.includes('视频')) {
    return <Youtube size={size} className={className} />;
  }

  if (platform.includes('twitter') || platform.includes('x')) {
    return <Twitter size={size} className={className} />;
  }

  return <ExternalLink size={size} className={className} />;
};

export const OnlineServerCard: React.FC<OnlineServerCardProps> = ({ server, onArrowPress, onClick, isExpanded, onToggleExpand }) => {
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const inputMode = useInputMode();

  useEffect(() => {
    if (copyState === 'idle') {
      return undefined;
    }

    const timer = window.setTimeout(() => setCopyState('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  useEffect(() => {
    if (!server.address) return;
    let mounted = true;
    
    const fetchStatus = async () => {
      try {
        const res = await fetch(`https://api.mcstatus.io/v2/status/java/${server.address}`);
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) {
          setLiveStatus({
            isOnline: data.online,
            online: data.players?.online,
            max: data.players?.max
          });
        }
      } catch (e) {
        // ignore
      }
    };

    void fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [server.address]);

  const serverTypeLabel = localizeServerType(server);
  const warningChips = useMemo(() => getWarningChips(server), [server]);
  const metaTags = useMemo(() => getMetaTags(server, serverTypeLabel, liveStatus), [server, serverTypeLabel, liveStatus]);
  const drawerLinks = useMemo(() => getDrawerLinks(server), [server]);
  const description =
    server.description?.trim() ||
    '这是一个经过精选收录的社区服务器，展开后可查看详细介绍与外部入口。';

  const handleToggleDrawer = () => {
    onToggleExpand();
  };

  const [isCardFocused, setIsCardFocused] = useState(false);

  // Scroll the card into view when any child FocusItem gets focused (focus-follow)
  const handleChildFocused = useCallback(() => {
    if (inputMode !== 'mouse' && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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

  const handleCardClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const fromInteractive = !!target.closest('button, a, [role="button"]');

    if (!isCardFocused) {
      focusManager.focus(`server-card-${server.id}-play`);
    }

    // Scroll this card to the horizontal center of the scroll container
    if (cardRef.current) {
      const scrollContainer = cardRef.current.closest('.ore-multiplayer-scroll--directory');
      if (scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const cardRect = cardRef.current.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const containerCenter = containerRect.left + containerRect.width / 2;
        const offset = cardCenter - containerCenter;
        scrollContainer.scrollBy({ left: offset, behavior: 'smooth' });
      }
    }

    // Only auto-expand from non-interactive areas (buttons handle their own toggle)
    if (!fromInteractive && !isExpanded) {
      onToggleExpand();
    }
  };

  return (
    <article 
      ref={cardRef}
      className={`ore-online-server-card ${isCardFocused ? 'is-focused' : ''}`} 
      onFocus={() => setIsCardFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsCardFocused(false);
        }
      }}
      onClick={handleCardClick}
      onKeyDown={(event) => {
        if (event.key.toLowerCase() === 'y') {
          event.preventDefault();
          handleToggleDrawer();
        }
      }}
    >
      <button
        type="button"
        className="ore-online-server-card__hero-trigger"
        onClick={handleToggleDrawer}
        aria-expanded={isExpanded}
      >
        <div className="ore-online-server-card__hero-image">
          {server.hero ? (
            <img
              src={server.hero}
              alt={server.name}
              className="ore-online-server-card__hero-media"
              loading="lazy"
            />
          ) : server.icon ? (
            <img
              src={server.icon}
              alt={server.name}
              className="ore-online-server-card__hero-media ore-online-server-card__hero-media--soft"
              loading="lazy"
            />
          ) : (
            <div className="ore-online-server-card__hero-placeholder">
              <Server size={56} />
            </div>
          )}

          <div className="ore-online-server-card__hero-gradient" />

          <div className="ore-online-server-card__gamepad-hint">
            <span className="ore-online-server-card__gamepad-button">Y</span>
            <span>{isExpanded ? '收起详情' : '展开详情'}</span>
          </div>

          <div className="ore-online-server-card__hero-bottom">
            <h3 className="ore-online-server-card__hero-title">{server.name}</h3>

            {warningChips.length > 0 && (
              <div className="ore-online-server-card__warnings">
                {warningChips.map((chip) => (
                  <span
                    key={`${chip.tone}-${chip.label}`}
                    className={`ore-online-server-card__warning ore-online-server-card__warning--${chip.tone}`}
                  >
                    <WarningIcon tone={chip.tone} />
                    {chip.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </button>

      <div className="ore-online-server-card__meta-row">
        {metaTags.map((tag) => (
          <span
            key={`${tag.tone}-${tag.label}`}
            className={`ore-online-server-card__meta-tag ore-online-server-card__meta-tag--${tag.tone}`}
          >
            {tag.label}
          </span>
        ))}
      </div>

      <div className={`ore-online-server-card__drawer ${isExpanded ? 'is-open' : ''}`}>
        <div className="ore-online-server-card__drawer-inner">
          <div className="ore-online-server-card__drawer-content">
            <div className="ore-online-server-card__description" dangerouslySetInnerHTML={{ __html: description }} />

            {drawerLinks.length > 0 && (
              <div className="ore-online-server-card__links">
                {drawerLinks.map((link, index) => (
                  <button
                    key={`${link.url}-${index}`}
                    type="button"
                    className="ore-online-server-card__link-block"
                    onClick={() => void openLink(link.url)}
                    title={link.label}
                  >
                    <span className="ore-online-server-card__link-title">
                      <SocialIcon 
                        platform={link.platform} 
                        isWebsite={link.isWebsite} 
                        className="ore-online-server-card__link-icon"
                      />
                      {link.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="ore-online-server-card__action-bar">
        <FocusItem focusKey={`server-card-${server.id}-copy`} onArrowPress={onArrowPress} onEnter={handleCopyIp} onFocus={handleChildFocused} autoScroll={false}>
          {({ ref, focused }) => (
            <>
            <CardYHandler focused={focused} onAction={handleToggleDrawer} />
            <button
              ref={ref as React.RefObject<HTMLButtonElement>}
              type="button"
              className={`ore-online-server-card__action ore-online-server-card__action--secondary ${focused ? 'outline outline-2 outline-offset-2 outline-white z-10' : ''}`}
              onClick={handleCopyIp}
              disabled={!server.address}
              tabIndex={-1}
            >
              {copyState === 'success'
                ? '已复制 IP'
                : copyState === 'error'
                  ? '复制失败'
                  : '复制 IP'}
            </button>
            </>
          )}
        </FocusItem>
        <FocusItem focusKey={`server-card-${server.id}-play`} onArrowPress={onArrowPress} onEnter={() => onClick?.(server)} onFocus={handleChildFocused} autoScroll={false}>
          {({ ref, focused }) => (
            <>
            <CardYHandler focused={focused} onAction={handleToggleDrawer} />
            <button
              ref={ref as React.RefObject<HTMLButtonElement>}
              type="button"
              className={`ore-online-server-card__action ore-online-server-card__action--primary ${focused ? 'outline outline-2 outline-offset-2 outline-white z-10' : ''}`}
              onClick={() => onClick?.(server)}
              disabled={!onClick}
              tabIndex={-1}
            >
              进入游戏
            </button>
            </>
          )}
        </FocusItem>
      </div>
    </article>
  );
};
