// src/features/Download/components/FilterBar.tsx
import React, { useCallback, useEffect } from 'react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { RotateCcw, Search, type LucideIcon } from 'lucide-react';

import mcvData from '../../../assets/download/mcv.json';
import { ControlHint } from '../../../ui/components/ControlHint';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useInputAction } from '../../../ui/focus/InputDriver';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../ui/primitives/OreDropdown';
import { OreInput } from '../../../ui/primitives/OreInput';
import { OreToggleButton, type ToggleOption } from '../../../ui/primitives/OreToggleButton';
import type { TabType } from '../hooks/useResourceDownload';

export const ModrinthIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}>
    <path
      fill="currentColor"
      d="M12.252.004a11.78 11.768 0 0 0-8.92 3.73a11 10.999 0 0 0-2.17 3.11a11.37 11.359 0 0 0-1.16 5.169c0 1.42.17 2.5.6 3.77c.24.759.77 1.899 1.17 2.529a12.3 12.298 0 0 0 8.85 5.639c.44.05 2.54.07 2.76.02c.2-.04.22.1-.26-1.7l-.36-1.37l-1.01-.06a8.5 8.489 0 0 1-5.18-1.8a5.34 5.34 0 0 1-1.3-1.26c0-.05.34-.28.74-.5a37.572 37.545 0 0 1 2.88-1.629c.03 0 .5.45 1.06.98l1 .97l2.07-.43l2.06-.43l1.47-1.47c.8-.8 1.48-1.5 1.48-1.52c0-.09-.42-1.63-.46-1.7c-.04-.06-.2-.03-1.02.18c-.53.13-1.2.3-1.45.4l-.48.15l-.53.53l-.53.53l-.93.1l-.93.07l-.52-.5a2.7 2.7 0 0 1-.96-1.7l-.13-.6l.43-.57c.68-.9.68-.9 1.46-1.1c.4-.1.65-.2.83-.33c.13-.099.65-.579 1.14-1.069l.9-.9l-.7-.7l-.7-.7l-1.95.54c-1.07.3-1.96.53-1.97.53c-.03 0-2.23 2.48-2.63 2.97l-.29.35l.28 1.03c.16.56.3 1.16.31 1.34l.03.3l-.34.23c-.37.23-2.22 1.3-2.84 1.63c-.36.2-.37.2-.44.1c-.08-.1-.23-.6-.32-1.03c-.18-.86-.17-2.75.02-3.73a8.84 8.839 0 0 1 7.9-6.93c.43-.03.77-.08.78-.1c.06-.17.5-2.999.47-3.039c-.01-.02-.1-.02-.2-.03Zm3.68.67c-.2 0-.3.1-.37.38c-.06.23-.46 2.42-.46 2.52c0 .04.1.11.22.16a8.51 8.499 0 0 1 2.99 2a8.38 8.379 0 0 1 2.16 3.449a6.9 6.9 0 0 1 .4 2.8c0 1.07 0 1.27-.1 1.73a9.37 9.369 0 0 1-1.76 3.769c-.32.4-.98 1.06-1.37 1.38c-.38.32-1.54 1.1-1.7 1.14c-.1.03-.1.06-.07.26c.03.18.64 2.56.7 2.78l.06.06a12.07 12.058 0 0 0 7.27-9.4c.13-.77.13-2.58 0-3.4a11.96 11.948 0 0 0-5.73-8.578c-.7-.42-2.05-1.06-2.25-1.06Z"
    />
  </svg>
);

export const CurseforgeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}>
    <path
      fill="currentColor"
      d="M18.326 9.214s4.9-.772 5.674-3.026h-7.507V4.4H0l2.032 2.358v2.415s5.127-.267 7.11 1.237c2.714 2.516-3.053 5.917-3.053 5.917l-.99 3.273c1.547-1.473 4.494-3.377 9.899-3.286c-2.057.65-4.125 1.665-5.735 3.286h10.925l-1.029-3.273s-7.918-4.668-.833-7.112z"
    />
  </svg>
);

const MC_VERSIONS: string[] = Array.isArray(mcvData) ? mcvData : (mcvData as { versions?: string[] }).versions || [];

