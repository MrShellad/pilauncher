import React, { useMemo } from 'react';
import { ArrowLeft, Cloud, Download, ListFilter, Pencil, Plus, Search, Target, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { OreButton } from '../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../ui/primitives/OreDropdown';
import { OreInput } from '../../../ui/primitives/OreInput';
import type { LibraryFilterId, LibraryFilterOption, LibrarySortId } from '../data/libraryPageData';
import { getLibrarySortOptions } from '../data/libraryPageData';
import type { LibraryResourceViewModel } from '../logic/libraryItems';

interface LibraryToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterOptions: LibraryFilterOption[];
  activeFilter: LibraryFilterId;
  onFilterChange: (filter: LibraryFilterId) => void;
  sortBy: LibrarySortId;
  onSortChange: (sortBy: LibrarySortId) => void;
  visibleCount: number;
  selectedCollectionName?: string;
  highlightedItems: LibraryResourceViewModel[];
  onBack?: () => void;
  showDeployAction?: boolean;
  deployDisabled?: boolean;
  trackerCount?: number;
  readyTrackerCount?: number;
  onOpenModSetDeploy?: () => void;
  showCollectionEditAction?: boolean;
  collectionEditLabel?: string;
  onEditCollectionMetadata?: () => void;
  showBackupActions?: boolean;
  backupActionDisabled?: boolean;
  onOpenBackupActions?: () => void;
  showModSetManageActions?: boolean;
  onDeleteModSet?: () => void;
  showAddResource?: boolean;
  onAddResource?: () => void;
}

