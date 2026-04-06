import type { ModrinthProject } from '../../InstanceDetail/logic/modrinthApi';
import { isProjectInstalled, type ModMeta } from '../../InstanceDetail/logic/modService';

const KNOWN_LOADERS = ['fabric', 'forge', 'neoforge', 'quilt', 'liteloader'] as const;

export const LOADER_PRIORITY: Record<string, number> = {
  neoforge: 0,
  fabric: 1,
  forge: 2,
  quilt: 3,
  liteloader: 4
};

export const LOADER_ICON_BASE_KEYS = KNOWN_LOADERS;

/** 格式化数字为带 K/M 后缀的短字符串 */
export const formatNumber = (value?: number) => {
  if (!value) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
};

export interface CategoryItem {
  raw: string;
  display: string;
}

export interface ProjectViewModel {
  loaders: CategoryItem[];
  features: CategoryItem[];
  followerCount: number;
  supportsClient: boolean;
  supportsServer: boolean;
}

/**
 * 纯函数：把 ModrinthProject 原始数据转换为渲染所需的视图模型。
 * 内部不依赖任何 React hook，便于单独测试。
 */
export function buildProjectViewModel(
  project: ModrinthProject
): ProjectViewModel {
  const raw = project as ModrinthProject & { display_categories?: string[]; followers?: number };

  const categoryItems: CategoryItem[] = (raw.categories || []).map((r, idx) => ({
    raw: r,
    display: raw.display_categories?.[idx] || r
  }));

  const loaderItems: CategoryItem[] = [
    ...categoryItems.filter((item) => KNOWN_LOADERS.includes(item.raw.toLowerCase() as typeof KNOWN_LOADERS[number])),
    ...((raw.loaders || [])
      .filter((r) => KNOWN_LOADERS.includes(r.toLowerCase() as typeof KNOWN_LOADERS[number]))
      .map((r) => ({ raw: r, display: r })))
  ];

  const loaders = Array.from(
    new Map(loaderItems.map((item) => [item.raw.toLowerCase(), item])).values()
  )
    .sort((a, b) => {
      const aPriority = LOADER_PRIORITY[a.raw.toLowerCase()] ?? Number.MAX_SAFE_INTEGER;
      const bPriority = LOADER_PRIORITY[b.raw.toLowerCase()] ?? Number.MAX_SAFE_INTEGER;
      return aPriority - bPriority;
    })
    .slice(0, 3);

  const features = categoryItems
    .filter((item) => !KNOWN_LOADERS.includes(item.raw.toLowerCase() as typeof KNOWN_LOADERS[number]))
    .slice(0, 3);

  const followerCount = raw.followers || raw.follows || 0;
  const supportsClient = project.client_side !== 'unsupported' && !!project.client_side;
  const supportsServer = project.server_side !== 'unsupported' && !!project.server_side;

  return { loaders, features, followerCount, supportsClient, supportsServer };
}

/**
 * 判断一个 mod 是否已安装
 */
export function checkIsInstalled(project: ModrinthProject, installedMods: ModMeta[]): boolean {
  return isProjectInstalled(project, installedMods);
}
