import type { ModMeta } from '../../../logic/modService';

export type ModListNavigateDirection = 'up' | 'down';
export type RowAction = 'upgrade' | 'toggle' | 'delete';
export type SafeFocusFallback = 'current' | 'first' | 'last';
export type ModListViewMode = 'standard' | 'compact';
export type ModQuickFilter = 'all' | 'enabled' | 'disabled' | 'updates' | 'external';
export type ModGroupId = 'libraries' | 'performance' | 'content' | 'manual' | 'uncategorized';

export const ROW_ACTIONS: RowAction[] = ['upgrade', 'toggle', 'delete'];

export const LIST_ENTRY_FOCUS_KEY = 'mod-list-entry';
export const LIST_GUARD_TOP = 'mod-list-guard-top';
export const LIST_GUARD_BOTTOM = 'mod-list-guard-bottom';
export const LIST_GUARD_LEFT = 'mod-list-guard-left';
export const LIST_GUARD_RIGHT = 'mod-list-guard-right';

export const DEFAULT_INCREMENTAL_PAGE_SIZE = 20;
export const DEFAULT_MOD_LIST_EXIT_FOCUS_KEY = 'mod-btn-history';

export const MOD_LIST_HEADER_CLASSES = {
  button: 'h-9 min-h-9',
  iconButton: 'h-9 min-h-9 w-9 min-w-9',
  oreButton: '!h-9 !min-h-9 !min-w-0 !px-3 text-xs',
  segmentGroup: 'relative z-10 flex h-9 shrink-0 overflow-hidden border border-white/[0.08] bg-black/20',
  segmentButton: 'flex h-full items-center px-3 font-minecraft text-xs outline-none transition-colors'
} as const;

export const MOD_LIST_TABLE_GRID_CLASS =
  'grid-cols-[2.875rem_minmax(10rem,1.25fr)_minmax(10rem,1.35fr)_minmax(9rem,1fr)_minmax(9rem,auto)]';

export interface ModListGroup {
  id: ModGroupId;
  label: string;
  description: string;
  mods: ModMeta[];
}

export type ModListRenderEntry =
  | {
      type: 'group';
      group: ModListGroup;
      collapsed: boolean;
    }
  | {
      type: 'mod';
      mod: ModMeta;
      groupId: ModGroupId;
      rowIndex: number;
    };

export interface ModQuickFilterOption {
  id: ModQuickFilter;
  label: string;
  count: number;
}

export interface ModListStats {
  total: number;
  enabled: number;
  disabled: number;
  updates: number;
  external: number;
  visible: number;
}

export const toFocusSlug = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');

export const getModRowFocusKey = (fileName: string) => `mod-row-${toFocusSlug(fileName)}`;

export const getModGroupHeaderFocusKey = (groupId: ModGroupId) => `mod-group-header-${toFocusSlug(groupId)}`;

export const getModRowActionFocusKey = (fileName: string, action: RowAction) => {
  return `mod-row-action-${action}-${toFocusSlug(fileName)}`;
};

export const getModDisplayName = (mod: ModMeta) => {
  return mod.name || mod.networkInfo?.title || mod.fileName;
};

export const getModDisplayDescription = (mod: ModMeta) => {
  return mod.description || mod.networkInfo?.description || '暂无描述';
};

export const getModFormattedSize = (mod: ModMeta) => {
  return mod.fileSize ? `${(mod.fileSize / 1024 / 1024).toFixed(1)} MB` : '未知大小';
};

const normalizeText = (value?: string | null) => String(value || '').toLowerCase();

const getModSearchText = (mod: ModMeta) => {
  return [
    mod.fileName,
    mod.name,
    mod.modId,
    mod.version,
    mod.description,
    mod.networkInfo?.title,
    mod.networkInfo?.description,
    ...(mod.networkInfo?.categories || []),
    ...(mod.networkInfo?.display_categories || [])
  ].map(normalizeText).join(' ');
};

const CATEGORY_ORDER: ModGroupId[] = ['libraries', 'performance', 'content', 'manual', 'uncategorized'];

