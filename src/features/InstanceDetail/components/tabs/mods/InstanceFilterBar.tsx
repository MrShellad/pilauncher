// src/features/InstanceDetail/components/tabs/mods/InstanceFilterBar.tsx
import React from 'react';
import { Search, RotateCcw, Package, Image as LucideImage, Blocks } from 'lucide-react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';

import { OreToggleButton } from '../../../../../ui/primitives/OreToggleButton';
import { OreInput } from '../../../../../ui/primitives/OreInput';
import { OreDropdown } from '../../../../../ui/primitives/OreDropdown';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { getSortOptions, getSourceOptions } from '../../../../Download/components/FilterBar.constants';
import type { FilterOption } from '../../../../Download/hooks/useResourceDownload';
import { getLocalizedDownloadOptionLabel } from '../../../../Download/logic/downloadTagLabels';

interface InstanceFilterBarProps {
  onBack: () => void;
  showBackButton?: boolean;
  resourceTab?: 'mod' | 'resourcepack' | 'shader';
  lockedMcVersion: string;
  lockedLoaderType: string;
  query: string;
  setQuery: (v: string) => void;
  source: string;
  setSource: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  categoryOptions: FilterOption[];
  sort: string;
  setSort: (v: string) => void;
  onSearch: () => void;
  onReset: () => void;
}

type FilterKey =
  | 'inst-filter-source'
  | 'inst-filter-category'
  | 'inst-filter-sort'
  | 'inst-filter-search'
  | 'inst-filter-btn-search'
  | 'inst-filter-btn-reset';

const secondRow: FilterKey[] = [
  'inst-filter-source',
  'inst-filter-category',
  'inst-filter-sort',
  'inst-filter-search',
  'inst-filter-btn-search',
  'inst-filter-btn-reset'
];

