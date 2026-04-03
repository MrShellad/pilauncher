// src/features/InstanceDetail/components/tabs/mods/InstanceFilterBar.tsx
import React from 'react';
import { Search, RotateCcw, Package, Image as LucideImage, Blocks } from 'lucide-react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { OreToggleButton } from '../../../../../ui/primitives/OreToggleButton';
import { OreInput } from '../../../../../ui/primitives/OreInput';
import { OreDropdown } from '../../../../../ui/primitives/OreDropdown';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { ModrinthIcon, CurseforgeIcon } from '../../../../Download/components/Icons';

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
  sort,
  setSort,
  onSearch,
  onReset
}) => {
  const pageMeta = React.useMemo(() => {
    if (resourceTab === 'resourcepack') {
      return { title: '实例资源包下载', icon: Package };
    }
    if (resourceTab === 'shader') {
      return { title: '实例光影下载', icon: LucideImage };
    }
    return { title: '实例模组下载', icon: Blocks };
  }, [resourceTab]);

  const sourceOptions = [
    {
      label: (
        <div className="flex w-full items-center justify-center font-minecraft tracking-wider">
          <ModrinthIcon className={`mr-1.5 text-[18px] ${source === 'modrinth' ? 'text-white' : 'text-ore-green'}`} />
          Modrinth
        </div>
      ),
      value: 'modrinth'
    },
    {
      label: (
        <div className="flex w-full items-center justify-center font-minecraft tracking-wider">
          <CurseforgeIcon className={`mr-1.5 text-[18px] ${source === 'curseforge' ? 'text-white' : 'text-[#F16436]'}`} />
          CurseForge
        </div>
      ),
      value: 'curseforge'
    }
  ];

  const categoryOptions = resourceTab === 'mod'
    ? [
      { label: '全部分类', value: '' },
      { label: '科技', value: 'technology' },
      { label: '魔法', value: 'magic' },
      { label: '优化', value: 'optimization' },
      { label: '实用', value: 'utility' }
    ]
    : [{ label: '全部分类', value: '' }];

  const sortOptions = [
    { label: '综合排序', value: 'relevance' },
    { label: '下载最多', value: 'downloads' },
    { label: '最近更新', value: 'updated' }
  ];
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
                className="flex h-[44px] cursor-pointer items-center justify-center rounded-sm border border-white/5 bg-black/30 px-4 font-minecraft tracking-wider text-gray-400 transition-colors hover:bg-black/50 hover:text-white active:scale-95"
              >
                <div className="mr-2 flex h-[18px] w-[18px] items-center justify-center rounded-full border-b-[2px] border-red-800 bg-red-600 pb-[1px] font-sans text-[10px] font-bold text-white shadow-sm">
                  B
                </div>
                返回
              </button>
            )}
          </div>

          <div className="flex flex-1 justify-center">
            <div className="pointer-events-none flex items-center gap-2 font-minecraft text-sm uppercase tracking-[0.18em] text-[#E6E8EB]">
              <pageMeta.icon size={16} className="text-ore-green" />
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
          <div className="relative w-[240px] shrink-0 focus-within:z-50">
            <FocusItem
              focusKey="inst-filter-source"
              onArrowPress={handleArrow('inst-filter-source')}
              onEnter={() => setSource(source === 'modrinth' ? 'curseforge' : 'modrinth')}
            >
              {({ ref, focused }) => (
                <div
                  ref={ref as React.RefObject<HTMLDivElement>}
                  className={`h-[44px] w-full rounded-sm transition-all ${focused ? 'z-50 scale-[1.02] brightness-110 shadow-lg ring-[2px] ring-white' : ''}`}
                >
                  <OreToggleButton options={sourceOptions} value={source} onChange={setSource} className="!m-0 h-full" />
                </div>
              )}
            </FocusItem>
          </div>

          <div className="relative min-w-[120px] max-w-[160px] flex-1 focus-within:z-50">
            <OreDropdown
              focusKey="inst-filter-category"
              onArrowPress={handleArrow('inst-filter-category')}
              options={categoryOptions}
              value={category || categoryOptions[0].value}
              onChange={setCategory}
              className="!h-[44px] w-full"
            />
          </div>

          <div className="relative min-w-[120px] max-w-[160px] flex-1 focus-within:z-50">
            <OreDropdown
              focusKey="inst-filter-sort"
              onArrowPress={handleArrow('inst-filter-sort')}
              options={sortOptions}
              value={sort || sortOptions[0].value}
              onChange={setSort}
              className="!h-[44px] w-full"
            />
          </div>

          <div className="relative min-w-[180px] flex-1 focus-within:z-50">
            <OreInput
              focusKey="inst-filter-search"
              width="100%"
              height="44px"
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
              prefixNode={<Search size={16} />}
              containerClassName="!space-y-0 !h-[44px] w-full"
            />
          </div>

          <div className="relative w-[100px] shrink-0 focus-within:z-50">
            <OreButton
              focusKey="inst-filter-btn-search"
              onArrowPress={handleArrow('inst-filter-btn-search')}
              variant="primary"
              size="auto"
              onClick={onSearch}
              className="!h-[44px] w-full font-bold tracking-wider text-black"
            >
              <Search size={16} className="mr-1.5" />
              搜索
            </OreButton>
          </div>

          <div className="relative w-[90px] shrink-0 focus-within:z-50">
            <OreButton
              focusKey="inst-filter-btn-reset"
              onArrowPress={handleArrow('inst-filter-btn-reset')}
              variant="secondary"
              size="auto"
              onClick={onReset}
              className="!h-[44px] w-full text-black"
            >
              <RotateCcw size={16} className="mr-1.5" />
              重置
            </OreButton>
          </div>
        </div>
      </div>
    </div>
  );
};
