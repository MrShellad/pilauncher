import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Check,
  Copy,
  DollarSign,
  ExternalLink,
  FileText,
  Globe,
  MessageCircle,
  MessageSquare,
  Play,
  Server,
  ShieldCheck,
  Swords,
  Tv,
  Twitter,
  Users,
  X,
  Youtube,
} from 'lucide-react';
import type { FeatureTag, OnlineServer, SocialLink } from '../types';
import { copyText, openLink } from '../utils';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { focusManager } from '../../../ui/focus/FocusManager';
import { useInputAction } from '../../../ui/focus/InputDriver';
import { useInputMode } from '../../../ui/focus/FocusProvider';

interface CachedImageEntry {
  objectUrl?: string;
  promise?: Promise<string>;
}

const globalImageCache = new Map<string, CachedImageEntry>();

const loadCachedImage = (src: string) => {
  const cached = globalImageCache.get(src);
  if (cached?.objectUrl) return Promise.resolve(cached.objectUrl);
  if (cached?.promise) return cached.promise;

  const promise = fetch(src, { cache: 'force-cache' })
    .then((res) => {
      if (!res.ok) throw new Error('Network response was not ok');
      return res.blob();
    })
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      globalImageCache.set(src, { objectUrl });
      return objectUrl;
    })
    .catch((error) => {
      globalImageCache.delete(src);
      throw error;
    });

  globalImageCache.set(src, { promise });
  return promise;
};

const CachedImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement> & { src?: string }> = ({ src, ...props }) => {
  const [cachedSrc, setCachedSrc] = useState<string>(() => {
    if (!src) return '';
    return globalImageCache.get(src)?.objectUrl || '';
  });

  useEffect(() => {
    if (!src) {
      setCachedSrc('');
      return;
    }

    const objectUrl = globalImageCache.get(src)?.objectUrl;
    if (objectUrl) {
      setCachedSrc(objectUrl);
      return;
    }

    let isActive = true;
    setCachedSrc('');

    loadCachedImage(src)
      .then((url) => {
        if (isActive) setCachedSrc(url);
      })
      .catch(() => {
        if (isActive) setCachedSrc(src);
      });

    return () => {
      isActive = false;
    };
  }, [src]);

  return <img src={cachedSrc || undefined} {...props} />;
};


const CardYHandler: React.FC<{ focused: boolean; onAction: () => void }> = ({ focused, onAction }) => {
  const actionRef = useRef(onAction);

  useEffect(() => {
    actionRef.current = onAction;
  }, [onAction]);

  useInputAction(
    'ACTION_Y',
    useCallback(() => {
      if (focused) {
        actionRef.current();
      }
    }, [focused])
  );

  return null;
};

interface OnlineServerCardProps {
  server: OnlineServer;
  liveStatus: LiveStatus | null;
  onArrowPress: (direction: string) => boolean | void;
  onClick?: (server: OnlineServer) => void;
}

interface DrawerLink {
  label: string;
  url: string;
  isWebsite: boolean;
  platform: string;
}

interface LiveStatus {
  isOnline: boolean;
  online?: number;
  max?: number;
}

interface FooterFeature {
  title: string;
  subtitle: string;
  icon: React.ElementType<{ size?: number; className?: string }>;
  iconSvg?: string;
  color?: string;
  minWidthClass?: string;
}



const localizeServerType = (server: OnlineServer): string => {
  const normalizedType = server.serverType?.trim().toLowerCase();

  if (server.isModded || normalizedType === 'modded') {
    return '模组服';
  }

  if (normalizedType === 'plugin') {
    return '插件服';
  }

  if (normalizedType === 'vanilla') {
    return '纯净服';
  }

  return server.serverType?.trim() || '社区服';
};

