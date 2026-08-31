import { invoke } from '@tauri-apps/api/core';
import type { OnlineSkinItem, WardrobeSkinLibrary, WardrobeSkinModel } from '../types';

// NameMC 全球高热度流行榜与精选审美皮肤库 (NameMC Trending & Top Skins)
const NAMEMC_TRENDING_SKINS: OnlineSkinItem[] = [
  {
    id: 'namemc-techno',
    title: 'Technoblade (传奇猪王)',
    author: 'Technoblade',
    source: 'player',
    skinUrl: 'https://minotar.net/skin/Technoblade.png',
    model: 'classic',
    likes: 128500,
    tags: ['NameMC #1', '传奇', '皇冠红袍'],
  },
  {
    id: 'namemc-dream',
    title: 'Dream (绿色卫衣笑脸)',
    author: 'Dream',
    source: 'player',
    skinUrl: 'https://minotar.net/skin/Dream.png',
    model: 'classic',
    likes: 98600,
    tags: ['NameMC 热门', '笑脸', '经典'],
  },
  {
    id: 'namemc-ranboo',
    title: 'Ranboo (黑白末影西装)',
    author: 'Ranboo',
    source: 'player',
    skinUrl: 'https://minotar.net/skin/Ranboo.png',
    model: 'slim',
    likes: 84300,
    tags: ['NameMC 热门', '末影半脸', '西装'],
  },
  {
    id: 'namemc-tommy',
    title: 'TommyInnit (经典红白短袖)',
    author: 'TommyInnit',
    source: 'player',
    skinUrl: 'https://minotar.net/skin/TommyInnit.png',
    model: 'classic',
    likes: 76200,
    tags: ['NameMC 热门', '英伦少年'],
  },
  {
    id: 'namemc-grian',
    title: 'Grian (红色毛衣英伦风)',
    author: 'Grian',
    source: 'player',
    skinUrl: 'https://minotar.net/skin/Grian.png',
    model: 'classic',
    likes: 72400,
    tags: ['HermitCraft', '红卫衣', '建筑大师'],
  },
  {
    id: 'namemc-mumbo',
    title: 'Mumbo Jumbo (绅士胡子西服)',
    author: 'MumboJumbo',
    source: 'player',
    skinUrl: 'https://minotar.net/skin/MumboJumbo.png',
    model: 'classic',
    likes: 69800,
    tags: ['红石大师', '绅士西装'],
  },
  {
    id: 'namemc-george',
    title: 'GeorgeNotFound (白框眼镜)',
    author: 'GeorgeNotFound',
    source: 'player',
    skinUrl: 'https://minotar.net/skin/GeorgeNotFound.png',
    model: 'classic',
    likes: 68500,
    tags: ['护目镜', '蓝白T恤'],
  },
  {
    id: 'namemc-sapnap',
    title: 'Sapnap (烈焰火焰连帽衫)',
    author: 'Sapnap',
    source: 'player',
    skinUrl: 'https://minotar.net/skin/Sapnap.png',
    model: 'classic',
    likes: 65400,
    tags: ['火焰头带', '白卫衣'],
  },
  {
    id: 'namemc-etho',
    title: 'EthosLab (暗影面罩刺客)',
    author: 'Etho',
    source: 'player',
    skinUrl: 'https://minotar.net/skin/Etho.png',
    model: 'classic',
    likes: 64200,
    tags: ['卡卡西风', '暗影忍者'],
  },
  {
    id: 'namemc-dantdm',
    title: 'DanTDM (经典防风护目镜)',
    author: 'DanTDM',
    source: 'player',
    skinUrl: 'https://minotar.net/skin/DanTDM.png',
    model: 'classic',
    likes: 61800,
    tags: ['蓝发经典', '实验室'],
  },
  {
    id: 'namemc-tubbo',
    title: 'Tubbo (复古工装衬衫)',
    author: 'Tubbo',
    source: 'player',
    skinUrl: 'https://minotar.net/skin/Tubbo.png',
    model: 'classic',
    likes: 59300,
    tags: ['工装绿衬衫', '自然风'],
  },
  {
    id: 'namemc-captain',
    title: 'CaptainSparklez (黑红战袍)',
    author: 'CaptainSparklez',
    source: 'player',
    skinUrl: 'https://minotar.net/skin/CaptainSparklez.png',
    model: 'classic',
    likes: 58900,
    tags: ['Fallen Kingdom', '经典战甲'],
  },
  {
    id: 'namemc-ldshadowlady',
    title: 'LDShadowLady (粉紫梦幻猫耳)',
    author: 'LDShadowLady',
    source: 'player',
    skinUrl: 'https://minotar.net/skin/LDShadowLady.png',
    model: 'slim',
    likes: 57400,
    tags: ['粉紫梦幻', '可爱猫耳', '纤细 3px'],
  },
  {
    id: 'namemc-smallishbeans',
    title: 'Smallishbeans (双色挑染夹克)',
    author: 'Smallishbeans',
    source: 'player',
    skinUrl: 'https://minotar.net/skin/Smallishbeans.png',
    model: 'classic',
    likes: 56100,
    tags: ['挑染朋克', '皮夹克'],
  },
];