interface DownloadTabConfig {
  id: TabType;
  label: string;
  icon: LucideIcon;
}

interface FilterBarProps {
  activeTab: TabType;
  tabs: DownloadTabConfig[];
  onTabChange: (tab: TabType) => void;
  query: string;
  setQuery: (v: string) => void;
  source: string;
  setSource: (v: string) => void;
  mcVersion: string;
  setMcVersion: (v: string) => void;
  loaderType: string;
  setLoaderType: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  sort: string;
  setSort: (v: string) => void;
  onSearch: () => void;
  onReset: () => void;
}

type FilterKey =
  | 'filter-source-toggle'
  | 'download-search-input'
  | 'download-btn-search'
  | 'download-btn-reset'
  | 'filter-mc-version'
  | 'filter-loader'
  | 'filter-category'
  | 'filter-sort';

const firstRow: FilterKey[] = [
  'filter-source-toggle',
  'download-search-input',
  'download-btn-search',
  'download-btn-reset'
];

const secondRow: FilterKey[] = [
  'filter-mc-version',
  'filter-loader',
  'filter-category',
  'filter-sort'
];

const rowMap: Record<FilterKey, FilterKey[]> = {
  'filter-source-toggle': firstRow,
  'download-search-input': firstRow,
  'download-btn-search': firstRow,
  'download-btn-reset': firstRow,
  'filter-mc-version': secondRow,
  'filter-loader': secondRow,
  'filter-category': secondRow,
  'filter-sort': secondRow
};

const blockClassName =
  'relative min-w-0 border-[2px] border-[#1E1E1F] bg-[#48494A] px-2.5 py-1.5 shadow-[inset_0_-3px_0_#313233,inset_2px_2px_0_rgba(255,255,255,0.12)]';

