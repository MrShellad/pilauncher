import React from 'react';
import type { TFunction } from 'i18next';
import { RotateCcw, Search } from 'lucide-react';

import type { DropdownOption } from '../../../ui/primitives/OreDropdown';
import type { ToggleOption } from '../../../ui/primitives/OreToggleButton';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../ui/primitives/OreDropdown';
import { OreInput } from '../../../ui/primitives/OreInput';
import type { FilterArrowHandler, FilterBarProps } from './filterBarModel';
import {
  filterActionButtonClassName,
  filterDropdownClassName,
  filterFieldClassName,
  filterInputClassName,
  filterInputContainerClassName,
} from './filterBarStyles';
import { FilterSourceToggle } from './FilterSourceToggle';

type FilterBarFieldsProps = Pick<
  FilterBarProps,
  | 'category'
  | 'isCurseForgeAvailable'
  | 'loaderType'
  | 'mcVersion'
  | 'onReset'
  | 'onSearch'
  | 'query'
  | 'setCategory'
  | 'setLoaderType'
  | 'setMcVersion'
  | 'setQuery'
  | 'setSort'
  | 'setSource'
  | 'sort'
  | 'source'
> & {
  handleFilterArrow: FilterArrowHandler;
  isCompactOrDeck: boolean;
  loaderOptions: DropdownOption[];
  sortOptions: DropdownOption[];
  sourceOptions: ToggleOption[];
  translatedCategoryOptions: DropdownOption[];
  translatedMcVersionOptions: DropdownOption[];
  t: TFunction;
};

export const FilterBarFields: React.FC<FilterBarFieldsProps> = ({
  category,
  handleFilterArrow,
  isCompactOrDeck,
  isCurseForgeAvailable,
  loaderOptions,
  loaderType,
  mcVersion,
  onReset,
  onSearch,
  query,
  setCategory,
  setLoaderType,
  setMcVersion,
  setQuery,
  setSort,
  setSource,
  sort,
  sortOptions,
  source,
  sourceOptions,
  translatedCategoryOptions,
  translatedMcVersionOptions,
  t,
}) => {
  return (
    <div className="grid grid-cols-1 gap-x-[var(--filter-col-gap)] gap-y-[var(--filter-row-gap)] md:grid-cols-2 lg:grid-cols-12">
      {!isCompactOrDeck && (
        <div className={`${filterFieldClassName} md:col-span-1 lg:col-span-3`}>
          <FilterSourceToggle
            source={source}
            setSource={setSource}
            sourceOptions={sourceOptions}
            handleFilterArrow={handleFilterArrow}
          />
          {source === 'curseforge' && !isCurseForgeAvailable && (
            <div className="mt-0.5 text-[0.625rem] text-[#FFE08A]">
              {t('download.curseforge.apiKeyMissing', {
                defaultValue: 'Set VITE_CURSEFORGE_API_KEY to enable CurseForge requests.',
              })}
            </div>
          )}
        </div>
      )}

      <div className={`${filterFieldClassName} md:col-span-2 ${isCompactOrDeck ? 'lg:col-span-9' : 'lg:col-span-6 lg:justify-self-center'} flex gap-2 lg:w-full`}>
        {isCompactOrDeck && (
          <div className="shrink-0">
            <FilterSourceToggle
              source={source}
              setSource={setSource}
              sourceOptions={sourceOptions}
              handleFilterArrow={handleFilterArrow}
              roundedFocus
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
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
            className={filterInputClassName}
            containerClassName={filterInputContainerClassName}
          />
        </div>
      </div>

      {isCompactOrDeck && source === 'curseforge' && !isCurseForgeAvailable && (
        <div className="-mt-1 px-1 text-[0.625rem] text-[#FFE08A] md:col-span-2">
          {t('download.curseforge.apiKeyMissing', {
            defaultValue: 'Set VITE_CURSEFORGE_API_KEY to enable CurseForge requests.',
          })}
        </div>
      )}

      <div className={`${filterFieldClassName} md:col-span-2 lg:col-span-3`}>
        <div className="grid h-full grid-cols-2 gap-[var(--filter-col-gap)]">
          <OreButton
            focusKey="download-btn-search"
            onArrowPress={handleFilterArrow('download-btn-search')}
            variant="primary"
            size="auto"
            onClick={() => onSearch()}
            className={`${filterActionButtonClassName} !text-white`}
          >
            <Search className="mr-[0.375rem] size-[var(--filter-icon-size)] !text-white" />
            {t('download.actions.search', { defaultValue: 'Search' })}
          </OreButton>

          <OreButton
            focusKey="download-btn-reset"
            onArrowPress={handleFilterArrow('download-btn-reset')}
            variant="secondary"
            size="auto"
            onClick={onReset}
            className={`${filterActionButtonClassName} !text-black`}
          >
            <RotateCcw className="mr-[0.375rem] size-[var(--filter-icon-size)] !text-black" />
            {t('download.actions.reset', { defaultValue: 'Reset' })}
          </OreButton>
        </div>
      </div>

      <div className={`${filterFieldClassName} col-span-1 grid grid-cols-2 gap-[var(--filter-col-gap)] md:col-span-2 md:grid-cols-4 lg:col-span-12 lg:grid-cols-12 lg:gap-x-[var(--filter-col-gap)]`}>
        <div className="lg:col-span-3">
          <OreDropdown
            focusKey="filter-mc-version"
            onArrowPress={handleFilterArrow('filter-mc-version')}
            searchable
            options={translatedMcVersionOptions}
            value={mcVersion || ''}
            onChange={setMcVersion}
            className={filterDropdownClassName}
            placeholder={t('download.filters.versionAll', { defaultValue: 'All Versions' })}
          />
        </div>

        <div className="lg:col-span-3">
          <OreDropdown
            focusKey="filter-loader"
            onArrowPress={handleFilterArrow('filter-loader')}
            options={loaderOptions}
            value={loaderType || ''}
            onChange={setLoaderType}
            className={filterDropdownClassName}
            placeholder={t('download.filters.loaderAll', { defaultValue: 'All' })}
          />
        </div>

        <div className="lg:col-span-3">
          <OreDropdown
            focusKey="filter-category"
            onArrowPress={handleFilterArrow('filter-category')}
            options={translatedCategoryOptions}
            value={category || ''}
            onChange={setCategory}
            className={filterDropdownClassName}
            placeholder={t('download.filters.categoryAll', { defaultValue: 'All Categories' })}
          />
        </div>

        <div className="lg:col-span-3">
          <OreDropdown
            focusKey="filter-sort"
            onArrowPress={handleFilterArrow('filter-sort')}
            options={sortOptions}
            value={sort || 'relevance'}
            onChange={setSort}
            className={filterDropdownClassName}
            placeholder={t('download.sort.relevance', { defaultValue: 'Relevance' })}
          />
        </div>
      </div>
    </div>
  );
};
