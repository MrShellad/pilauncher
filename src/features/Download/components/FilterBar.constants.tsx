
import type { ToggleOption } from '../../../ui/primitives/OreToggleButton';
import type { TFunction } from 'i18next';
import { CurseforgeIcon, ModrinthIcon } from './Icons';

export type FilterKey =
  | 'filter-source-toggle'
  | 'download-search-input'
  | 'download-btn-search'
  | 'download-btn-reset'
  | 'filter-mc-version'
  | 'filter-loader'
  | 'filter-category'
  | 'filter-sort';

export const FOCUS_KEYS = {
  SOURCE_TOGGLE: 'filter-source-toggle' as FilterKey,
  SEARCH_INPUT: 'download-search-input' as FilterKey,
  BTN_SEARCH: 'download-btn-search' as FilterKey,
  BTN_RESET: 'download-btn-reset' as FilterKey,
  MC_VERSION: 'filter-mc-version' as FilterKey,
  LOADER: 'filter-loader' as FilterKey,
  CATEGORY: 'filter-category' as FilterKey,
  SORT: 'filter-sort' as FilterKey,
};

export const firstRow: FilterKey[] = [
  FOCUS_KEYS.SOURCE_TOGGLE,
  FOCUS_KEYS.SEARCH_INPUT,
  FOCUS_KEYS.BTN_SEARCH,
  FOCUS_KEYS.BTN_RESET
];

export const secondRow: FilterKey[] = [
  FOCUS_KEYS.MC_VERSION,
  FOCUS_KEYS.LOADER,
  FOCUS_KEYS.CATEGORY,
  FOCUS_KEYS.SORT
];

export const rowMap: Record<string, FilterKey[]> = {
  [FOCUS_KEYS.SOURCE_TOGGLE]: firstRow,
  [FOCUS_KEYS.SEARCH_INPUT]: firstRow,
  [FOCUS_KEYS.BTN_SEARCH]: firstRow,
  [FOCUS_KEYS.BTN_RESET]: firstRow,
  [FOCUS_KEYS.MC_VERSION]: secondRow,
  [FOCUS_KEYS.LOADER]: secondRow,
  [FOCUS_KEYS.CATEGORY]: secondRow,
  [FOCUS_KEYS.SORT]: secondRow
};

export const blockClassName =
  'relative min-w-0 border-[2px] border-[#1E1E1F] bg-[#48494A] px-2.5 py-1.5 shadow-[inset_0_-3px_0_#313233,inset_2px_2px_0_rgba(255,255,255,0.12)]';

export const getSourceOptions = (t: TFunction, source: string): ToggleOption[] => [
  {
    label: (
      <div className="flex w-full items-center justify-center gap-1 font-minecraft tracking-wider">
        <ModrinthIcon className={`text-[16px] ${source === 'modrinth' ? 'text-white' : 'text-ore-green'}`} />
        {t('download.source.modrinth', { defaultValue: 'Modrinth' })}
      </div>
    ),
    value: 'modrinth'
  },
  {
    label: (
      <div className="flex w-full items-center justify-center gap-1 font-minecraft tracking-wider">
        <CurseforgeIcon className={`text-[16px] ${source === 'curseforge' ? 'text-white' : 'text-[#F16436]'}`} />
        {t('download.source.curseforge', { defaultValue: 'CurseForge' })}
      </div>
    ),
    value: 'curseforge'
  }
];

export const getLoaderOptions = (t: TFunction) => [
  { label: t('download.filters.loaderAll', { defaultValue: 'All' }), value: '' },
  { label: t('download.tags.loader.fabric', { defaultValue: 'Fabric' }), value: 'fabric' },
  { label: t('download.tags.loader.forge', { defaultValue: 'Forge' }), value: 'forge' },
  { label: t('download.tags.loader.neoforge', { defaultValue: 'NeoForge' }), value: 'neoforge' },
  { label: t('download.tags.loader.quilt', { defaultValue: 'Quilt' }), value: 'quilt' }
];

export const getSortOptions = (t: TFunction) => [
  { label: t('download.sort.relevance', { defaultValue: 'Relevance' }), value: 'relevance' },
  { label: t('download.sort.downloads', { defaultValue: 'Downloads' }), value: 'downloads' },
  { label: t('download.sort.updated', { defaultValue: 'Recently Updated' }), value: 'updated' }
];
