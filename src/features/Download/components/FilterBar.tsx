import React, { useCallback, useEffect, useMemo } from 'react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { RotateCcw, Search, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ControlHint } from '../../../ui/components/ControlHint';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useInputAction } from '../../../ui/focus/InputDriver';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../ui/primitives/OreDropdown';
import { OreInput } from '../../../ui/primitives/OreInput';
import { OreToggleButton } from '../../../ui/primitives/OreToggleButton';
import type { DownloadSource, FilterOption, TabType } from '../hooks/useResourceDownload';
import {
  getLocalizedDownloadOptionLabel
} from '../logic/downloadTagLabels';

import {
  blockClassName,
  firstRow,
  getLoaderOptions,
  getSortOptions,
  getSourceOptions,
  rowMap,
  secondRow,
  type FilterKey
} from './FilterBar.constants';

export interface DownloadTabConfig {
  id: TabType;
  label: string;
  icon: LucideIcon;
}

export interface FilterBarProps {
  activeTab: TabType;
  tabs: DownloadTabConfig[];
  onTabChange: (tab: TabType) => void;
  query: string;
  setQuery: (v: string) => void;
  source: DownloadSource;
  setSource: (v: DownloadSource) => void;
  mcVersion: string;
  setMcVersion: (v: string) => void;
  loaderType: string;
  setLoaderType: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  sort: string;
  setSort: (v: string) => void;
  mcVersionOptions: FilterOption[];
  categoryOptions: FilterOption[];
  isCurseForgeAvailable: boolean;
  onSearch: () => void;
  onReset: () => void;
}

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
  mcVersionOptions,
  categoryOptions,
  isCurseForgeAvailable,
  onSearch,
  onReset
}) => {
  const { t, i18n } = useTranslation();

  const localizeCategoryLabel = useCallback((option: FilterOption) => {
    return getLocalizedDownloadOptionLabel({
      t,
      language: i18n.language,
      option
    });
  }, [i18n.language, t]);

  const switchTabBy = useCallback((direction: -1 | 1) => {
    const activeElement = document.activeElement as HTMLElement | null;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) return;
    if (document.querySelector('.fixed.inset-0')) return;

    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = tabs.length - 1;
    if (nextIndex >= tabs.length) nextIndex = 0;

    onTabChange(tabs[nextIndex].id);
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
      if (doesFocusableExist(nextKey)) setFocus(nextKey);
      return false;
    }

    return true;
  };

  const sourceOptions = useMemo(() => getSourceOptions(t, source), [t, source]);
  const loaderOptions = useMemo(() => getLoaderOptions(t), [t]);
  const sortOptions = useMemo(() => getSortOptions(t), [t]);

  const translatedMcVersionOptions = useMemo(() => {
    const options = [...mcVersionOptions];
    if (mcVersion && !options.some((item) => item.value === mcVersion)) {
      options.push({ label: mcVersion, value: mcVersion });
    }

    return [
      { label: t('download.filters.versionAll', { defaultValue: 'All Versions' }), value: '' },
      ...options
    ];
  }, [mcVersion, mcVersionOptions, t]);

  const translatedCategoryOptions = useMemo(() => [
    { label: t('download.filters.categoryAll', { defaultValue: 'All Categories' }), value: '' },
    ...categoryOptions.map((option) => ({
      label: localizeCategoryLabel(option),
      value: option.value
    }))
  ], [categoryOptions, localizeCategoryLabel, t]);

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
          <div className="flex shrink-0 items-center intent-gamepad:hidden">
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
          <div className="flex shrink-0 items-center intent-gamepad:hidden">
            <ControlHint label="PgDn" variant="keyboard" tone="neutral" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-12">
          <div className={`${blockClassName} md:col-span-1 lg:col-span-3`}>
            <div className="mb-1 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[#D0D1D4]">
              {t('download.filters.source', { defaultValue: 'Source' })}
            </div>
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
                    onChange={(value) => setSource(value as DownloadSource)}
                    focusable={false}
                    className="!m-0 !h-[36px]"
                    size="sm"
                  />
                </div>
              )}
            </FocusItem>
            {source === 'curseforge' && !isCurseForgeAvailable && (
              <div className="mt-1 text-[10px] text-[#FFD166]">
                {t('download.curseforge.apiKeyMissing', {
                  defaultValue: 'Set VITE_CURSEFORGE_API_KEY to enable CurseForge requests.'
                })}
              </div>
            )}
          </div>

          <div className={`${blockClassName} md:col-span-1 lg:col-span-5`}>
            <div className="mb-1 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[#D0D1D4]">
              {t('download.filters.keyword', { defaultValue: 'Keyword' })}
            </div>
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
              placeholder={t('download.placeholders.search', { defaultValue: 'Search resources or authors...' })}
              prefixNode={<Search size={14} />}
              containerClassName="!space-y-0 w-full"
            />
          </div>

          <div className={`${blockClassName} md:col-span-1 lg:col-span-2`}>
            <div className="mb-1 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[#D0D1D4]">
              {t('download.actions.search', { defaultValue: 'Search' })}
            </div>
            <OreButton
              focusKey="download-btn-search"
              onArrowPress={handleFilterArrow('download-btn-search')}
              variant="primary"
              size="auto"
              onClick={onSearch}
              className="w-full !h-[36px] text-[13px] font-bold tracking-wider text-black"
            >
              <Search size={14} className="mr-1.5" />
              {t('download.actions.search', { defaultValue: 'Search' })}
            </OreButton>
          </div>

          <div className={`${blockClassName} md:col-span-1 lg:col-span-2`}>
            <div className="mb-1 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[#D0D1D4]">
              {t('download.actions.reset', { defaultValue: 'Reset' })}
            </div>
            <OreButton
              focusKey="download-btn-reset"
              onArrowPress={handleFilterArrow('download-btn-reset')}
              variant="secondary"
              size="auto"
              onClick={onReset}
              className="w-full !h-[36px] text-[13px] text-black"
            >
              <RotateCcw size={14} className="mr-1.5" />
              {t('download.actions.reset', { defaultValue: 'Reset' })}
            </OreButton>
          </div>

          <div className={`${blockClassName} md:col-span-1 lg:col-span-3`}>
            <div className="mb-1 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[#D0D1D4]">
              {t('download.filters.gameVersion', { defaultValue: 'Game Version' })}
            </div>
            <OreDropdown
              focusKey="filter-mc-version"
              onArrowPress={handleFilterArrow('filter-mc-version')}
              options={translatedMcVersionOptions}
              value={mcVersion || ''}
              onChange={setMcVersion}
              className="w-full !h-[36px]"
              placeholder={t('download.filters.versionAll', { defaultValue: 'All Versions' })}
            />
          </div>

          <div className={`${blockClassName} md:col-span-1 lg:col-span-3`}>
            <div className="mb-1 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[#D0D1D4]">
              {t('download.filters.loader', { defaultValue: 'Loader' })}
            </div>
            <OreDropdown
              focusKey="filter-loader"
              onArrowPress={handleFilterArrow('filter-loader')}
              options={loaderOptions}
              value={loaderType || ''}
              onChange={setLoaderType}
              className="w-full !h-[36px]"
              placeholder={t('download.filters.loaderAll', { defaultValue: 'All' })}
            />
          </div>

          <div className={`${blockClassName} md:col-span-1 lg:col-span-3`}>
            <div className="mb-1 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[#D0D1D4]">
              {t('download.filters.category', { defaultValue: 'Category' })}
            </div>
            <OreDropdown
              focusKey="filter-category"
              onArrowPress={handleFilterArrow('filter-category')}
              options={translatedCategoryOptions}
              value={category || ''}
              onChange={setCategory}
              className="w-full !h-[36px]"
              placeholder={t('download.filters.categoryAll', { defaultValue: 'All Categories' })}
            />
          </div>

          <div className={`${blockClassName} md:col-span-1 lg:col-span-3`}>
            <div className="mb-1 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[#D0D1D4]">
              {t('download.filters.sort', { defaultValue: 'Sort' })}
            </div>
            <OreDropdown
              focusKey="filter-sort"
              onArrowPress={handleFilterArrow('filter-sort')}
              options={sortOptions}
              value={sort || 'relevance'}
              onChange={setSort}
              className="w-full !h-[36px]"
              placeholder={t('download.sort.relevance', { defaultValue: 'Relevance' })}
            />
          </div>
        </div>
      </div>
    </FocusBoundary>
  );
};