const formatPlayers = (server: OnlineServer, liveStatus: LiveStatus | null) => {
  if (liveStatus) {
    if (!liveStatus.isOnline) {
      return '离线';
    }

    if (liveStatus.online !== undefined) {
      return liveStatus.max !== undefined
        ? `${liveStatus.online.toLocaleString()}/${liveStatus.max.toLocaleString()}`
        : liveStatus.online.toLocaleString();
    }
  }

  return server.maxPlayers
    ? `${server.onlinePlayers.toLocaleString()}/${server.maxPlayers.toLocaleString()}`
    : server.onlinePlayers.toLocaleString();
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

const normalizeFeatureLabel = (feature?: FeatureTag) => feature?.label?.trim();

const makeFooterFeature = (
  feature: FeatureTag | undefined,
  subtitle: string,
  icon: FooterFeature['icon'],
  minWidthClass?: string
): FooterFeature | null => {
  const title = normalizeFeatureLabel(feature);
  if (!title) {
    return null;
  }

  return {
    title,
    subtitle,
    icon,
    iconSvg: feature?.iconSvg?.trim(),
    color: feature?.color?.trim(),
    minWidthClass,
  };
};

const getFooterFeatures = (server: OnlineServer): FooterFeature[] => {
  const primarySlots = [
    makeFooterFeature(server.features?.[0], '服务器特色', Swords),
    makeFooterFeature(server.mechanics?.[0], '核心机制', Box, 'hidden sm:flex'),
    makeFooterFeature(server.elements?.[0], '世界元素', ShieldCheck, 'hidden md:flex'),
    makeFooterFeature(server.community?.[0], '社区氛围', Users, 'hidden lg:flex'),
  ].filter((feature): feature is FooterFeature => Boolean(feature));

  const remainingSlots = [
    ...(server.features || []).slice(1).map((feature) => makeFooterFeature(feature, '服务器特色', Swords)),
    ...(server.mechanics || []).slice(1).map((feature) => makeFooterFeature(feature, '核心机制', Box)),
    ...(server.elements || []).slice(1).map((feature) => makeFooterFeature(feature, '世界元素', ShieldCheck)),
    ...(server.community || []).slice(1).map((feature) => makeFooterFeature(feature, '社区氛围', Users)),
  ].filter((feature): feature is FooterFeature => Boolean(feature));

  const apiFeatures = [...primarySlots, ...remainingSlots].slice(0, 4).map((feature, index) => ({
    ...feature,
    minWidthClass: index === 0 ? undefined : feature.minWidthClass || ['hidden sm:flex', 'hidden md:flex', 'hidden lg:flex'][index - 1],
  }));

  if (apiFeatures.length) {
    return apiFeatures;
  }

  const mechanicsFeature = normalizeFeatureLabel(server.mechanics?.[0]) || normalizeFeatureLabel(server.elements?.[0]);
  const communityFeature = normalizeFeatureLabel(server.community?.[0]);

  return [
    {
      title: server.tags?.[0]?.trim() || '多样玩法',
      subtitle: server.isModded ? '模组、探索、养成多线并行' : '生存、建造、冒险多种模式',
      icon: Swords,
    },
    {
      title: mechanicsFeature || '自由建造',
      subtitle: '发挥创意，打造独一无二',
      icon: Box,
      minWidthClass: 'hidden sm:flex',
    },
    {
      title: communityFeature || '友好社区',
      subtitle: server.hasVoiceChat ? '语音联机，快速组队' : '结识伙伴，共同成长',
      icon: Users,
      minWidthClass: 'hidden md:flex',
    },
    {
      title: server.requiresWhitelist ? '白名单准入' : '稳定流畅',
      subtitle: server.requiresWhitelist ? '审核后加入，环境更纯净' : '优质服务器，畅快体验',
      icon: ShieldCheck,
      minWidthClass: 'hidden lg:flex',
    },
  ];
};

const FooterFeatureIcon: React.FC<{ feature: FooterFeature }> = ({ feature }) => {
  const Icon = feature.icon;
  const iconStyle = feature.color ? { color: feature.color } : undefined;

  if (feature.iconSvg?.startsWith('<svg')) {
    return (
      <span
        className="flex h-[1.75rem] w-[1.75rem] items-center justify-center [&_svg]:h-full [&_svg]:w-full"
        style={iconStyle}
        dangerouslySetInnerHTML={{ __html: feature.iconSvg }}
      />
    );
  }

  return <Icon className="h-[1.75rem] w-[1.75rem]" style={iconStyle} />;
};

const AgeRatingIcon: React.FC<{ label: string }> = ({ label }) => (
  <svg className="h-[1.25rem] w-[1.25rem] text-green-400" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18" />
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
    <text
      x="12"
      y="13.25"
      fill="currentColor"
      fontFamily="Arial, sans-serif"
      fontSize={label.length > 2 ? 6 : 8}
      fontWeight="700"
      textAnchor="middle"
      dominantBaseline="middle"
    >
      {label}
    </text>
  </svg>
);

const SocialIcon: React.FC<{ platform: string; isWebsite: boolean; size?: number; className?: string }> = ({
  platform,
  isWebsite,
  size = 16,
  className,
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
  const playerCount = formatPlayers(server, liveStatus);
  const drawerLinks = useMemo(() => getDrawerLinks(server), [server]);
  const footerFeatures = useMemo(() => getFooterFeatures(server), [server]);
  const versionLabel = server.versions?.[0]?.trim();
  const genreLabel = (server.tags?.slice(0, 4).join(' · ') || `${serverTypeLabel} · ${server.isModded ? '模组' : '原版'} · 社交`).trim();
  const description = server.description?.trim() || '这是一个经过精选收录的社区服务器，展开后可查看详细介绍与外部入口。';
  const heroImage = server.hero || server.icon;
  const isLiveOffline = liveStatus?.isOnline === false;

  const handleToggleDrawer = () => {
    setIsExpanded(!isExpanded);
  };

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
      className={`group relative h-[30rem] w-[min(90vw,80rem)] font-minecraft flex-[0_0_auto] overflow-hidden rounded-[1rem] border bg-[#111827] transition-[border-color,box-shadow,filter] duration-300 ${isCardFocused ? 'border-green-300/45 shadow-[0_1.5rem_3.5rem_rgba(0,0,0,0.58),0_0_2rem_rgba(108,195,73,0.2)] brightness-[1.04]' : 'border-white/10 shadow-[0_1.25rem_3.125rem_rgba(0,0,0,0.5)]'
        }`}
      style={{ scrollSnapAlign: 'center', contentVisibility: 'auto', containIntrinsicSize: '30rem' }}
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
      {heroImage ? (
        <CachedImage
          src={heroImage}
          alt={server.name}
          className={`absolute inset-0 z-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 ${server.hero ? '' : 'scale-105 blur-[0.125rem]'
            }`}
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-gradient-to-br from-[#24342a] via-[#1e293b] to-[#111827] text-white/25">
          <Server size={80} />
        </div>
      )}

      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/40 via-transparent to-black/20" />

      <div className="absolute left-1/2 top-[1.25rem] z-40 flex -translate-x-1/2 items-center gap-[0.5rem] rounded-full border border-purple-400/30 bg-black/40 px-[1.25rem] py-[0.375rem] shadow-lg backdrop-blur-md transition-colors hover:bg-black/60">
        <span className="relative flex h-[0.625rem] w-[0.625rem]">
          <span className={`absolute inline-flex h-full w-full rounded-full ${isLiveOffline ? 'bg-gray-400' : 'animate-ping bg-purple-400'} opacity-75`} />
          <span className={`relative inline-flex h-[0.625rem] w-[0.625rem] rounded-full ${isLiveOffline ? 'bg-gray-400' : 'bg-purple-500'}`} />
        </span>
        <span className="pt-[0.0625rem] text-[1.125rem] font-black leading-none tracking-wide text-white">{playerCount}</span>
      </div>

      <div className="absolute right-[1.25rem] top-[1.25rem] z-40 flex max-w-[calc(100%-2.5rem)] flex-row flex-wrap justify-end gap-[0.5rem]">
        <div className="flex items-center gap-[0.375rem] rounded-[1rem] border border-teal-400/30 bg-black/40 px-[0.75rem] py-[0.25rem] shadow-lg backdrop-blur-md transition-colors hover:bg-black/60">
          <Server className="h-[1rem] w-[1rem] text-teal-400" />
          <span className="pt-[0.0625rem] text-[0.875rem] font-normal leading-none tracking-wide text-white">{serverTypeLabel}</span>
        </div>

        {versionLabel && (
          <div className="flex items-center gap-[0.375rem] rounded-[1rem] border border-blue-400/30 bg-black/40 px-[0.75rem] py-[0.25rem] shadow-lg backdrop-blur-md transition-colors hover:bg-black/60">
            <Box className="h-[1rem] w-[1rem] text-blue-400" />
            <span className="pt-[0.0625rem] text-[0.875rem] font-normal leading-none tracking-wide text-white">{versionLabel}</span>
          </div>
        )}

        {server.ageRecommendation && (
          <div className="flex items-center gap-[0.375rem] rounded-[1rem] border border-white/20 bg-black/40 px-[0.75rem] py-[0.25rem] shadow-lg backdrop-blur-md transition-colors hover:bg-black/60">
            <AgeRatingIcon label={server.ageRecommendation} />
            <span className="pt-[0.0625rem] text-[0.75rem] font-normal leading-none tracking-wide text-white/90">全年龄</span>
          </div>
        )}

        {server.hasPaidFeatures && (
          <div className="flex items-center gap-[0.375rem] rounded-[1rem] border border-white/20 bg-black/40 px-[0.75rem] py-[0.25rem] shadow-lg backdrop-blur-md transition-colors hover:bg-black/60">
            <DollarSign className="h-[1rem] w-[1rem] text-yellow-400" />
            <span className="pt-[0.0625rem] text-[0.75rem] font-normal leading-none tracking-wide text-white/90">含内购</span>
          </div>
        )}

        {server.requiresWhitelist && (
          <div className="flex items-center gap-[0.375rem] rounded-[1rem] border border-amber-300/30 bg-black/40 px-[0.75rem] py-[0.25rem] shadow-lg backdrop-blur-md transition-colors hover:bg-black/60">
            <AlertTriangle className="h-[1rem] w-[1rem] text-amber-300" />
            <span className="pt-[0.0625rem] text-[0.75rem] font-normal leading-none tracking-wide text-white/90">白名单</span>
          </div>
        )}
      </div>

      <button
        type="button"
        className={`absolute inset-x-0 bottom-[5.5rem] top-0 z-20 flex cursor-pointer flex-col items-center px-[2rem] pt-[4.5rem] text-center transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isExpanded ? 'pointer-events-none scale-95 opacity-0' : 'scale-100 opacity-100'
          }`}
        onClick={handleToggleDrawer}
        aria-expanded={isExpanded}
      >
        {server.icon ? (
          <CachedImage
            src={server.icon}
            alt={server.name}
            className="h-[6rem] md:h-[8rem] object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-[6rem] w-[6rem] items-center justify-center rounded-[1rem] bg-white/10 shadow-[0_0.5rem_1.5rem_rgba(0,0,0,0.5)] backdrop-blur-md md:h-[8rem] md:w-[8rem]">
            <Server className="h-[3rem] w-[3rem] text-white/50 md:h-[4rem] md:w-[4rem]" />
          </div>
        )}

        <div className="mt-[1.5rem] max-w-full border-[0.25rem] border-[#38531D] bg-[#5B8731] px-[2rem] py-[0.5rem] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.3),0_0.25rem_0.625rem_rgba(0,0,0,0.5)]">
          <span className="block overflow-hidden text-ellipsis whitespace-nowrap pt-[0.125rem] text-[1rem] font-bold leading-none tracking-widest text-white drop-shadow-md md:text-[1.125rem]">
            {genreLabel}
          </span>
        </div>

        <div className="mt-[1rem] flex items-center gap-[0.5rem] text-[0.875rem] font-medium text-gray-100 drop-shadow-lg">
          <span className="text-[0.75rem] text-green-400">◆</span>
          <span>{inputMode === 'controller' ? '按 Y 查看服务器详情' : '点击卡片查看服务器详情'}</span>
          <span className="text-[0.75rem] text-green-400">◆</span>
        </div>
      </button>

      <div
        role="button"
        tabIndex={-1}
        className={`absolute inset-x-0 bottom-[5.5rem] top-0 z-20 flex cursor-pointer flex-col items-center justify-center bg-black/60 px-[10%] backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isExpanded ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-105 opacity-0'
          }`}
        onClick={handleToggleDrawer}
      >
        <div className="absolute left-[2rem] top-[2rem] flex items-center gap-[0.5rem] text-[0.875rem] font-bold text-gray-400 transition-colors hover:text-white">
          <ArrowLeft className="h-[1.25rem] w-[1.25rem]" />
          点击空白处返回封面
        </div>

        <div className="flex w-full max-w-[50rem] flex-col items-center">
          <h3
            className="mb-[1.5rem] flex cursor-text items-center gap-[0.75rem] text-[2rem] font-bold leading-none text-white"
            onClick={(event) => event.stopPropagation()}
          >
            <FileText className="h-[2rem] w-[2rem] text-green-400" />
            {server.name}
          </h3>

          <div
            className="mb-[2rem] max-h-[11rem] cursor-text overflow-y-auto text-center text-[1rem] leading-[1.75] text-gray-200 selection:bg-green-500/30 selection:text-white"
            onClick={(event) => event.stopPropagation()}
            dangerouslySetInnerHTML={{ __html: description }}
          />

          {drawerLinks.length > 0 && (
            <div className="flex w-full flex-row flex-wrap justify-center gap-[1rem]">
              {drawerLinks.slice(0, 4).map((link, index) => (
                <button
                  key={`${link.url}-${index}`}
                  type="button"
                  className={`flex h-[3.5rem] min-w-[11rem] flex-row items-center justify-center gap-[0.5rem] rounded-[0.75rem] border border-white/10 px-[2rem] text-[1rem] font-bold text-white transition-all hover:-translate-y-[0.125rem] ${link.platform.includes('discord')
                    ? 'bg-[#5865F2]/90 shadow-[0_0.5rem_1rem_rgba(88,101,242,0.2)] hover:bg-[#5865F2]'
                    : 'bg-white/10 hover:bg-white/20'
                    }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void openLink(link.url);
                  }}
                  title={link.label}
                >
                  <SocialIcon platform={link.platform} isWebsite={link.isWebsite} size={20} />
                  {link.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 z-30 flex h-[5.5rem] w-full flex-row border-t border-white/15 bg-black/40 backdrop-blur-xl">
        <div className="z-30 flex h-full flex-1 flex-row divide-x divide-white/15 overflow-hidden">
          {footerFeatures.map((feature) => {
            return (
              <div
                key={`${feature.title}-${feature.subtitle}`}
                className={`${feature.minWidthClass || 'flex'} min-w-0 flex-1 flex-row items-center justify-center gap-[0.75rem] px-[0.5rem]`}
              >
                <div className="flex flex-shrink-0 items-center justify-center text-gray-300">
                  <FooterFeatureIcon feature={feature} />
                </div>
                <div className="flex min-w-0 flex-col justify-center gap-[0.375rem] text-left -translate-y-[0.125rem]">
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[1rem] font-bold leading-none text-white">{feature.title}</span>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.75rem] leading-none text-gray-400">{feature.subtitle}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="z-30 flex h-full flex-row items-stretch shadow-[-0.625rem_0_1.25rem_rgba(0,0,0,0.3)]">
          <FocusItem focusKey={`server-card-${server.id}-copy`} onArrowPress={onArrowPress} onEnter={handleCopyIp} onFocus={handleChildFocused} autoScroll={false}>
            {({ ref, focused }) => (
              <>
                <CardYHandler focused={focused} onAction={handleToggleDrawer} />
                <button
                  ref={ref as React.RefObject<HTMLButtonElement>}
                  type="button"
                  className={`flex h-full w-[5.5rem] items-center justify-center border-l border-white/15 text-white transition-[background-color,color,filter] hover:bg-black/55 disabled:cursor-not-allowed disabled:opacity-50 ${focused && inputMode !== 'mouse' ? 'z-10 bg-black/65 text-green-200 brightness-110' : 'bg-black/35'
                    }`}
                  onClick={handleCopyIp}
                  disabled={!server.address}
                  tabIndex={-1}
                  title={copyState === 'success' ? '已复制 IP' : copyState === 'error' ? '复制失败' : '复制 IP'}
                >
                  {copyState === 'success' ? <Check className="h-[1.5rem] w-[1.5rem] text-green-300" /> : copyState === 'error' ? <X className="h-[1.5rem] w-[1.5rem] text-red-300" /> : <Copy className="h-[1.5rem] w-[1.5rem]" />}
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
                  className={`flex h-full flex-row items-center justify-center gap-[1rem] border-l px-[2rem] text-white transition-[background-color,border-color,filter] hover:border-[#C084FC] hover:bg-[#9333EA] disabled:cursor-not-allowed disabled:opacity-60 md:px-[3rem] ${focused && inputMode !== 'mouse' ? 'z-10 border-[#C084FC] bg-[#9333EA] brightness-110' : 'border-[#83C148] bg-[#5B8731]'
                    }`}
                  onClick={() => onClick?.(server)}
                  disabled={!onClick}
                  tabIndex={-1}
                >
                  <Play className="h-[2rem] w-[2rem] fill-current drop-shadow-md" />
                  <span className="whitespace-nowrap text-[1.25rem] font-black leading-none drop-shadow">立即加入</span>
                </button>
              </>
            )}
          </FocusItem>
        </div>
      </div>
    </article>
  );
};
