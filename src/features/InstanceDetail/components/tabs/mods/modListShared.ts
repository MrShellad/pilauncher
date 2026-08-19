import type { ModMeta } from '../../../logic/modService';

export type ModListNavigateDirection = 'up' | 'down';
export type RowAction = 'upgrade' | 'toggle' | 'delete';
export type SafeFocusFallback = 'current' | 'first' | 'last';
export type ModListViewMode = 'standard' | 'compact';
export type ModListTheme = 'dark' | 'light';
export type ModQuickFilter = 'all' | 'enabled' | 'disabled' | 'updates';
export type ModGroupId = 'libraries' | 'performance' | 'content' | 'uncategorized';

export const ROW_ACTIONS: RowAction[] = ['upgrade', 'toggle', 'delete'];

export const LIST_ENTRY_FOCUS_KEY = 'mod-list-entry';
export const LIST_GUARD_TOP = 'mod-list-guard-top';
export const LIST_GUARD_BOTTOM = 'mod-list-guard-bottom';
export const LIST_GUARD_LEFT = 'mod-list-guard-left';
export const LIST_GUARD_RIGHT = 'mod-list-guard-right';

export const DEFAULT_INCREMENTAL_PAGE_SIZE = 20;
export const DEFAULT_MOD_LIST_EXIT_FOCUS_KEY = 'mod-btn-history';

export const MOD_LIST_HEADER_CLASSES = {
  button: 'h-8 min-h-8',
  iconButton: 'h-8 min-h-8 w-8 min-w-8',
  oreButton: '!h-8 !min-h-8 !min-w-0 !px-3 font-minecraft text-[12px] font-bold uppercase',
  segmentGroup: 'relative z-10 flex h-8 shrink-0 overflow-hidden border-[2px] border-[#1E1E1F] bg-[#232937] shadow-[inset_0_-2px_0_rgba(0,0,0,0.4)]',
  segmentButton: 'flex h-full items-center px-3 font-minecraft text-[12px] font-bold uppercase outline-none transition-colors'
} as const;

export const MOD_LIST_TABLE_GRID_CLASS =
  'grid-cols-[2.5rem_3.5rem_minmax(11rem,0.9fr)_minmax(9.5rem,0.8fr)_4.5rem_6.5rem]';
export const MOD_LIST_COMPACT_GRID_CLASS =
  'grid-cols-[2.5rem_2.75rem_minmax(0,1fr)_6.5rem]';

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
  visible: number;
}

export const toFocusSlug = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');

export const getModRowFocusKey = (fileName: string) => `mod-row-${toFocusSlug(fileName)}`;

export const getModGroupHeaderFocusKey = (groupId: ModGroupId) => `mod-group-header-${toFocusSlug(groupId)}`;

export const getModRowActionFocusKey = (fileName: string, action: RowAction) => {
  return `mod-row-action-${action}-${toFocusSlug(fileName)}`;
};

export const getModDisplayName = (mod: ModMeta) => {
  return mod.networkInfo?.title || mod.name || mod.fileName;
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

const CATEGORY_ORDER: ModGroupId[] = ['content', 'performance', 'libraries', 'uncategorized'];

const GROUP_META: Record<ModGroupId, Pick<ModListGroup, 'id' | 'label' | 'description'>> = {
  content: {
    id: 'content',
    label: '游戏内容',
    description: '玩法、物品、生物、维度与各类扩展 Mod'
  },
  performance: {
    id: 'performance',
    label: '性能优化',
    description: '渲染、内存、服务端性能与修复类 Mod'
  },
  libraries: {
    id: 'libraries',
    label: '基础依赖库',
    description: 'API、前置库与联动依赖'
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
  'cloth_config',
  'collective',
  'core',
  'fabric-api',
  'fabric_api',
  'forge-config',
  'geckolib',
  'kotlin',
  'library',
  'lib',
  'owo',
  'patchouli',
  'resourceful',
  'terrablender',
  'balm',
  'curios',
  'puzzles-lib',
  'puzzleslib',
  'yungs-api'
];

const PERFORMANCE_PATTERNS = [
  'c2me',
  'dynamic fps',
  'dynamicfps',
  'embeddium',
  'entity culling',
  'entityculling',
  'entity-culling',
  'ferritecore',
  'fps',
  'iris',
  'lithium',
  'memory',
  'modernfix',
  'optimization',
  'performance',
  'sodium',
  'starlight',
  'krypton',
  'immediatelyfast',
  'exordium',
  'noisium',
  'smoothboot',
  'fastsuite',
  'clumps',
  'chunky'
];

const includesAnyPattern = (text: string, patterns: string[]) => {
  return patterns.some((pattern) => text.includes(pattern));
};

export const getModMatchedPlatforms = (mod: ModMeta): string[] => {
  const source = mod.manifestEntry?.source;
  const platform = source?.platform;
  const matchedPlatforms = mod.manifestEntry?.matchedPlatforms || {};
  return [
    platform === 'modrinth' || matchedPlatforms.modrinth?.projectId ? 'Modrinth' : '',
    platform === 'curseforge' || matchedPlatforms.curseforge?.projectId ? 'CurseForge' : ''
  ].filter(Boolean);
};

export const getModGroupId = (mod: ModMeta): ModGroupId => {
  if (mod.dependentsCount && mod.dependentsCount > 0) {
    return 'libraries';
  }

  const text = getModSearchText(mod);

  if (includesAnyPattern(text, LIBRARY_PATTERNS)) return 'libraries';
  if (includesAnyPattern(text, PERFORMANCE_PATTERNS)) return 'performance';

  // 其它所有 mod 均归入游戏内容分组
  return 'content';
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
    visible: visibleMods.length
  };
};
