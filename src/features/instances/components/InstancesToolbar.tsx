import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Filter,
  FolderPlus,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  Tags,
} from 'lucide-react';

import type { ScreenDensity } from '@/hooks/ui/useScreenDensity';
import { FocusItem } from '@/ui/focus/FocusItem';
import { OreButton } from '@/ui/primitives/OreButton';
import { OreDropdown } from '@/ui/primitives/OreDropdown';
import { OreInput } from '@/ui/primitives/OreInput';
import type { SortType } from '../hooks/useInstances';

interface InstancesToolbarProps {
  density: ScreenDensity;
  viewMode: 'list' | 'grid';
  searchQuery: string;
  sortBy: SortType;
  selectedTagCount: number;
  isDetectingSources: boolean;
  isImporting: boolean;
  onToggleView: () => void;
  onSearchChange: (value: string) => void;
  onSortChange: (sort: SortType) => void;
  onOpenTags: () => void;
  onCreate: () => void;
  onOpenImport: () => void;
}

export const InstancesToolbar: React.FC<InstancesToolbarProps> = ({
  density,
  viewMode,
  searchQuery,
  sortBy,
  selectedTagCount,
  isDetectingSources,
  isImporting,
  onToggleView,
  onSearchChange,
  onSortChange,
  onOpenTags,
  onCreate,
  onOpenImport,
}) => {
  const { t } = useTranslation();

  if (density === 'compact') {
    return (
      <div className="mb-3 flex w-full flex-col gap-2">
        <div className="w-full">
          <OreInput
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('instancesPage.searchPlaceholder', '搜索实例...')}
            prefixNode={<Search size={15} />}
            focusKey="instances-search"
            height="36px"
            className="!text-xs"
          />
        </div>

        <div className="flex w-full flex-wrap items-center gap-2">
          <FocusItem focusKey="view-toggle" onEnter={onToggleView}>
            {({ ref, focused }) => (
              <button
                ref={ref}
                onClick={onToggleView}
                className={`flex h-9 w-9 items-center justify-center rounded-sm border-2 border-ore-gray-border bg-[#1E1E1F] transition-colors hover:bg-white/10 focus:outline-none ${focused ? 'z-10 outline outline-2 outline-white' : ''}`}
                title={
                  viewMode === 'grid'
                    ? t('instancesPage.viewToggleList', '切换为列表视图')
                    : t('instancesPage.viewToggleGrid', '切换为网格视图')
                }
                tabIndex={-1}
              >
                {viewMode === 'grid' ? (
                  <List size={15} className="text-white" />
                ) : (
                  <LayoutGrid size={15} className="text-white" />
                )}
              </button>
            )}
          </FocusItem>

          <div className="w-[110px] flex-shrink-0">
            <OreDropdown
              options={[
                {
                  label: t('instancesPage.sortOptions.lastPlayed', '最近游玩'),
                  value: 'lastPlayed',
                },
                {
                  label: t('instancesPage.sortOptions.createdAt', '创建时间'),
                  value: 'createdAt',
                },
              ]}
              value={sortBy}
              onChange={(value) => onSortChange(value as SortType)}
              focusKey="instances-sort"
              className="!h-9"
              prefixNode={<Filter size={12} />}
            />
          </div>

          <FocusItem focusKey="instances-tags" onEnter={onOpenTags}>
            {({ ref, focused }) => (
              <div
                ref={ref}
                className={`flex-shrink-0 transition-all ${focused ? 'z-10 rounded-sm outline outline-2 outline-white' : ''}`}
              >
                <OreButton
                  variant="secondary"
                  size="auto"
                  className="relative !m-0 !h-9 !min-w-0 px-2"
                  onClick={onOpenTags}
                  tabIndex={-1}
                >
                  <Tags size={12} className="mr-1 flex-shrink-0" />
                  <span className="font-minecraft text-xs">
                    {t('instancesPage.tagsBtn', '标签')}
                  </span>
                  {selectedTagCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ore-green text-[8px] font-bold text-white">
                      {selectedTagCount}
                    </span>
                  )}
                </OreButton>
              </div>
            )}
          </FocusItem>

          <div className="flex-1" />

          <FocusItem focusKey="action-new" onEnter={onCreate}>
            {({ ref, focused }) => (
              <div
                ref={ref}
                className={`flex-shrink-0 rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-2 outline-white' : ''}`}
              >
                <OreButton
                  variant="primary"
                  size="auto"
                  className="!m-0 !h-9 !min-w-0 !px-3"
                  onClick={onCreate}
                  tabIndex={-1}
                >
                  <Plus size={12} className="mr-1 flex-shrink-0" />
                  <span className="font-minecraft text-xs">
                    {t('instancesPage.actionNew', '新建')}
                  </span>
                </OreButton>
              </div>
            )}
          </FocusItem>

          <FocusItem focusKey="action-import-external" onEnter={onOpenImport}>
            {({ ref, focused }) => (
              <div
                ref={ref}
                className={`flex-shrink-0 rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-2 outline-white' : ''}`}
              >
                <OreButton
                  variant="secondary"
                  size="auto"
                  className="!m-0 !h-9 !min-w-0 !px-3"
                  onClick={onOpenImport}
                  disabled={isDetectingSources || isImporting}
                  tabIndex={-1}
                >
                  {isDetectingSources ? (
                    <Loader2 size={12} className="mr-1 animate-spin" />
                  ) : (
                    <FolderPlus size={12} className="mr-1" />
                  )}
                  <span className="font-minecraft text-xs">
                    {t('instancesPage.actionImportExternal', '导入')}
                  </span>
                </OreButton>
              </div>
            )}
          </FocusItem>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 flex w-full flex-wrap items-center justify-between gap-4 lg:mb-5">
      <div className="flex flex-row flex-wrap items-center gap-3 sm:flex-nowrap">
        <FocusItem focusKey="view-toggle" onEnter={onToggleView}>
          {({ ref, focused }) => (
            <button
              ref={ref}
              onClick={onToggleView}
              className={`flex h-[40px] w-[40px] items-center justify-center rounded-sm border-2 border-ore-gray-border bg-[#1E1E1F] transition-colors hover:bg-white/10 focus:outline-none ${focused ? 'z-10 outline outline-[3px] outline-offset-[2px] outline-white' : ''}`}
              title={
                viewMode === 'grid'
                  ? t('instancesPage.viewToggleList', '切换为列表视图')
                  : t('instancesPage.viewToggleGrid', '切换为网格视图')
              }
              tabIndex={-1}
            >
              {viewMode === 'grid' ? (
                <List size={18} className="text-white" />
              ) : (
                <LayoutGrid size={18} className="text-white" />
              )}
            </button>
          )}
        </FocusItem>

        <div className="min-w-[140px] max-w-[220px] flex-1">
          <OreInput
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('instancesPage.searchPlaceholder', '搜索实例...')}
            prefixNode={<Search size={16} />}
            focusKey="instances-search"
            height="40px"
            className="!text-sm"
          />
        </div>

        <div className="w-[180px] flex-shrink-0">
          <OreDropdown
            options={[
              {
                label: t('instancesPage.sortOptions.lastPlayed', '最近游玩'),
                value: 'lastPlayed',
              },
              {
                label: t('instancesPage.sortOptions.createdAt', '创建时间'),
                value: 'createdAt',
              },
            ]}
            value={sortBy}
            onChange={(value) => onSortChange(value as SortType)}
            focusKey="instances-sort"
            className="!h-[40px]"
            prefixNode={<Filter size={14} />}
          />
        </div>

        <FocusItem focusKey="instances-tags" onEnter={onOpenTags}>
          {({ ref, focused }) => (
            <div
              ref={ref}
              className={`flex-shrink-0 transition-all ${focused ? 'z-10 rounded-sm outline outline-2 outline-white' : ''}`}
            >
              <OreButton
                variant="secondary"
                size="auto"
                className="relative !m-0 !h-[40px] !min-w-0 px-4"
                onClick={onOpenTags}
                tabIndex={-1}
              >
                <Tags size={14} className="mr-1.5 flex-shrink-0" />
                <span className="font-minecraft text-sm">
                  {t('instancesPage.tagsBtn', '标签')}
                </span>
                {selectedTagCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ore-green text-[10px] font-bold text-white">
                    {selectedTagCount}
                  </span>
                )}
              </OreButton>
            </div>
          )}
        </FocusItem>
      </div>

      <div className="-m-2 flex flex-row flex-wrap items-center gap-3 p-2 sm:flex-nowrap">
        <FocusItem focusKey="action-new" onEnter={onCreate}>
          {({ ref, focused }) => (
            <div
              ref={ref}
              className={`flex-shrink-0 rounded-sm outline outline-2 outline-offset-[4px] transition-shadow duration-150 ${focused ? 'outline-white' : 'outline-transparent'}`}
            >
              <OreButton
                variant="primary"
                size="auto"
                className="!m-0 !h-[40px] !min-w-0 !px-0"
                onClick={onCreate}
                tabIndex={-1}
              >
                <span className="flex h-full min-w-[clamp(9.2rem,14.2vw,15.4rem)] items-center justify-center whitespace-nowrap px-3">
                  <Plus className="mr-[clamp(0.35rem,0.6vw,0.6rem)] h-[clamp(0.9rem,1.1vw,1.25rem)] w-[clamp(0.9rem,1.1vw,1.25rem)] flex-shrink-0" />
                  <span className="font-minecraft text-[clamp(0.9rem,0.84rem+0.4vw,1.15rem)] tracking-wider">
                    {t('instancesPage.actionNew', '新建实例')}
                  </span>
                </span>
              </OreButton>
            </div>
          )}
        </FocusItem>

        <FocusItem focusKey="action-import-external" onEnter={onOpenImport}>
          {({ ref, focused }) => (
            <div
              ref={ref}
              className={`flex-shrink-0 rounded-sm outline outline-2 outline-offset-[4px] transition-shadow duration-150 ${focused ? 'outline-white' : 'outline-transparent'}`}
            >
              <OreButton
                variant="secondary"
                size="auto"
                className="!m-0 !h-[40px] !min-w-0 !px-0"
                onClick={onOpenImport}
                disabled={isDetectingSources || isImporting}
                tabIndex={-1}
              >
                <span className="flex h-full min-w-[clamp(10.8rem,18vw,18rem)] items-center justify-center whitespace-nowrap px-3">
                  {isDetectingSources ? (
                    <Loader2 className="mr-[clamp(0.35rem,0.6vw,0.6rem)] h-[clamp(0.9rem,1.1vw,1.25rem)] w-[clamp(0.9rem,1.1vw,1.25rem)] flex-shrink-0 animate-spin" />
                  ) : (
                    <FolderPlus className="mr-[clamp(0.35rem,0.6vw,0.6rem)] h-[clamp(0.9rem,1.1vw,1.25rem)] w-[clamp(0.9rem,1.1vw,1.25rem)] flex-shrink-0" />
                  )}
                  <span className="font-minecraft text-[clamp(0.9rem,0.84rem+0.4vw,1.15rem)] tracking-wider">
                    {t('instancesPage.actionImportExternal', '导入外部实例')}
                  </span>
                </span>
              </OreButton>
            </div>
          )}
        </FocusItem>
      </div>
    </div>
  );
};
