import { open as openExternal } from '@tauri-apps/plugin-shell';
import type { AdSlot, OnlineServer, SocialLink } from './types';

export const DEFAULT_AD_SLOTS: AdSlot[] = [
  {
    id: 'ad-slot-1',
    title: '广告位 01',
    description: '预留给推广服务器、版本活动或联名内容。',
  },
  {
    id: 'ad-slot-2',
    title: '广告位 02',
    description: '支持替换为远端 API 下发的推广素材。',
  },
  {
    id: 'ad-slot-3',
    title: '广告位 03',
    description: '保底展示位，确保列表底部始终至少有三个广告卡片。',
  }
];

export const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

export const getString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const getNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

export const getBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }

  return undefined;
};

export const pickFirst = <T,>(...values: (T | undefined)[]) => values.find((value) => value !== undefined);

export const normalizeSocials = (value: unknown): SocialLink[] => {
  if (!value) {
    return [];
  }

  if (typeof value === 'string') {
    return [{ label: '社交群', value }];
  }

  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        if (typeof item === 'string') {
          return {
            label: `社交 ${index + 1}`,
            value: item
          };
        }

        const record = toRecord(item);
        if (!record) {
          return null;
        }

        const label = pickFirst(
          getString(record.label),
          getString(record.type),
          getString(record.platform),
          getString(record.name)
        ) || `社交 ${index + 1}`;

        const displayValue = pickFirst(
          getString(record.value),
          getString(record.group),
          getString(record.handle),
          getString(record.invite),
          getString(record.url),
          getString(record.link)
        );

        if (!displayValue) {
          return null;
        }

        return {
          label,
          value: displayValue,
          url: pickFirst(getString(record.url), getString(record.link))
        };
      })
      .filter((item): item is SocialLink => Boolean(item));
  }

  const record = toRecord(value);
  if (!record) {
    return [];
  }

  return Object.entries(record)
    .map(([label, item]) => {
      if (typeof item === 'string') {
        return { label, value: item };
      }

      const entry = toRecord(item);
      if (!entry) {
        return null;
      }

      const displayValue = pickFirst(
        getString(entry.value),
        getString(entry.group),
        getString(entry.invite),
        getString(entry.url),
        getString(entry.link)
      );

      if (!displayValue) {
        return null;
      }

      return {
        label,
        value: displayValue,
        url: pickFirst(getString(entry.url), getString(entry.link))
      };
    })
    .filter((item): item is SocialLink => Boolean(item));
};

export const normalizeFeatureTag = (value: unknown): import('./types').FeatureTag | null => {
  const record = toRecord(value);
  if (!record) return null;
  const label = getString(record.label);
  if (!label) return null;
  return {
    label,
    iconSvg: pickFirst(getString(record.iconSvg), getString(record.icon_svg)),
    color: getString(record.color)
  };
};

const ONLINE_SERVERS_API_URL = import.meta.env.VITE_ONLINE_SERVERS_API_URL?.trim() || '';
const API_BASE_URL = ONLINE_SERVERS_API_URL ? new URL(ONLINE_SERVERS_API_URL).origin : '';

const resolveUrl = (url?: string) => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/') && API_BASE_URL) return `${API_BASE_URL}${url}`;
  return url;
};