const GROUP_META: Record<ModGroupId, Pick<ModListGroup, 'id' | 'label' | 'description'>> = {
  libraries: {
    id: 'libraries',
    label: '基础库',
    description: 'API、前置库与联动依赖'
  },
  performance: {
    id: 'performance',
    label: '性能优化',
    description: '渲染、内存、服务端性能与修复类 Mod'
  },
  content: {
    id: 'content',
    label: '游戏内容',
    description: '玩法、物品、生物、维度与体验扩展'
  },
  manual: {
    id: 'manual',
    label: '外部/手动添加',
    description: '未由启动器记录来源的本地文件'
  },
  uncategorized: {
    id: 'uncategorized',
    label: '未分类',
    description: '缺少可识别元数据的 Mod'
  }
};

const LIBRARY_PATTERNS = [
  'api',
  'architectury',
  'cloth-config',
  'collective',
  'core',
  'fabric-api',
  'forge-config',
  'geckolib',
  'kotlin',
  'library',
  'lib',
  'owo',
  'patchouli',
  'resourceful',
  'terrablender'
];

const PERFORMANCE_PATTERNS = [
  'c2me',
  'dynamic fps',
  'embeddium',
  'entity culling',
  'ferritecore',
  'fps',
  'iris',
  'lithium',
  'memory',
  'modernfix',
  'optimization',
  'performance',
  'sodium',
  'starlight'
];

const CONTENT_PATTERNS = [
  'adventure',
  'biome',
  'building',
  'content',
  'decoration',
  'dimension',
  'equipment',
  'food',
  'magic',
  'mobs',
  'technology',
  'utility',
  'worldgen'
];

const includesAnyPattern = (text: string, patterns: string[]) => {
  return patterns.some((pattern) => text.includes(pattern));
};

export const isExternalMod = (mod: ModMeta) => {
  const sourceKind = mod.manifestEntry?.source.kind;
  return !sourceKind || sourceKind === 'externalImport' || sourceKind === 'unknown';
};

export const getModSourceLabel = (mod: ModMeta) => {
  const source = mod.manifestEntry?.source;
  const platform = source?.platform;

  if (platform === 'modrinth') return 'Modrinth';
  if (platform === 'curseforge') return 'CurseForge';

  if (source?.kind === 'launcherDownload') return '启动器';
  if (source?.kind === 'modpackDeployment') return '整合包';
  if (source?.kind === 'externalImport') return '手动';

  return '外部';
};

export const getModGroupId = (mod: ModMeta): ModGroupId => {
  const text = getModSearchText(mod);

  if (includesAnyPattern(text, LIBRARY_PATTERNS)) return 'libraries';
  if (includesAnyPattern(text, PERFORMANCE_PATTERNS)) return 'performance';
  if (includesAnyPattern(text, CONTENT_PATTERNS)) return 'content';
  if (isExternalMod(mod)) return 'manual';

  return 'uncategorized';
};

export const buildModGroups = (mods: ModMeta[]) => {
  const buckets = new Map<ModGroupId, ModMeta[]>();

  mods.forEach((mod) => {
    const groupId = getModGroupId(mod);
    const bucket = buckets.get(groupId) || [];
    bucket.push(mod);
    buckets.set(groupId, bucket);
  });

  return CATEGORY_ORDER
    .map((id) => ({
      ...GROUP_META[id],
      mods: buckets.get(id) || []
    }))
    .filter((group) => group.mods.length > 0);
};

export const matchesModQuickFilter = (mod: ModMeta, filter: ModQuickFilter) => {
  if (filter === 'enabled') return !!mod.isEnabled;
  if (filter === 'disabled') return !mod.isEnabled;
  if (filter === 'updates') return !!mod.hasUpdate;
  if (filter === 'external') return isExternalMod(mod);
  return true;
};

export const getModListStats = (
  mods: ModMeta[],
  visibleMods: ModMeta[]
): ModListStats => {
  return {
    total: mods.length,
    enabled: mods.filter((mod) => mod.isEnabled).length,
    disabled: mods.filter((mod) => !mod.isEnabled).length,
    updates: mods.filter((mod) => mod.hasUpdate).length,
    external: mods.filter(isExternalMod).length,
    visible: visibleMods.length
  };
};