export const InstanceFilterBar: React.FC<InstanceFilterBarProps> = ({
  onBack,
  showBackButton = true,
  resourceTab = 'mod',
  lockedMcVersion,
  lockedLoaderType,
  query,
  setQuery,
  source,
  setSource,
  category,
  setCategory,
  categoryOptions,
  sort,
  setSort,
  onSearch,
  onReset
}) => {
  const { t, i18n } = useTranslation();

  const pageMeta = React.useMemo(() => {
    if (resourceTab === 'resourcepack') {
      return { title: '实例资源包下载', icon: Package };
    }
    if (resourceTab === 'shader') {
      return { title: '实例光影下载', icon: LucideImage };
    }
    return { title: '实例模组下载', icon: Blocks };
  }, [resourceTab]);

  const sourceOptions = React.useMemo(() => getSourceOptions(t, source), [t, source]);

  const sortOptions = React.useMemo(() => getSortOptions(t), [t]);
  const translatedCategoryOptions = React.useMemo(() => [
    { label: t('download.filters.categoryAll', { defaultValue: 'All Categories' }), value: '' },
    ...categoryOptions.map((option) => ({
      label: getLocalizedDownloadOptionLabel({
        t,
        language: i18n.language,
        option
      }),
      value: option.value
    }))
  ], [categoryOptions, i18n.language, t]);
  const loaderLabel = lockedLoaderType
    ? lockedLoaderType === 'neoforge'
      ? 'NeoForge'
      : lockedLoaderType.charAt(0).toUpperCase() + lockedLoaderType.slice(1)
    : 'Vanilla';

  const moveFocusToResults = () => {
    if (doesFocusableExist('download-grid-item-0')) {
      setFocus('download-grid-item-0');
      return false;
    }
    return true;
  };

  const handleArrow = (key: FilterKey) => (direction: string) => {
    const secondRowIndex = secondRow.indexOf(key);

    if (direction === 'left' || direction === 'right') {
      const nextIndex = direction === 'right'
        ? (secondRowIndex + 1) % secondRow.length
        : (secondRowIndex - 1 + secondRow.length) % secondRow.length;
      const nextKey = secondRow[nextIndex];
      if (doesFocusableExist(nextKey)) setFocus(nextKey);
      return false;
    }

    if (direction === 'down') {
      return moveFocusToResults();
    }

    if (direction === 'up') {
      return true;
    }

    return true;
  };

  return (
    <div className="mb-4 z-20 flex-shrink-0 border-2 border-[#2A2A2C] bg-[#18181B] p-4 shadow-md">
      <div className="flex flex-col gap-4">
        {/* ROW 1: BACK BTN, TITLE, ENVIRONMENT */}
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex flex-1 justify-start">
            {showBackButton && (
              <button
                onClick={onBack}
                className="flex h-[2.75rem] cursor-pointer items-center justify-center rounded-sm border border-white/5 bg-black/30 px-4 font-minecraft tracking-wider text-gray-400 transition-colors hover:bg-black/50 hover:text-white active:scale-95"
              >
                <div className="mr-2 flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-full border-b-[0.125rem] border-red-800 bg-red-600 pb-[0.0625rem] font-sans text-[0.625rem] font-bold text-white shadow-sm">
                  B
                </div>
                返回
              </button>
            )}
          </div>

          <div className="flex flex-1 justify-center">
            <div className="pointer-events-none flex items-center gap-2 font-minecraft text-sm uppercase tracking-[0.18em] text-[#E6E8EB]">
              <pageMeta.icon size="1rem" className="text-ore-green" />
              {pageMeta.title}
            </div>
          </div>

          <div className="flex flex-1 justify-end">
            <div className="flex flex-wrap items-center gap-2 rounded-sm border border-ore-green/30 bg-ore-green/10 px-3 py-2 text-xs font-minecraft tracking-wider text-ore-green">
              <span className="text-white/70">已锁定环境</span>
              <span className="rounded-sm border border-white/10 bg-black/30 px-2 py-1 text-white">
                MC {lockedMcVersion || 'Unknown'}
              </span>
              {resourceTab === 'mod' && (
                <span className="rounded-sm border border-white/10 bg-black/30 px-2 py-1 text-white">
                  {loaderLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2: FILTERS & SEARCH */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-[15rem] shrink-0 focus-within:z-50">
            <FocusItem
              focusKey="inst-filter-source"
              onArrowPress={handleArrow('inst-filter-source')}
              onEnter={() => setSource(source === 'modrinth' ? 'curseforge' : 'modrinth')}
            >
              {({ ref, focused }) => (
                <div
                  ref={ref as React.RefObject<HTMLDivElement>}
                  className={`h-[2.75rem] w-full rounded-sm transition-all ${focused ? 'z-50 scale-[1.02] brightness-110 shadow-lg ring-[0.125rem] ring-white' : ''}`}
                >
                  <OreToggleButton options={sourceOptions} value={source} onChange={setSource} className="!m-0 h-full" />
                </div>
              )}
            </FocusItem>
          </div>

          <div className="relative min-w-[7.5rem] max-w-[10rem] flex-1 focus-within:z-50">
            <OreDropdown
              focusKey="inst-filter-category"
              onArrowPress={handleArrow('inst-filter-category')}
              options={translatedCategoryOptions}
              value={category || ''}
              onChange={setCategory}
              className="!h-[2.75rem] w-full"
              placeholder={t('download.filters.categoryAll', { defaultValue: 'All Categories' })}
            />
          </div>

          <div className="relative min-w-[7.5rem] max-w-[10rem] flex-1 focus-within:z-50">
            <OreDropdown
              focusKey="inst-filter-sort"
              onArrowPress={handleArrow('inst-filter-sort')}
              options={sortOptions}
              value={sort || 'relevance'}
              onChange={setSort}
              className="!h-[2.75rem] w-full"
            />
          </div>

          <div className="relative min-w-[11.25rem] flex-1 focus-within:z-50">
            <OreInput
              focusKey="inst-filter-search"
              width="100%"
              height="2.75rem"
              onArrowPress={handleArrow('inst-filter-search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              placeholder={
                resourceTab === 'shader'
                  ? '搜索适配当前实例的光影...'
                  : resourceTab === 'resourcepack'
                    ? '搜索适配当前实例的资源包...'
                    : '搜索适配当前实例的模组...'
              }
              prefixNode={<Search size="1rem" />}
              containerClassName="!space-y-0 !h-[2.75rem] w-full"
            />
          </div>

          <div className="relative w-[6.25rem] shrink-0 focus-within:z-50">
            <OreButton
              focusKey="inst-filter-btn-search"
              onArrowPress={handleArrow('inst-filter-btn-search')}
              variant="primary"
              size="auto"
              onClick={onSearch}
              className="!h-[2.75rem] w-full font-bold tracking-wider text-black"
            >
              <Search size="1rem" className="mr-1.5" />
              搜索
            </OreButton>
          </div>

          <div className="relative w-[5.625rem] shrink-0 focus-within:z-50">
            <OreButton
              focusKey="inst-filter-btn-reset"
              onArrowPress={handleArrow('inst-filter-btn-reset')}
              variant="secondary"
              size="auto"
              onClick={onReset}
              className="!h-[2.75rem] w-full text-black"
            >
              <RotateCcw size="1rem" className="mr-1.5" />
              重置
            </OreButton>
          </div>
        </div>
      </div>
    </div>
  );
};