export const normalizeServer = (value: unknown, index: number): OnlineServer | null => {
  const record = toRecord(value);
  if (!record) {
    return null;
  }

  const name = pickFirst(
    getString(record.name),
    getString(record.title),
    getString(record.server_name),
    getString(record.serverName)
  );

  if (!name) {
    return null;
  }

  const onlinePlayers = pickFirst(
    getNumber(record.onlinePlayers),
    getNumber(record.online_players),
    getNumber(record.online),
    getNumber(record.currentPlayers),
    getNumber(record.current_players)
  ) || 0;

  return {
    id: pickFirst(getString(record.id), getString(record.slug)) || `server-${index + 1}`,
    icon: resolveUrl(pickFirst(
      getString(record.icon),
      getString(record.icon_url),
      getString(record.iconUrl),
      getString(record.logo),
      getString(record.logo_url),
      getString(record.logoUrl)
    )) || '',
    name,
    onlinePlayers,
    maxPlayers: pickFirst(
      getNumber(record.maxPlayers),
      getNumber(record.max_players),
      getNumber(record.max),
      getNumber(record.capacity)
    ),
    ping: pickFirst(getNumber(record.ping), getNumber(record.latency)),
    serverType: pickFirst(
      getString(record.serverType),
      getString(record.server_type),
      getString(record.type),
      getString(record.category)
    ) || '未分类',
    isModded: pickFirst(getBoolean(record.isModded), getBoolean(record.is_modded), getBoolean(record.modded)) || false,
    modpackUrl: pickFirst(getString(record.modpackUrl), getString(record.modpack_url), getString(record.modpack)),
    requiresWhitelist: pickFirst(
      getBoolean(record.requiresWhitelist),
      getBoolean(record.requires_whitelist),
      getBoolean(record.whitelist),
      getBoolean(record.whitelist_required)
    ) || false,
    isSponsored: pickFirst(
      getBoolean(record.isSponsored),
      getBoolean(record.is_sponsored),
      getBoolean(record.promoted),
      getBoolean(record.sponsored)
    ) || false,
    sponsoredUntil: pickFirst(
      getString(record.sponsoredUntil),
      getString(record.sponsored_until),
      getString(record.promotionEndAt),
      getString(record.promotion_end_at)
    ),
    hasPaidFeatures: pickFirst(
      getBoolean(record.hasPaidContent),
      getBoolean(record.hasPaidFeatures),
      getBoolean(record.has_paid_features),
      getBoolean(record.paid),
      getBoolean(record.vip),
      getBoolean(record.pay_to_win)
    ) || false,
    hasVoiceChat: pickFirst(
      getBoolean(record.hasVoiceChat),
      getBoolean(record.has_voice_chat),
      getBoolean(record.voice),
      getBoolean(record.voice_chat)
    ) || false,
    homepageUrl: pickFirst(
      getString(record.homepageUrl),
      getString(record.homepage_url),
      getString(record.website),
      getString(record.url)
    ),
    socials: normalizeSocials(
      pickFirst(record.socials, record.social, record.socialLinks, record.socialGroups, record.social_groups, record.communities)
    ),
    description: pickFirst(getString(record.description), getString(record.summary)),
    address: (() => {
      const rawAddress = pickFirst(getString(record.address), getString(record.ip), getString(record.host));
      const port = pickFirst(getNumber(record.port));
      if (rawAddress && port && port !== 25565 && !rawAddress.includes(':')) {
        return `${rawAddress}:${port}`;
      }
      return rawAddress;
    })(),
    hero: resolveUrl(pickFirst(getString(record.hero), getString(record.hero_url), getString(record.banner))),
    versions: Array.isArray(record.versions) ? record.versions.map(getString).filter((v): v is string => Boolean(v)) : undefined,
    ageRecommendation: pickFirst(getString(record.ageRecommendation), getString(record.age_recommendation)),
    features: Array.isArray(record.features) ? record.features.map(normalizeFeatureTag).filter((v): v is import('./types').FeatureTag => Boolean(v)) : undefined,
    mechanics: Array.isArray(record.mechanics) ? record.mechanics.map(normalizeFeatureTag).filter((v): v is import('./types').FeatureTag => Boolean(v)) : undefined,
    elements: Array.isArray(record.elements) ? record.elements.map(normalizeFeatureTag).filter((v): v is import('./types').FeatureTag => Boolean(v)) : undefined,
    community: Array.isArray(record.community) ? record.community.map(normalizeFeatureTag).filter((v): v is import('./types').FeatureTag => Boolean(v)) : undefined,
    tags: Array.isArray(record.tags) ? record.tags.map(getString).filter((v): v is string => Boolean(v)) : undefined,
    sortId: pickFirst(
      getNumber(record.sortId),
      getNumber(record.sort_id),
      getNumber(record.sort),
      getNumber(record.priority)
    ) ?? 0,
    createdAt: pickFirst(
      getString(record.createdAt),
      getString(record.created_at),
      getString(record.publishedAt),
      getString(record.published_at)
    ),
  };
};

