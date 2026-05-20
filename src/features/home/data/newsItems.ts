export type NewsLocale = 'zh' | 'en';

export interface MinecraftUpdateApiItem {
  version: string;
  vType: string;
  title: string;
  cover: string;
  article: string;
  wikiEn: string;
  wikiZh: string;
  date: string;
  createdAt: string;
}

export interface NewsItemDefinition {
  id: string;
  date: string;
  version: string;
  tag: string;
  title: string;
  summary: string;
  coverImageUrl: string;
  officialUrl: string;
  wikiUrl: string;
}

export const MC_UPDATES_BASE_URL = 'https://pil.nav4ai.net';
export const MC_UPDATES_API_URL = `${MC_UPDATES_BASE_URL}/api/mc/updates`;
export const MC_UPDATES_CACHE_KEY = 'pil_mc_updates_cache';
export const MC_UPDATES_LAST_READ_KEY = 'pil_mc_updates_last_read';
export const MC_UPDATES_LAST_PROMPTED_KEY = 'pil_mc_updates_last_prompted';

export const NEWS_PAGE_COPY: Record<
  NewsLocale,
  {
    kicker: string;
    title: string;
    subtitle: string;
    back: string;
    official: string;
    wiki: string;
    refresh: string;
    loading: string;
    loadingMore: string;
    refreshing: string;
    empty: string;
    error: string;
  }
> = {
  zh: {
    kicker: 'Minecraft 版本新闻',
    title: '版本更新一览',
    subtitle: '数据来自 PiLauncher 新闻接口，展示最近的 MC 版本更新、快照与候选版本。',
    back: '返回首页',
    official: '打开官网',
    wiki: '打开 Wiki',
    refresh: '重新加载',
    loading: '正在加载版本新闻...',
    loadingMore: '向下滚动以加载更多卡片',
    refreshing: '正在刷新新闻列表...',
    empty: '接口暂未返回任何新闻。',
    error: '新闻接口加载失败',
  },
  en: {
    kicker: 'Minecraft Release News',
    title: 'Version Update Feed',
    subtitle: 'Powered by the PiLauncher news API for recent Minecraft releases, snapshots, and candidates.',
    back: 'Back Home',
    official: 'Open Site',
    wiki: 'Open Wiki',
    refresh: 'Reload',
    loading: 'Loading update feed...',
    loadingMore: 'Scroll down to load more cards',
    refreshing: 'Refreshing the news feed...',
    empty: 'The API did not return any news items.',
    error: 'Failed to load the news feed',
  },
};

const normalizeDate = (date: string, createdAt: string) => {
  const trimmedDate = String(date || '').trim();
  if (trimmedDate) return trimmedDate;

  const created = String(createdAt || '').trim();
  if (!created) return '';

  return created.split(' ')[0] || created;
};

export const getNewsItemTimestamp = (item: MinecraftUpdateApiItem) => {
  const source = item.createdAt || item.date;
  if (!source) return 0;

  const normalized = source.includes(' ') ? source.replace(' ', 'T') : source;
  const value = new Date(normalized).getTime();
  return Number.isNaN(value) ? 0 : value;
};

const resolveWikiUrl = (item: MinecraftUpdateApiItem, locale: NewsLocale) =>
  locale === 'zh'
    ? item.wikiZh || item.wikiEn || item.article
    : item.wikiEn || item.wikiZh || item.article;

const resolveCoverUrl = (cover: string) => {
  const trimmed = String(cover || '').trim();
  if (!trimmed) return '';

  try {
    return new URL(trimmed, `${MC_UPDATES_BASE_URL}/`).toString();
  } catch {
    return '';
  }
};

const detectNewsType = (item: MinecraftUpdateApiItem) => {
  const text = `${item.vType} ${item.version} ${item.title}`.toLowerCase();

  if (text.includes('release candidate') || text.includes('-rc-') || text.includes(' rc ')) {
    return 'release-candidate';
  }
  if (text.includes('pre-release') || text.includes('prerelease')) {
    return 'pre-release';
  }
  if (text.includes('snapshot')) {
    return 'snapshot';
  }
  if (text.includes('experimental')) {
    return 'experimental';
  }
  return 'release';
};

const getTypeLabel = (type: string, locale: NewsLocale) => {
  const zhLabels: Record<string, string> = {
    release: '正式版',
    snapshot: '快照',
    'pre-release': '预发布',
    'release-candidate': '候选版',
    experimental: '实验性',
  };

  const enLabels: Record<string, string> = {
    release: 'Release',
    snapshot: 'Snapshot',
    'pre-release': 'Pre-release',
    'release-candidate': 'Release Candidate',
    experimental: 'Experimental',
  };

  const labels = locale === 'zh' ? zhLabels : enLabels;
  return labels[type] || (locale === 'zh' ? '更新' : 'Update');
};

const buildSummary = (locale: NewsLocale, tag: string) => {
  if (locale === 'zh') {
    return `查看官网原文与 Wiki 条目，快速了解这次${tag}包含的改动内容。`;
  }

  return `Open the official article and wiki page to review the changes included in this ${tag.toLowerCase()}.`;
};

export const getNewsLocale = (language: string): NewsLocale =>
  language.toLowerCase().startsWith('zh') ? 'zh' : 'en';

export const normalizeMinecraftNewsItems = (
  items: MinecraftUpdateApiItem[],
  locale: NewsLocale
): NewsItemDefinition[] =>
  [...items]
    .sort((a, b) => getNewsItemTimestamp(b) - getNewsItemTimestamp(a))
    .map((item) => {
      const date = normalizeDate(item.date, item.createdAt);
      const tag = getTypeLabel(detectNewsType(item), locale);

      return {
        id: item.version || item.createdAt || item.title,
        date,
        version: item.version || 'Unknown',
        tag,
        title: item.title || item.version || 'Minecraft Update',
        summary: buildSummary(locale, tag),
        coverImageUrl: resolveCoverUrl(item.cover),
        officialUrl: item.article,
        wikiUrl: resolveWikiUrl(item, locale),
      };
    });

export const getNewsLatestTimestamp = (items: MinecraftUpdateApiItem[]) =>
  items.reduce((max, item) => Math.max(max, getNewsItemTimestamp(item)), 0);

export const getUnreadNewsCount = (items: MinecraftUpdateApiItem[], lastReadTimestamp: number) =>
  items.filter((item) => getNewsItemTimestamp(item) > lastReadTimestamp).length;

export const getLatestUnreadNewsItem = (items: MinecraftUpdateApiItem[], lastReadTimestamp: number) =>
  [...items]
    .sort((a, b) => getNewsItemTimestamp(b) - getNewsItemTimestamp(a))
    .find((item) => getNewsItemTimestamp(item) > lastReadTimestamp) || null;

export const getNewsFocusKeySegment = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'news-item';
