import React from 'react';
import { ArchiveX, Loader2, SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { OreButton } from '../../../ui/primitives/OreButton';
import type { LibraryEntryAction } from '../data/libraryPageData';

interface LibraryEmptyStateProps {
  isLoading: boolean;
  hasQuery: boolean;
  actions: LibraryEntryAction[];
  onAction: (id: string) => void;
}

export const LibraryEmptyState: React.FC<LibraryEmptyStateProps> = ({
  isLoading,
  hasQuery,
  actions,
  onAction,
}) => {
  const { t } = useTranslation();
  const Icon = isLoading ? Loader2 : hasQuery ? SearchX : ArchiveX;

  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center border-2 border-dashed border-[var(--ore-color-border-neutral-subtle)] bg-black/20 px-6 py-12 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-default)] shadow-[inset_2px_2px_0_rgba(255,255,255,0.12),inset_0_-4px_0_rgba(0,0,0,0.25)]">
        <Icon
          size={34}
          className={isLoading ? 'animate-spin text-[var(--ore-color-text-success-default)]' : 'text-[var(--ore-color-text-secondary-default)]'}
        />
      </div>

      <h2 className="font-minecraft text-2xl text-white ore-text-shadow">
        {isLoading ? t('libraryPage.empty.loadingTitle') : hasQuery ? t('libraryPage.empty.noMatchTitle') : t('libraryPage.empty.emptyTitle')}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ore-color-text-muted-strong)]">
        {isLoading
          ? t('libraryPage.empty.loadingDesc')
          : hasQuery
            ? t('libraryPage.empty.noMatchDesc')
            : t('libraryPage.empty.emptyDesc')}
      </p>

      {!isLoading && !hasQuery && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {actions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <OreButton
                key={action.id}
                variant={action.tone}
                size="auto"
                onClick={() => onAction(action.id)}
                className="!min-w-0 !px-0"
                title={t(action.description)}
              >
                <span className="flex h-full min-w-[9.5rem] items-center justify-center gap-2 px-3 text-sm">
                  <ActionIcon size={16} />
                  {t(action.label)}
                </span>
              </OreButton>
            );
          })}
        </div>
      )}
    </div>
  );
};