export const normalizeAd = (value: unknown, index: number): AdSlot | null => {
  const record = toRecord(value);
  if (!record) {
    return null;
  }

  const title = pickFirst(getString(record.title), getString(record.name), getString(record.label));
  const description = pickFirst(
    getString(record.description),
    getString(record.summary),
    getString(record.subtitle)
  );

  if (!title && !description) {
    return null;
  }

  return {
    id: pickFirst(getString(record.id), getString(record.slug)) || `remote-ad-${index + 1}`,
    title: title || `广告位 ${index + 1}`,
    description: description || '推广内容加载成功，等待素材补充。',
    image: pickFirst(getString(record.image), getString(record.image_url), getString(record.banner)),
    url: pickFirst(getString(record.url), getString(record.link)),
    expiresAt: pickFirst(getString(record.expiresAt), getString(record.expires_at))
  };
};

export const extractServers = (payload: unknown): OnlineServer[] => {
  if (Array.isArray(payload)) {
    return payload.map(normalizeServer).filter((item): item is OnlineServer => Boolean(item));
  }

  const record = toRecord(payload);
  if (!record) {
    return [];
  }

  const candidates = [record.servers, record.items, record.data];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map(normalizeServer).filter((item): item is OnlineServer => Boolean(item));
    }

    const nested = toRecord(candidate);
    if (nested && Array.isArray(nested.servers)) {
      return nested.servers.map(normalizeServer).filter((item): item is OnlineServer => Boolean(item));
    }
  }

  return [];
};

export const extractAds = (payload: unknown): AdSlot[] => {
  const record = toRecord(payload);
  if (!record) {
    return DEFAULT_AD_SLOTS;
  }

  const candidates = [record.ads, record.promotions, record.sponsors];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const ads = candidate.map(normalizeAd).filter((item): item is AdSlot => Boolean(item));
      if (ads.length > 0) {
        return [...ads, ...DEFAULT_AD_SLOTS].slice(0, 3);
      }
    }
  }

  return DEFAULT_AD_SLOTS;
};

export const formatDate = (value?: string) => {
  if (!value) {
    return '未设置';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(parsed);
};

export const openLink = async (url?: string) => {
  if (!url) {
    return;
  }

  try {
    await openExternal(url);
  } catch (error) {
    console.warn('Tauri shell 打开失败，回退到浏览器默认方式', error);
    window.open(url, '_blank');
  }
};

export const getPingTone = (ping?: number) => {
  if (ping === undefined) return 'text-slate-300';
  if (ping <= 60) return 'text-emerald-300';
  if (ping <= 120) return 'text-amber-300';
  return 'text-rose-300';
};

export const copyText = async (value?: string) => {
  const text = value?.trim();
  if (!text) {
    return false;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  const success = document.execCommand('copy');
  document.body.removeChild(textarea);
  return success;
};

export const measureWebSocketLatency = async (url: string, timeoutMs: number = 3000): Promise<number | undefined> => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let isDone = false;

    try {
      const ws = new WebSocket(url);

      const timeout = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          ws.close();
          resolve(undefined);
        }
      }, timeoutMs);

      ws.onopen = () => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timeout);
          const latency = Date.now() - startTime;
          ws.close();
          resolve(latency);
        }
      };

      ws.onerror = () => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timeout);
          ws.close();
          resolve(undefined);
        }
      };
    } catch {
      resolve(undefined);
    }
  });
};
