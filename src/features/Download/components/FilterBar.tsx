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
  const scaleClassName = `
    [--filter-shell-px:0.875rem]
    [--filter-shell-py:0.5rem]
    [--filter-section-gap:0.5rem]
    [--filter-row-gap:0.375rem]
    [--filter-col-gap:0.375rem]
    [--filter-control-h:2.5rem]
    [--filter-tab-min-w:7.25rem]
    [--filter-tab-max-w:48rem]
    [--filter-tab-font:0.6875rem]
    [--filter-tab-icon:0.9375rem]
    [--filter-tab-gap:0.5rem]
    [--filter-tab-px:0.75rem]
    [--filter-tab-indicator-h:0.125rem]
    [--filter-tab-indicator-bottom:0.25rem]
    [--filter-tab-indicator-inset:0.625rem]
    [--filter-action-font:0.8125rem]
    [--filter-input-font:0.75rem]
    [--filter-icon-size:0.875rem]
    [--filter-control-hint-scale:1]
    min-[1920px]:[--filter-shell-px:1rem]
    min-[1920px]:[--filter-shell-py:0.625rem]
    min-[1920px]:[--filter-section-gap:0.625rem]
    min-[1920px]:[--filter-row-gap:0.5rem]
    min-[1920px]:[--filter-col-gap:0.5rem]
    min-[1920px]:[--filter-control-h:2.75rem]
    min-[1920px]:[--filter-tab-min-w:8.25rem]
    min-[1920px]:[--filter-tab-max-w:56rem]
    min-[1920px]:[--filter-tab-font:0.75rem]
    min-[1920px]:[--filter-tab-icon:1rem]
    min-[1920px]:[--filter-tab-gap:0.625rem]
    min-[1920px]:[--filter-tab-px:0.875rem]
    min-[1920px]:[--filter-tab-indicator-h:0.1875rem]
    min-[1920px]:[--filter-tab-indicator-bottom:0.3125rem]
    min-[1920px]:[--filter-tab-indicator-inset:0.75rem]
    min-[1920px]:[--filter-action-font:0.875rem]
    min-[1920px]:[--filter-input-font:0.8125rem]
    min-[1920px]:[--filter-icon-size:0.9375rem]
    min-[1920px]:[--filter-control-hint-scale:1.08]
    min-[2560px]:[--filter-shell-px:1.25rem]
    min-[2560px]:[--filter-shell-py:0.75rem]
    min-[2560px]:[--filter-section-gap:0.75rem]
    min-[2560px]:[--filter-row-gap:0.625rem]
    min-[2560px]:[--filter-col-gap:0.625rem]
    min-[2560px]:[--filter-control-h:3rem]
    min-[2560px]:[--filter-tab-min-w:9.25rem]
    min-[2560px]:[--filter-tab-max-w:66rem]
    min-[2560px]:[--filter-tab-font:0.875rem]
    min-[2560px]:[--filter-tab-icon:1.125rem]
    min-[2560px]:[--filter-tab-gap:0.75rem]
    min-[2560px]:[--filter-tab-px:1rem]
    min-[2560px]:[--filter-tab-indicator-h:0.1875rem]
    min-[2560px]:[--filter-tab-indicator-bottom:0.375rem]
    min-[2560px]:[--filter-tab-indicator-inset:0.875rem]
    min-[2560px]:[--filter-action-font:0.9375rem]
    min-[2560px]:[--filter-input-font:0.875rem]
    min-[2560px]:[--filter-icon-size:1rem]
    min-[2560px]:[--filter-control-hint-scale:1.16]
    min-[3840px]:[--filter-shell-px:1.5rem]
    min-[3840px]:[--filter-shell-py:0.875rem]
    min-[3840px]:[--filter-section-gap:0.875rem]
    min-[3840px]:[--filter-row-gap:0.75rem]
    min-[3840px]:[--filter-col-gap:0.75rem]
    min-[3840px]:[--filter-control-h:3.5rem]
    min-[3840px]:[--filter-tab-min-w:10.75rem]
    min-[3840px]:[--filter-tab-max-w:78rem]
    min-[3840px]:[--filter-tab-font:1rem]
    min-[3840px]:[--filter-tab-icon:1.25rem]
    min-[3840px]:[--filter-tab-gap:0.875rem]
    min-[3840px]:[--filter-tab-px:1.25rem]
    min-[3840px]:[--filter-tab-indicator-h:0.25rem]
    min-[3840px]:[--filter-tab-indicator-bottom:0.4375rem]
    min-[3840px]:[--filter-tab-indicator-inset:1rem]
    min-[3840px]:[--filter-action-font:1.0625rem]
    min-[3840px]:[--filter-input-font:1rem]
    min-[3840px]:[--filter-icon-size:1.125rem]
    min-[3840px]:[--filter-control-hint-scale:1.28]
  `;
  const fieldClassName = 'min-w-0 min-h-[var(--filter-control-h)]';
  const controlHintClassName = 'origin-center scale-[var(--filter-control-hint-scale)]';
  const tabButtonClassName = `
    relative flex h-[var(--filter-control-h)] min-w-[var(--filter-tab-min-w)] flex-1 items-center justify-center
    gap-[var(--filter-tab-gap)] border-[0.125rem] border-[#141516] px-[var(--filter-tab-px)] pb-[0.1875rem]
    font-minecraft text-[var(--filter-tab-font)] uppercase tracking-[0.14em] outline-none transition-none
  `;
  const sourceToggleClassName = `
    !m-0
    [&_.ore-toggle-btn-group]:!h-[var(--filter-control-h)]
    [&_.ore-toggle-btn-item]:!h-[var(--filter-control-h)]
    [&_.ore-toggle-btn-item]:!px-[0.75rem]
    [&_.ore-toggle-btn-item]:!text-[var(--filter-input-font)]
    [&_.ore-toggle-btn-item_svg]:size-[var(--filter-icon-size)]
  `;
  const inputContainerClassName = 'w-full !space-y-0 [&_svg]:size-[var(--filter-icon-size)]';
  const inputClassName = '!border-[#0F1011] !bg-[#171819] !text-[var(--filter-input-font)] !text-white placeholder:!text-[#B8C0C7]';
  const dropdownClassName =
    'w-full !h-[var(--filter-control-h)] [&_.ore-dropdown-trigger]:!h-[var(--filter-control-h)] [&_.ore-dropdown-trigger]:!border-[#141516] [&_.ore-dropdown-trigger]:!bg-[#E4E7EB] [&_.ore-dropdown-trigger>div>span]:!text-[#121314] [&_.ore-dropdown-trigger>div>span]:!text-[var(--filter-input-font)] [&_.ore-dropdown-trigger_svg]:!text-[#121314] [&_.ore-dropdown-trigger_svg]:size-[var(--filter-icon-size)]';
  const actionButtonClassName = 'w-full !h-[var(--filter-control-h)] !text-[var(--filter-action-font)] font-bold tracking-wider [&_svg]:size-[var(--filter-icon-size)]';

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
      className={`flex-shrink-0 border-b-[0.125rem] border-[#1E1E1F] bg-[#313233] px-[var(--filter-shell-px)] py-[var(--filter-shell-py)] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.08)] ${scaleClassName}`}
    >
      <div className="mx-auto flex w-full max-w-[93.75rem] flex-col gap-[var(--filter-section-gap)] min-[2560px]:max-w-[106.25rem] min-[3840px]:max-w-[137.5rem]">
        <div className="flex min-h-[var(--filter-control-h)] items-center justify-center gap-[var(--filter-col-gap)]">
          <div className="shrink-0 items-center flex">
            <ControlHint label="LT" variant="trigger" tone="dark" className={controlHintClassName} />
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-center">
            <div className="flex min-w-0 max-w-[var(--filter-tab-max-w)] flex-1 flex-wrap items-center justify-center gap-[var(--filter-col-gap)]">
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
                    className={`${tabButtonClassName} ${isActive ? 'bg-[#3C8527] text-white' : 'bg-[#E4E7EB] text-[#121314] hover:bg-[#F0F3F6]'}`}
                    style={{
                      boxShadow: isActive
                        ? 'inset 0 -0.1875rem #1D4D13, inset 0.125rem 0.125rem rgba(255,255,255,0.18), inset -0.125rem -0.3125rem rgba(255,255,255,0.08)'
                        : 'inset 0 -0.1875rem #58585A, inset 0.125rem 0.125rem rgba(255,255,255,0.8), inset -0.125rem -0.3125rem rgba(255,255,255,0.45)'
                    }}
                  >
                    <Icon className={`size-[var(--filter-tab-icon)] ${isActive ? 'text-white' : 'text-[#121314]'}`} />
                    <span className="truncate">{tab.label}</span>
                    {isActive && (
                      <span
                        className="absolute bg-white/90"
                        style={{
                          left: 'var(--filter-tab-indicator-inset)',
                          right: 'var(--filter-tab-indicator-inset)',
                          bottom: 'var(--filter-tab-indicator-bottom)',
                          height: 'var(--filter-tab-indicator-h)'
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="shrink-0 items-center flex">
            <ControlHint label="RT" variant="trigger" tone="dark" className={controlHintClassName} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-[var(--filter-col-gap)] gap-y-[var(--filter-row-gap)] md:grid-cols-2 lg:grid-cols-12">
          <div className={`${fieldClassName} md:col-span-1 lg:col-span-3`}>
            <FocusItem
              focusKey="filter-source-toggle"
              onArrowPress={handleFilterArrow('filter-source-toggle')}
              onEnter={() => setSource(source === 'modrinth' ? 'curseforge' : 'modrinth')}
            >
              {({ ref, focused }) => (
                <div
                  ref={ref as React.RefObject<HTMLDivElement>}
                  className={focused ? 'outline outline-[0.125rem] outline-offset-[0.1875rem] outline-white' : ''}
                >
                  <OreToggleButton
                    options={sourceOptions}
                    value={source}
                    onChange={(value) => setSource(value as DownloadSource)}
                    focusable={false}
                    className={sourceToggleClassName}
                    size="sm"
                  />
                </div>
              )}
            </FocusItem>
            {source === 'curseforge' && !isCurseForgeAvailable && (
              <div className="mt-0.5 text-[0.625rem] text-[#FFE08A]">
                {t('download.curseforge.apiKeyMissing', {
                  defaultValue: 'Set VITE_CURSEFORGE_API_KEY to enable CurseForge requests.'
                })}
              </div>
            )}
          </div>

          <div className={`${fieldClassName} md:col-span-2 lg:col-span-6 lg:justify-self-center lg:w-full`}>
            <OreInput
              focusKey="download-search-input"
              width="100%"
              height="var(--filter-control-h)"
              value={query}
              onArrowPress={handleFilterArrow('download-search-input')}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSearch();
              }}
              placeholder={t('download.placeholders.search', { defaultValue: 'Search resources or authors...' })}
              prefixNode={<Search className="size-[var(--filter-icon-size)]" />}
              className={inputClassName}
              containerClassName={inputContainerClassName}
            />
          </div>

          <div className={`${fieldClassName} md:col-span-2 lg:col-span-3`}>
            <div className="grid h-full grid-cols-2 gap-[var(--filter-col-gap)]">
              <OreButton
                focusKey="download-btn-search"
                onArrowPress={handleFilterArrow('download-btn-search')}
                variant="primary"
                size="auto"
                onClick={onSearch}
                className={`${actionButtonClassName} text-white`}
              >
                <Search className="mr-[0.375rem] size-[var(--filter-icon-size)] text-white" />
                {t('download.actions.search', { defaultValue: 'Search' })}
              </OreButton>

              <OreButton
                focusKey="download-btn-reset"
                onArrowPress={handleFilterArrow('download-btn-reset')}
                variant="secondary"
                size="auto"
                onClick={onReset}
                className={`${actionButtonClassName} text-black`}
              >
                <RotateCcw className="mr-[0.375rem] size-[var(--filter-icon-size)] text-black" />
                {t('download.actions.reset', { defaultValue: 'Reset' })}
              </OreButton>
            </div>
          </div>

          <div className={`${fieldClassName} md:col-span-1 lg:col-span-3`}>
            <OreDropdown
              focusKey="filter-mc-version"
              onArrowPress={handleFilterArrow('filter-mc-version')}
              options={translatedMcVersionOptions}
              value={mcVersion || ''}
              onChange={setMcVersion}
              className={dropdownClassName}
              placeholder={t('download.filters.versionAll', { defaultValue: 'All Versions' })}
            />
          </div>

          <div className={`${fieldClassName} md:col-span-1 lg:col-span-3`}>
            <OreDropdown
              focusKey="filter-loader"
              onArrowPress={handleFilterArrow('filter-loader')}
              options={loaderOptions}
              value={loaderType || ''}
              onChange={setLoaderType}
              className={dropdownClassName}
              placeholder={t('download.filters.loaderAll', { defaultValue: 'All' })}
            />
          </div>

          <div className={`${fieldClassName} md:col-span-1 lg:col-span-3`}>
            <OreDropdown
              focusKey="filter-category"
              onArrowPress={handleFilterArrow('filter-category')}
              options={translatedCategoryOptions}
              value={category || ''}
              onChange={setCategory}
              className={dropdownClassName}
              placeholder={t('download.filters.categoryAll', { defaultValue: 'All Categories' })}
            />
          </div>

          <div className={`${fieldClassName} md:col-span-1 lg:col-span-3`}>
            <OreDropdown
              focusKey="filter-sort"
              onArrowPress={handleFilterArrow('filter-sort')}
              options={sortOptions}
              value={sort || 'relevance'}
              onChange={setSort}
              className={dropdownClassName}
              placeholder={t('download.sort.relevance', { defaultValue: 'Relevance' })}
            />
          </div>
        </div>
      </div>
    </FocusBoundary>
  );
};
