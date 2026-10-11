import React, { useCallback, useEffect, useMemo } from 'react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';

import { getLocalizedDownloadOptionLabel } from '@/features/resource-catalog';
import { useScreenDensity } from '../../../hooks/ui/useScreenDensity';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { useInputAction } from '../../../ui/focus/InputDriver';
import type { FilterOption } from '../hooks/useResourceDownload';
import { useDownloadLayoutStore } from '../stores/useDownloadLayoutStore';
import {
  firstRow,
  getLoaderOptions,
  getSortOptions,
  getSourceOptions,
  rowMap,
  secondRow,
  type FilterKey,
} from './FilterBar.constants';
import { FilterBarFields } from './FilterBarFields';
import { FilterBarTabs } from './FilterBarTabs';
import type { FilterBarProps } from './filterBarModel';
import { filterBarScaleClassName } from './filterBarStyles';

export type { DownloadTabConfig, FilterBarProps } from './filterBarModel';

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
  onReset,
}) => {
  const { t, i18n } = useTranslation();
  const density = useScreenDensity();
  const forceDoubleColumn = useDownloadLayoutStore((state) => state.forceDoubleColumn);
  const setForceDoubleColumn = useDownloadLayoutStore((state) => state.setForceDoubleColumn);
  const isCompactOrDeck = density === 'compact' || density === 'deck';

  const localizeCategoryLabel = useCallback((option: FilterOption) => {
    return getLocalizedDownloadOptionLabel({
      t,
      language: i18n.language,
      option,
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
      ...options,
    ];
  }, [mcVersion, mcVersionOptions, t]);

  const translatedCategoryOptions = useMemo(() => [
    { label: t('download.filters.categoryAll', { defaultValue: 'All Categories' }), value: '' },
    ...categoryOptions.map((option) => ({
      label: localizeCategoryLabel(option),
      value: option.value,
    })),
  ], [categoryOptions, localizeCategoryLabel, t]);

  return (
    <FocusBoundary
      id="download-filter-bar"
      defaultFocusKey="download-search-input"
      className={`flex-shrink-0 border-b-[0.125rem] border-[#1E1E1F] bg-[#313233] px-[var(--filter-shell-px)] pt-[var(--filter-shell-py)] pb-[1rem] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.08)] ${filterBarScaleClassName}`}
    >
      <div className="mx-auto flex w-full max-w-[93.75rem] flex-col gap-[var(--filter-section-gap)] min-[2560px]:max-w-[106.25rem] min-[3840px]:max-w-[137.5rem]">
        <FilterBarTabs
          activeTab={activeTab}
          tabs={tabs}
          onTabChange={onTabChange}
          isCompactOrDeck={isCompactOrDeck}
          forceDoubleColumn={forceDoubleColumn}
          setForceDoubleColumn={setForceDoubleColumn}
          t={t}
        />
        <FilterBarFields
          category={category}
          handleFilterArrow={handleFilterArrow}
          isCompactOrDeck={isCompactOrDeck}
          isCurseForgeAvailable={isCurseForgeAvailable}
          loaderOptions={loaderOptions}
          loaderType={loaderType}
          mcVersion={mcVersion}
          onReset={onReset}
          onSearch={onSearch}
          query={query}
          setCategory={setCategory}
          setLoaderType={setLoaderType}
          setMcVersion={setMcVersion}
          setQuery={setQuery}
          setSort={setSort}
          setSource={setSource}
          sort={sort}
          sortOptions={sortOptions}
          source={source}
          sourceOptions={sourceOptions}
          translatedCategoryOptions={translatedCategoryOptions}
          translatedMcVersionOptions={translatedMcVersionOptions}
          t={t}
        />
      </div>
    </FocusBoundary>
  );
};
