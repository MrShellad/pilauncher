import React from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import type { LibraryResourceViewModel } from '../../logic/libraryItems';

interface DeleteModSetModalProps {
  isOpen: boolean;
  collectionName: string;
  isDeleting: boolean;
  removeFavoritesWithModSet: boolean;
  selectedItemIds: Set<string>;
  resources: LibraryResourceViewModel[];
  onClose: () => void;
  onConfirm: () => void;
  onToggleRemoveFavorites: () => void;
  onToggleItem: (itemId: string) => void;
  onSelectAll: () => void;
  onInvert: () => void;
}

export const DeleteModSetModal: React.FC<DeleteModSetModalProps> = ({
  isOpen,
  collectionName,
  isDeleting,
  removeFavoritesWithModSet,
  selectedItemIds,
  resources,
  onClose,
  onConfirm,
  onToggleRemoveFavorites,
  onToggleItem,
  onSelectAll,
  onInvert,
}) => {
  const { t } = useTranslation();

  return (
  <OreModal
    isOpen={isOpen}
    onClose={onClose}
    title={t('libraryPage.deleteModSet.title')}
    defaultFocusKey="modset-delete-remove-favorites-toggle"
    className="w-[32rem] max-w-[calc(100vw-2rem)]"
    actionsClassName="!justify-center"
    actions={(
      <>
        <OreButton
          variant="secondary"
          disabled={isDeleting}
          onClick={onClose}
        >
          {t('common.cancel')}
        </OreButton>
        <OreButton
          focusKey="modset-delete-confirm"
          variant="danger"
          disabled={isDeleting}
          onClick={onConfirm}
        >
          {isDeleting ? t('libraryPage.deleteModSet.deleting') : t('libraryPage.deleteModSet.confirm')}
        </OreButton>
      </>
    )}
  >
    <div className="grid gap-4">
      <div className="border-2 border-[var(--ore-color-border-danger-default)] bg-[var(--ore-color-background-danger-subtle)] p-4 text-sm leading-6 text-[var(--ore-color-text-danger-default)]">
        {t('libraryPage.deleteModSet.desc', { name: collectionName })}
      </div>

      <FocusItem
        focusKey="modset-delete-remove-favorites-toggle"
        disabled={isDeleting}
        onEnter={onToggleRemoveFavorites}
      >
        {({ ref, focused }) => (
          <button
            ref={ref as React.RefObject<HTMLButtonElement>}
            type="button"
            tabIndex={-1}
            disabled={isDeleting}
            onClick={onToggleRemoveFavorites}
            className={[
              'flex items-start gap-3 border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] p-3 text-left outline-none transition-none hover:border-white disabled:cursor-not-allowed disabled:opacity-70',
              focused ? 'ring-2 ring-white/80' : '',
            ].join(' ')}
          >
            <span
              className={[
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-2',
                removeFavoritesWithModSet
                  ? 'border-[var(--ore-color-border-success-active)] bg-[var(--ore-color-background-success-default)] text-[var(--ore-color-text-onLight-soft)]'
                  : 'border-[var(--ore-color-border-neutral-muted)] bg-[var(--ore-color-background-surface-raised)] text-transparent',
              ].join(' ')}
            >
              <Check size={14} strokeWidth={3} />
            </span>
            <span className="grid gap-1">
              <span className="text-sm text-white">{t('libraryPage.deleteModSet.removeMods')}</span>
              <span className="text-xs leading-5 text-[var(--ore-color-text-muted-soft)]">
                {t('libraryPage.deleteModSet.removeDesc')}
              </span>
            </span>
          </button>
        )}
      </FocusItem>

      <div className="grid gap-3 border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-base)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-[var(--ore-color-text-secondary-soft)]">
            {t('libraryPage.deleteModSet.selected', { selected: selectedItemIds.size, total: resources.length })}
          </div>
          <div className="flex items-center gap-2">
            <FocusItem
              focusKey="modset-delete-select-all"
              disabled={!removeFavoritesWithModSet || isDeleting || resources.length === 0}
              onEnter={onSelectAll}
            >
              {({ ref, focused }) => (
                <button
                  ref={ref as React.RefObject<HTMLButtonElement>}
                  type="button"
                  tabIndex={-1}
                  disabled={!removeFavoritesWithModSet || isDeleting || resources.length === 0}
                  onClick={onSelectAll}
                  className={[
                    'h-8 border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-raised)] px-3 text-xs text-white hover:border-white disabled:cursor-not-allowed disabled:opacity-50',
                    focused ? 'ring-2 ring-white/80' : '',
                  ].join(' ')}
                >
                  {t('libraryPage.deleteModSet.selectAll')}
                </button>
              )}
            </FocusItem>
            <FocusItem
              focusKey="modset-delete-invert"
              disabled={!removeFavoritesWithModSet || isDeleting || resources.length === 0}
              onEnter={onInvert}
            >
              {({ ref, focused }) => (
                <button
                  ref={ref as React.RefObject<HTMLButtonElement>}
                  type="button"
                  tabIndex={-1}
                  disabled={!removeFavoritesWithModSet || isDeleting || resources.length === 0}
                  onClick={onInvert}
                  className={[
                    'h-8 border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-raised)] px-3 text-xs text-white hover:border-white disabled:cursor-not-allowed disabled:opacity-50',
                    focused ? 'ring-2 ring-white/80' : '',
                  ].join(' ')}
                >
                  {t('libraryPage.deleteModSet.invert')}
                </button>
              )}
            </FocusItem>
          </div>
        </div>

        {resources.length === 0 ? (
          <div className="border-2 border-dashed border-[var(--ore-color-border-neutral-muted)] bg-[var(--ore-color-background-surface-panel)] px-4 py-6 text-center text-sm text-[var(--ore-color-text-muted-dim)]">
            {t('libraryPage.deleteModSet.empty')}
          </div>
        ) : (
          <div className="grid max-h-[16rem] gap-2 overflow-y-auto pr-1 custom-scrollbar">
            {resources.map((item) => {
              const checked = selectedItemIds.has(item.id);
              return (
                <FocusItem
                  key={item.id}
                  focusKey={`modset-delete-item-${item.id}`}
                  disabled={!removeFavoritesWithModSet || isDeleting}
                  onEnter={() => onToggleItem(item.id)}
                >
                  {({ ref, focused }) => (
                    <button
                      ref={ref as React.RefObject<HTMLButtonElement>}
                      type="button"
                      tabIndex={-1}
                      disabled={!removeFavoritesWithModSet || isDeleting}
                      onClick={() => onToggleItem(item.id)}
                      className={[
                        'flex items-center gap-3 border-2 px-3 py-2 text-left outline-none transition-none disabled:cursor-not-allowed disabled:opacity-60',
                        checked
                          ? 'border-[var(--ore-color-border-success-active)] bg-[var(--ore-color-background-success-muted)]'
                          : 'border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] hover:border-white',
                        focused ? 'ring-2 ring-white/80' : '',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'flex h-5 w-5 shrink-0 items-center justify-center border-2',
                          checked
                            ? 'border-[var(--ore-color-border-success-active)] bg-[var(--ore-color-background-success-default)] text-[var(--ore-color-text-onLight-soft)]'
                            : 'border-[var(--ore-color-border-neutral-muted)] bg-[var(--ore-color-background-surface-raised)] text-transparent',
                        ].join(' ')}
                      >
                        <Check size={14} strokeWidth={3} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-white">{item.title}</span>
                        <span className="block truncate text-xs text-[var(--ore-color-text-muted-soft)]">
                          {item.author || item.source}
                        </span>
                      </span>
                    </button>
                  )}
                </FocusItem>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </OreModal>
  );
};
