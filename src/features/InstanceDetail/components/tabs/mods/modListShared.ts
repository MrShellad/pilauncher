import type { ModMeta } from '../../../logic/modService';

export type ModListNavigateDirection = 'up' | 'down';
export type RowAction = 'toggle' | 'select' | 'delete';
export type SafeFocusFallback = 'current' | 'first' | 'last';

export const ROW_ACTIONS: RowAction[] = ['toggle', 'select', 'delete'];

export const LIST_ENTRY_FOCUS_KEY = 'mod-list-entry';
export const LIST_GUARD_TOP = 'mod-list-guard-top';
export const LIST_GUARD_BOTTOM = 'mod-list-guard-bottom';
export const LIST_GUARD_LEFT = 'mod-list-guard-left';
export const LIST_GUARD_RIGHT = 'mod-list-guard-right';

export const DEFAULT_INCREMENTAL_PAGE_SIZE = 20;
export const DEFAULT_MOD_LIST_EXIT_FOCUS_KEY = 'mod-btn-history';

export const toFocusSlug = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');

export const getModRowFocusKey = (fileName: string) => `mod-row-${toFocusSlug(fileName)}`;

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
