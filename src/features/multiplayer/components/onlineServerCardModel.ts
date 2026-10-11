import type { ElementType } from 'react';
import { Box, ShieldCheck, Swords, Users } from 'lucide-react';

import type { FeatureTag, OnlineServer, SocialLink } from '../types';

export interface OnlineServerLiveStatus {
  isOnline: boolean;
  online?: number;
  max?: number;
}

export interface OnlineServerDrawerLink {
  label: string;
  url: string;
  isWebsite: boolean;
  platform: string;
}

export interface OnlineServerFooterFeature {
  title: string;
  subtitle: string;
  icon: ElementType<{ size?: number; className?: string }>;
  iconSvg?: string;
  color?: string;
  minWidthClass?: string;
}

export const localizeServerType = (server: OnlineServer): string => {
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

export const formatServerPlayers = (
  server: OnlineServer,
  liveStatus: OnlineServerLiveStatus | null
) => {
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

export const getOnlineServerDrawerLinks = (
  server: OnlineServer
): OnlineServerDrawerLink[] => {
  const seen = new Set<string>();
  const links: OnlineServerDrawerLink[] = [];

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
  server.socials.forEach((social: SocialLink) =>
    pushLink(social.label || '社区链接', social.url)
  );

  return links;
};

const normalizeFeatureLabel = (feature?: FeatureTag) => feature?.label?.trim();

const makeFooterFeature = (
  feature: FeatureTag | undefined,
  subtitle: string,
  icon: OnlineServerFooterFeature['icon'],
  minWidthClass?: string
): OnlineServerFooterFeature | null => {
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

export const getOnlineServerFooterFeatures = (
  server: OnlineServer
): OnlineServerFooterFeature[] => {
  const primarySlots = [
    makeFooterFeature(server.features?.[0], '服务器特色', Swords),
    makeFooterFeature(server.mechanics?.[0], '核心机制', Box, 'hidden sm:flex'),
    makeFooterFeature(server.elements?.[0], '世界元素', ShieldCheck, 'hidden md:flex'),
    makeFooterFeature(server.community?.[0], '社区氛围', Users, 'hidden lg:flex'),
  ].filter((feature): feature is OnlineServerFooterFeature => Boolean(feature));

  const remainingSlots = [
    ...(server.features || [])
      .slice(1)
      .map((feature) => makeFooterFeature(feature, '服务器特色', Swords)),
    ...(server.mechanics || [])
      .slice(1)
      .map((feature) => makeFooterFeature(feature, '核心机制', Box)),
    ...(server.elements || [])
      .slice(1)
      .map((feature) => makeFooterFeature(feature, '世界元素', ShieldCheck)),
    ...(server.community || [])
      .slice(1)
      .map((feature) => makeFooterFeature(feature, '社区氛围', Users)),
  ].filter((feature): feature is OnlineServerFooterFeature => Boolean(feature));

  const apiFeatures = [...primarySlots, ...remainingSlots]
    .slice(0, 4)
    .map((feature, index) => ({
      ...feature,
      minWidthClass:
        index === 0
          ? undefined
          : feature.minWidthClass || ['hidden sm:flex', 'hidden md:flex', 'hidden lg:flex'][index - 1],
    }));

  if (apiFeatures.length) {
    return apiFeatures;
  }

  const mechanicsFeature =
    normalizeFeatureLabel(server.mechanics?.[0]) ||
    normalizeFeatureLabel(server.elements?.[0]);
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