export const FilterBar: React.FC<FilterBarProps> = ({
  activeTab,
  tabs,
  onTabChange,
  query,
  setQuery,
  source,
  setSource,
  mcVersion,
  setMcVersion,
  loaderType,
  setLoaderType,
  category,
  setCategory,
  sort,
  setSort,
  onSearch,
  onReset
}) => {
  const switchTabBy = useCallback((direction: -1 | 1) => {
    const activeElement = document.activeElement as HTMLElement | null;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) return;
    if (document.querySelector('.fixed.inset-0')) return;

    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = tabs.length - 1;
    if (nextIndex >= tabs.length) nextIndex = 0;

    const nextTab = tabs[nextIndex];
    onTabChange(nextTab.id);
  }, [activeTab, onTabChange, tabs]);

  useInputAction('PAGE_LEFT', () => switchTabBy(-1));
  useInputAction('PAGE_RIGHT', () => switchTabBy(1));

  useEffect(() => {
    const handlePageKeys = (event: KeyboardEvent) => {
      if (event.key !== 'PageUp' && event.key !== 'PageDown') return;
      event.preventDefault();
      switchTabBy(event.key === 'PageDown' ? 1 : -1);
    };

    window.addEventListener('keydown', handlePageKeys);
    return () => window.removeEventListener('keydown', handlePageKeys);
  }, [switchTabBy]);

  const moveFocusToGrid = () => {
    if (!doesFocusableExist('download-grid-item-0')) return true;
    setFocus('download-grid-item-0');
    return false;
  };

  const handleFilterArrow = (key: FilterKey) => (direction: string) => {
    const row = rowMap[key];
    const index = row.indexOf(key);

    if (direction === 'down') {
      if (row === firstRow) {
        const nextKey = secondRow[Math.min(index, secondRow.length - 1)];
        if (doesFocusableExist(nextKey)) {
          setFocus(nextKey);
          return false;
        }
      }
      return moveFocusToGrid();
    }

    if (direction === 'up') {
      if (row === secondRow) {
        const nextKey = firstRow[Math.min(index, firstRow.length - 1)];
        if (doesFocusableExist(nextKey)) {
          setFocus(nextKey);
          return false;
        }
      }
      return false;
    }

    if (direction === 'left' || direction === 'right') {
      const nextIndex = direction === 'right'
        ? (index + 1) % row.length
        : (index - 1 + row.length) % row.length;
      const nextKey = row[nextIndex];
      if (doesFocusableExist(nextKey)) {
        setFocus(nextKey);
      }
      return false;
    }

    return true;
  };

  const sourceOptions: ToggleOption[] = [
    {
      label: (
        <div className="flex w-full items-center justify-center gap-1 font-minecraft tracking-wider">
          <ModrinthIcon className={`text-[16px] ${source === 'modrinth' ? 'text-white' : 'text-ore-green'}`} />
          Modrinth
        </div>
      ),
      value: 'modrinth'
    },
    {
      label: (
        <div className="flex w-full items-center justify-center gap-1 font-minecraft tracking-wider">
          <CurseforgeIcon className={`text-[16px] ${source === 'curseforge' ? 'text-white' : 'text-[#F16436]'}`} />
          CurseForge
        </div>
      ),
      value: 'curseforge'
    }
  ];

  const mcVersionOptions = [{ label: '全部版本', value: '' }, ...MC_VERSIONS.map((v) => ({ label: v, value: v }))];
  if (mcVersion && !MC_VERSIONS.includes(mcVersion)) {
    mcVersionOptions.push({ label: mcVersion, value: mcVersion });
  }

  const loaderOptions = [
    { label: '全部', value: '' },
    { label: 'Fabric', value: 'fabric' },
    { label: 'Forge', value: 'forge' },
    { label: 'NeoForge', value: 'neoforge' },
    { label: 'Quilt', value: 'quilt' }
  ];

  const categoryOptions = [
    { label: '全部分类', value: '' },
    { label: '科技', value: 'technology' },
    { label: '魔法', value: 'magic' },
    { label: '性能优化', value: 'optimization' },
    { label: '实用工具', value: 'utility' }
  ];

  const sortOptions = [
    { label: '综合排序', value: 'relevance' },
    { label: '下载量最高', value: 'downloads' },
    { label: '最近更新', value: 'updated' }
  ];

  return (
    <FocusBoundary
      id="download-filter-bar"
      defaultFocusKey="download-search-input"
      className="flex-shrink-0 border-b-[2px] border-[#1E1E1F] bg-[#313233] px-4 py-2 shadow-[inset_0_2px_0_rgba(255,255,255,0.08)]"
    >
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-2">
        <div className="flex min-h-[42px] items-center justify-center gap-2 sm:gap-3">
          <div className="hidden shrink-0 items-center intent-gamepad:flex">
            <ControlHint label="LT" variant="trigger" tone="dark" />
          </div>
          <div className="shrink-0 items-center intent-gamepad:hidden flex">
            <ControlHint label="PgUp" variant="keyboard" tone="neutral" />
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-center">
            <div className="flex min-w-0 max-w-[780px] flex-1 flex-wrap items-center justify-center gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onTabChange(tab.id)}
                    className={`
                      relative flex h-[38px] min-w-[112px] flex-1 items-center justify-center gap-2 border-[2px] border-[#1E1E1F]
                      px-3 pb-[3px] font-minecraft text-[11px] uppercase tracking-[0.14em] outline-none transition-none
                      ${isActive ? 'bg-[#3C8527] text-white' : 'bg-[#D0D1D4] text-black hover:bg-[#E6E8EB]'}
                    `}
                    style={{
                      boxShadow: isActive
                        ? 'inset 0 -3px #1D4D13, inset 2px 2px rgba(255,255,255,0.18), inset -2px -5px rgba(255,255,255,0.08)'
                        : 'inset 0 -3px #58585A, inset 2px 2px rgba(255,255,255,0.65), inset -2px -5px rgba(255,255,255,0.35)'
                    }}
                  >
                    <Icon size={15} className={isActive ? 'text-white' : 'text-black'} />
                    <span className="truncate">{tab.label}</span>
                    {isActive && <span className="absolute inset-x-2.5 bottom-1 h-[2px] bg-white/90" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden shrink-0 items-center intent-gamepad:flex">
            <ControlHint label="RT" variant="trigger" tone="dark" />
          </div>
          <div className="shrink-0 items-center intent-gamepad:hidden flex">
            <ControlHint label="PgDn" variant="keyboard" tone="neutral" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-12">
          <div className={`${blockClassName} md:col-span-1 lg:col-span-3`}>
            <div className="mb-1 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[#D0D1D4]">资源来源</div>
            <FocusItem
              focusKey="filter-source-toggle"
              onArrowPress={handleFilterArrow('filter-source-toggle')}
              onEnter={() => setSource(source === 'modrinth' ? 'curseforge' : 'modrinth')}
            >
              {({ ref, focused }) => (
                <div
                  ref={ref as React.RefObject<HTMLDivElement>}
                  className={`rounded-sm ${focused ? 'outline outline-2 outline-offset-[3px] outline-white' : ''}`}
                >
                  <OreToggleButton
                    options={sourceOptions}
                    value={source}
                    onChange={setSource}
                    focusable={false}
                    className="!m-0 !h-[36px]"
                    size="sm"
                  />
                </div>
              )}
            </FocusItem>
          </div>

          <div className={`${blockClassName} md:col-span-1 lg:col-span-5`}>
            <div className="mb-1 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[#D0D1D4]">关键词</div>
            <OreInput
              focusKey="download-search-input"
              width="100%"
              height="36px"
              value={query}
              onArrowPress={handleFilterArrow('download-search-input')}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSearch();
              }}
              placeholder="搜索模组或作者..."
              prefixNode={<Search size={14} />}
              containerClassName="!space-y-0 w-full"
            />
          </div>

          <div className={`${blockClassName} md:col-span-1 lg:col-span-2`}>
            <div className="mb-1 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[#D0D1D4]">执行搜索</div>
            <OreButton
              focusKey="download-btn-search"
              onArrowPress={handleFilterArrow('download-btn-search')}
              variant="primary"
              size="auto"
              onClick={onSearch}
              className="w-full !h-[36px] text-[13px] font-bold tracking-wider text-black"
            >
              <Search size={14} className="mr-1.5" />
              搜索
            </OreButton>
          </div>

          <div className={`${blockClassName} md:col-span-1 lg:col-span-2`}>
            <div className="mb-1 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[#D0D1D4]">恢复默认</div>
            <OreButton
              focusKey="download-btn-reset"
              onArrowPress={handleFilterArrow('download-btn-reset')}
              variant="secondary"
              size="auto"
              onClick={onReset}
              className="w-full !h-[36px] text-[13px] text-black"
            >
              <RotateCcw size={14} className="mr-1.5" />
              重置
            </OreButton>
          </div>

          <div className={`${blockClassName} md:col-span-1 lg:col-span-3`}>
            <div className="mb-1 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[#D0D1D4]">游戏版本</div>
            <OreDropdown
              focusKey="filter-mc-version"
              onArrowPress={handleFilterArrow('filter-mc-version')}
              options={mcVersionOptions}
              value={mcVersion || ''}
              onChange={setMcVersion}
              className="w-full !h-[36px]"
              placeholder="全部版本"
            />
          </div>

          <div className={`${blockClassName} md:col-span-1 lg:col-span-3`}>
            <div className="mb-1 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[#D0D1D4]">加载器</div>
            <OreDropdown
              focusKey="filter-loader"
              onArrowPress={handleFilterArrow('filter-loader')}
              options={loaderOptions}
              value={loaderType || ''}
              onChange={setLoaderType}
              className="w-full !h-[36px]"
              placeholder="全部"
            />
          </div>

          <div className={`${blockClassName} md:col-span-1 lg:col-span-3`}>
            <div className="mb-1 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[#D0D1D4]">分类</div>
            <OreDropdown
              focusKey="filter-category"
              onArrowPress={handleFilterArrow('filter-category')}
              options={categoryOptions}
              value={category || ''}
              onChange={setCategory}
              className="w-full !h-[36px]"
              placeholder="全部分类"
            />
          </div>

          <div className={`${blockClassName} md:col-span-1 lg:col-span-3`}>
            <div className="mb-1 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[#D0D1D4]">排序方式</div>
            <OreDropdown
              focusKey="filter-sort"
              onArrowPress={handleFilterArrow('filter-sort')}
              options={sortOptions}
              value={sort || 'relevance'}
              onChange={setSort}
              className="w-full !h-[36px]"
              placeholder="综合排序"
            />
          </div>
        </div>
      </div>
    </FocusBoundary>
  );
};