export const LibraryToolbar: React.FC<LibraryToolbarProps> = ({
  searchQuery,
  onSearchChange,
  filterOptions,
  activeFilter,
  onFilterChange,
  sortBy,
  onSortChange,
  visibleCount,
  selectedCollectionName,
  highlightedItems,
  onBack,
  showDeployAction = false,
  deployDisabled = false,
  trackerCount = 0,
  readyTrackerCount = 0,
  onOpenModSetDeploy,
  showCollectionEditAction = false,
  collectionEditLabel,
  onEditCollectionMetadata,
  showBackupActions = false,
  backupActionDisabled = false,
  onOpenBackupActions,
  showModSetManageActions = false,
  onDeleteModSet,
  showAddResource = false,
  onAddResource,
}) => {
  const { t } = useTranslation();
  const hasHighlightedItems = highlightedItems.length > 0;
  const sortOptions = useMemo(() => getLibrarySortOptions(t), [t]);
  const topRowGridTemplate = useMemo(() => {
    const cols: string[] = [];
    if (onBack) cols.push('auto');            // back button
    cols.push('minmax(0,1fr)');                // info panel (flexible)
    if (showCollectionEditAction) cols.push('auto'); // edit
    if (showBackupActions) cols.push('auto');        // import/export
    if (showAddResource) cols.push('auto');          // add resource (right of sync)
    if (showModSetManageActions) cols.push('auto');  // delete
    if (showDeployAction) cols.push('11rem');   // deploy (aligned with sort dropdown)
    return cols.join(' ');
  }, [onBack, showCollectionEditAction, showBackupActions, showAddResource, showModSetManageActions, showDeployAction]);


  return (
    <div className="shrink-0 border-b-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] px-5 py-4 shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.08)]">
      {/* ── Top row ── */}
      <div
        className="grid items-stretch gap-3"
        style={{ gridTemplateColumns: topRowGridTemplate }}
      >
        {onBack && (
          <OreButton focusKey="library-toolbar-back" variant="secondary" onClick={onBack} className="!h-full w-full !px-2 !m-0">
            <span className="flex items-center justify-center gap-2 whitespace-nowrap font-minecraft text-sm">
              <ArrowLeft size={16} />
              {t('libraryPage.toolbar.back')}
            </span>
          </OreButton>
        )}

        {/* Info panel */}
        <div className="min-w-0 border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-raised)] px-3 py-2 shadow-[inset_0_-0.1875rem_0_rgba(0,0,0,0.22)]">
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <Target size={16} className="shrink-0 text-[var(--ore-color-text-success-default)]" />
            <span className="truncate font-minecraft text-sm leading-5 text-white">
              {selectedCollectionName ?? t('libraryPage.views.all')}
            </span>
            <span className="shrink-0 border-l-2 border-[var(--ore-color-border-primary-default)] pl-2 text-xs leading-5 text-[var(--ore-color-text-muted-default)]">
              {t('libraryPage.toolbar.visibleCount', { count: visibleCount })}
            </span>
          </div>
          {hasHighlightedItems && (
            <div className="mt-1 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-[length:var(--ore-typography-size-caption)] text-[var(--ore-color-text-muted-default)]">
              <span className="shrink-0 text-[var(--ore-color-text-success-default)]">{t('libraryPage.toolbar.highlights')}</span>
              <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                {highlightedItems.slice(0, 3).map((item) => (
                  <span
                    key={item.id}
                    className="min-w-0 truncate border border-[var(--ore-color-background-surface-default)] bg-black/20 px-1.5 py-0.5 text-[var(--ore-color-text-secondary-default)]"
                  >
                    {item.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Edit button */}
        {showCollectionEditAction && (
          <OreButton
            focusKey="library-toolbar-edit"
            variant="secondary"
            onClick={onEditCollectionMetadata}
            className="!h-full aspect-square !min-w-0 !px-0 !m-0"
            title={collectionEditLabel ?? t('libraryPage.toolbar.editCollection')}
          >
            <span className="flex items-center justify-center">
              <Pencil size={18} />
            </span>
          </OreButton>
        )}

        {/* Library cloud sync / backup */}
        {showBackupActions && (
          <OreButton
            focusKey="library-toolbar-backup"
            variant="secondary"
            onClick={onOpenBackupActions}
            disabled={backupActionDisabled}
            className="!h-full aspect-square !min-w-0 !px-0 !m-0"
            title={t('libraryPage.toolbar.cloudSync')}
          >
            <span className="flex items-center justify-center">
              <Cloud size={18} />
            </span>
          </OreButton>
        )}

        {/* Add local resource (on the right of sync button) */}
        {showAddResource && (
          <OreButton
            focusKey="library-toolbar-add-resource"
            variant="primary"
            onClick={onAddResource}
            className="!h-full aspect-square !min-w-0 !px-0 !m-0"
            title="本地导入收藏"
          >
            <span className="flex items-center justify-center">
              <Plus size={18} />
            </span>
          </OreButton>
        )}

        {/* Delete button with confirmation */}
        {showModSetManageActions && (
          <OreButton
            focusKey="library-toolbar-delete-modset"
            variant="secondary"
            onClick={onDeleteModSet}
            className="!h-full aspect-square !min-w-0 !px-0 !m-0"
            title={t('libraryPage.toolbar.deleteModSet')}
          >
            <span className="flex items-center justify-center">
              <Trash2 size={18} />
            </span>
          </OreButton>
        )}

        {/* Deploy button — rightmost, fixed 11rem to align with sort dropdown */}
        {showDeployAction && (
          <OreButton
            focusKey="library-toolbar-deploy"
            variant="primary"
            onClick={onOpenModSetDeploy}
            disabled={deployDisabled}
            className="!h-full w-full !min-w-0 !px-2 !m-0"
            title={deployDisabled ? t('libraryPage.toolbar.deployDisabled') : t('libraryPage.toolbar.deployTitle')}
          >
            <span className="flex items-center justify-center gap-2 whitespace-nowrap font-minecraft text-sm">
              <Download size={16} />
              {t('libraryPage.toolbar.deploy')}
              <span className="border-l-2 border-[var(--ore-color-border-success-active)]/60 pl-2 text-[length:var(--ore-typography-size-caption)] font-normal tracking-normal">
                {readyTrackerCount}/{trackerCount}
              </span>
            </span>
          </OreButton>
        )}
      </div>

      {/* ── Bottom row: Search | Sort ── */}
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_11rem]">
        <div className="min-w-0">
          <OreInput
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('libraryPage.toolbar.searchPlaceholder')}
            prefixNode={<Search size={16} />}
            height="40px"
            focusKey="library-search"
            className="!text-sm"
          />
        </div>

        <div className="min-w-0">
          <OreDropdown
            options={sortOptions}
            value={sortBy}
            onChange={(value) => onSortChange(value as LibrarySortId)}
            prefixNode={<ListFilter size={14} />}
            focusKey="library-sort"
          />
        </div>

        {filterOptions.length > 0 && (
          <div className="flex min-h-10 min-w-0 flex-wrap items-stretch overflow-hidden border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-raised)] md:col-span-2">
            {filterOptions.map((option) => {
              const isActive = option.id === activeFilter;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onFilterChange(option.id)}
                  className={[
                    'h-9 shrink-0 border-r-2 border-[var(--ore-color-border-primary-default)] px-3 font-minecraft text-xs transition-none last:border-r-0',
                    isActive
                      ? 'bg-[var(--ore-color-background-success-default)] text-[var(--ore-color-text-onLight-soft)] shadow-[inset_0_-0.1875rem_0_var(--ore-color-background-primary-default)]'
                      : 'text-[var(--ore-color-text-muted-default)] hover:bg-[var(--ore-color-background-surface-default)] hover:text-white',
                  ].join(' ')}
                >
                  {t(option.label)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
