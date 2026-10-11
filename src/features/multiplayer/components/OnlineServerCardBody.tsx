import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  DollarSign,
  ExternalLink,
  FileText,
  Globe,
  MessageCircle,
  MessageSquare,
  Server,
  Tv,
  Twitter,
  Youtube,
} from 'lucide-react';

import type { InputMode } from '@/ui/focus/InputDriver';
import type { OnlineServer } from '../types';
import { openLink } from '../utils';
import { CachedServerImage } from './CachedServerImage';
import type { OnlineServerDrawerLink } from './onlineServerCardModel';

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

interface SocialIconProps {
  platform: string;
  isWebsite: boolean;
  size?: number;
  className?: string;
}

const SocialIcon: React.FC<SocialIconProps> = ({
  platform,
  isWebsite,
  size = 16,
  className,
}) => {
  if (
    isWebsite ||
    platform.includes('官网') ||
    platform.includes('网站') ||
    platform.includes('web')
  ) {
    return <Globe size={size} className={className} />;
  }

  if (platform.includes('qq') || platform.includes('群') || platform.includes('协作')) {
    return <MessageSquare size={size} className={className} />;
  }

  if (
    platform.includes('bilibili') ||
    platform.includes('哔哩哔哩') ||
    platform.includes('b站') ||
    platform.includes('tv')
  ) {
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

interface OnlineServerCardBodyProps {
  server: OnlineServer;
  heroImage?: string;
  serverTypeLabel: string;
  playerCount: string;
  versionLabel?: string;
  genreLabel: string;
  description: string;
  isLiveOffline: boolean;
  isExpanded: boolean;
  drawerLinks: OnlineServerDrawerLink[];
  inputMode: InputMode;
  onToggleDrawer: () => void;
}

export const OnlineServerCardBody: React.FC<OnlineServerCardBodyProps> = ({
  server,
  heroImage,
  serverTypeLabel,
  playerCount,
  versionLabel,
  genreLabel,
  description,
  isLiveOffline,
  isExpanded,
  drawerLinks,
  inputMode,
  onToggleDrawer,
}) => (
  <>
    {heroImage ? (
      <CachedServerImage
        src={heroImage}
        alt={server.name}
        className={`absolute inset-0 z-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 ${
          server.hero ? '' : 'scale-105 blur-[0.125rem]'
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
        <span
          className={`absolute inline-flex h-full w-full rounded-full ${
            isLiveOffline ? 'bg-gray-400' : 'animate-ping bg-purple-400'
          } opacity-75`}
        />
        <span
          className={`relative inline-flex h-[0.625rem] w-[0.625rem] rounded-full ${
            isLiveOffline ? 'bg-gray-400' : 'bg-purple-500'
          }`}
        />
      </span>
      <span className="pt-[0.0625rem] text-[1.125rem] font-black leading-none tracking-wide text-white">
        {playerCount}
      </span>
    </div>

    <div className="absolute right-[1.25rem] top-[1.25rem] z-40 flex max-w-[calc(100%-2.5rem)] flex-row flex-wrap justify-end gap-[0.5rem]">
      <div className="flex items-center gap-[0.375rem] rounded-[1rem] border border-teal-400/30 bg-black/40 px-[0.75rem] py-[0.25rem] shadow-lg backdrop-blur-md transition-colors hover:bg-black/60">
        <Server className="h-[1rem] w-[1rem] text-teal-400" />
        <span className="pt-[0.0625rem] text-[0.875rem] font-normal leading-none tracking-wide text-white">
          {serverTypeLabel}
        </span>
      </div>

      {versionLabel && (
        <div className="flex items-center gap-[0.375rem] rounded-[1rem] border border-blue-400/30 bg-black/40 px-[0.75rem] py-[0.25rem] shadow-lg backdrop-blur-md transition-colors hover:bg-black/60">
          <Box className="h-[1rem] w-[1rem] text-blue-400" />
          <span className="pt-[0.0625rem] text-[0.875rem] font-normal leading-none tracking-wide text-white">
            {versionLabel}
          </span>
        </div>
      )}

      {server.ageRecommendation && (
        <div className="flex items-center gap-[0.375rem] rounded-[1rem] border border-white/20 bg-black/40 px-[0.75rem] py-[0.25rem] shadow-lg backdrop-blur-md transition-colors hover:bg-black/60">
          <AgeRatingIcon label={server.ageRecommendation} />
          <span className="pt-[0.0625rem] text-[0.75rem] font-normal leading-none tracking-wide text-white/90">
            全年龄
          </span>
        </div>
      )}

      {server.hasPaidFeatures && (
        <div className="flex items-center gap-[0.375rem] rounded-[1rem] border border-white/20 bg-black/40 px-[0.75rem] py-[0.25rem] shadow-lg backdrop-blur-md transition-colors hover:bg-black/60">
          <DollarSign className="h-[1rem] w-[1rem] text-yellow-400" />
          <span className="pt-[0.0625rem] text-[0.75rem] font-normal leading-none tracking-wide text-white/90">
            含内购
          </span>
        </div>
      )}

      {server.requiresWhitelist && (
        <div className="flex items-center gap-[0.375rem] rounded-[1rem] border border-amber-300/30 bg-black/40 px-[0.75rem] py-[0.25rem] shadow-lg backdrop-blur-md transition-colors hover:bg-black/60">
          <AlertTriangle className="h-[1rem] w-[1rem] text-amber-300" />
          <span className="pt-[0.0625rem] text-[0.75rem] font-normal leading-none tracking-wide text-white/90">
            白名单
          </span>
        </div>
      )}
    </div>

    <button
      type="button"
      className={`absolute inset-x-0 bottom-[5.5rem] top-0 z-20 flex cursor-pointer flex-col items-center px-[2rem] pt-[4.5rem] text-center transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        isExpanded
          ? 'pointer-events-none scale-95 opacity-0'
          : 'scale-100 opacity-100'
      }`}
      onClick={onToggleDrawer}
      aria-expanded={isExpanded}
    >
      {server.icon ? (
        <CachedServerImage
          src={server.icon}
          alt={server.name}
          className="h-[6rem] object-contain md:h-[8rem]"
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
        <span>
          {inputMode === 'controller'
            ? '按 Y 查看服务器详情'
            : '点击卡片查看服务器详情'}
        </span>
        <span className="text-[0.75rem] text-green-400">◆</span>
      </div>
    </button>

    <div
      role="button"
      tabIndex={-1}
      className={`absolute inset-x-0 bottom-[5.5rem] top-0 z-20 flex cursor-pointer flex-col items-center justify-center bg-black/60 px-[10%] backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        isExpanded
          ? 'pointer-events-auto scale-100 opacity-100'
          : 'pointer-events-none scale-105 opacity-0'
      }`}
      onClick={onToggleDrawer}
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
                className={`flex h-[3.5rem] min-w-[11rem] flex-row items-center justify-center gap-[0.5rem] rounded-[0.75rem] border border-white/10 px-[2rem] text-[1rem] font-bold text-white transition-all hover:-translate-y-[0.125rem] ${
                  link.platform.includes('discord')
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
  </>
);