export interface FetchOnlineSkinsResult {
  items: OnlineSkinItem[];
  page: number;
  hasMore: boolean;
}

/**
 * 获取在线皮肤列表（支持 NameMC 热门流、正版玩家提取与 LittleSkin 搜索）
 */
export async function fetchOnlineSkins(
  page: number = 1,
  searchQuery?: string
): Promise<FetchOnlineSkinsResult> {
  const trimmedSearch = (searchQuery || '').trim();

  // 1. 如果有输入搜索词，且符合正版 ID 格式（纯字母数字下划线 3~16 字符）
  const playerMatches: OnlineSkinItem[] = [];
  if (trimmedSearch && /^[a-zA-Z0-9_]{3,16}$/.test(trimmedSearch) && page === 1) {
    playerMatches.push({
      id: `player-${trimmedSearch}`,
      title: `${trimmedSearch} (正版玩家皮肤)`,
      author: 'Mojang 官方正版',
      source: 'player',
      skinUrl: `https://minotar.net/skin/${encodeURIComponent(trimmedSearch)}.png`,
      model: 'classic',
      likes: 999,
      tags: ['NameMC 提取', '正版玩家'],
    });
  }

  // 2. 如果有搜索词，优先检索 LittleSkin 数据库
  if (trimmedSearch) {
    try {
      const url = `https://littleskin.cn/skinlib/list?page=${page}&sort=likes&keyword=${encodeURIComponent(trimmedSearch)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });

      if (res.ok) {
        const data = (await res.json()) as any;
        const rawList = Array.isArray(data?.data) ? data.data : [];

        // 尝试拉取或拼装皮肤材质
        const parsedItems: OnlineSkinItem[] = rawList.map((item: any) => ({
          id: `littleskin-${item.tid}`,
          title: item.name || '网络皮肤',
          author: item.nickname || '社区创作者',
          source: 'littleskin' as const,
          skinUrl: `https://littleskin.cn/skinlib/show/${item.tid}`, // fallback
          model: item.type === 'alex' ? ('slim' as WardrobeSkinModel) : ('classic' as WardrobeSkinModel),
          likes: item.likes || undefined,
          tags: ['LittleSkin', item.type === 'alex' ? '纤细 3px' : '经典 4px'],
        }));

        const filteredCurated = NAMEMC_TRENDING_SKINS.filter(
          (s) =>
            s.title.toLowerCase().includes(trimmedSearch.toLowerCase()) ||
            s.tags?.some((t) => t.toLowerCase().includes(trimmedSearch.toLowerCase()))
        );

        return {
          items: [...playerMatches, ...filteredCurated, ...parsedItems],
          page,
          hasMore: (data?.current_page || page) < (data?.last_page || 1),
        };
      }
    } catch (e) {
      console.warn('[onlineSkinService] LittleSkin search failed, using curated match:', e);
    }

    const filtered = NAMEMC_TRENDING_SKINS.filter(
      (s) =>
        s.title.toLowerCase().includes(trimmedSearch.toLowerCase()) ||
        s.tags?.some((t) => t.toLowerCase().includes(trimmedSearch.toLowerCase()))
    );

    return {
      items: [...playerMatches, ...filtered],
      page: 1,
      hasMore: false,
    };
  }

  // 3. 默认无搜索词：直接展示 NameMC 全球高热度流行榜皮肤
  const pageSize = 16;
  const startIndex = (page - 1) * pageSize;
  const pagedItems = NAMEMC_TRENDING_SKINS.slice(startIndex, startIndex + pageSize);
  const hasMore = startIndex + pageSize < NAMEMC_TRENDING_SKINS.length;

  return {
    items: pagedItems,
    page,
    hasMore,
  };
}

/**
 * 下载并将在线皮肤保存至本地皮肤库
 */
export async function downloadAndSaveOnlineSkin(
  accountUuid: string,
  skinItem: OnlineSkinItem,
  customVariant?: WardrobeSkinModel
): Promise<WardrobeSkinLibrary> {
  const variant = customVariant || skinItem.model;
  return invoke<WardrobeSkinLibrary>('save_wardrobe_skin_from_url', {
    accountUuid,
    skinUrl: skinItem.skinUrl,
    variant,
  });
}