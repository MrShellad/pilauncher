import React from 'react';
import { useTranslation } from 'react-i18next';

import type { Collection } from '../../../../types/library';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import type { LibraryResourceViewModel } from '../../logic/libraryItems';
import { getRelationPendingKey } from '../../logic/libraryPageUtils';

interface LibraryTagModalProps {
  item: LibraryResourceViewModel | null;
  tags: Collection[];
  activeTagIds: Set<string>;
  pendingRelationKeys: Set<string>;
  relationError: string;
  hasPendingRelation: boolean;
  onClose: () => void;
  onToggleTag: (tagId: string) => void;
}

export const LibraryTagModal: React.FC<LibraryTagModalProps> = ({
  item,
  tags,
  activeTagIds,
  pendingRelationKeys,
  relationError,
  hasPendingRelation,
  onClose,
  onToggleTag,
}) => {
  const { t } = useTranslation();

  return (
  <OreModal
    isOpen={!!item}
    onClose={onClose}
    title={t('libraryPage.tagModal.title')}
    defaultFocusKey={tags[0] ? `library-tag-modal-${tags[0].id}` : undefined}
    className="w-[30rem] max-w-[calc(100vw-2rem)]"
    actionsClassName="!justify-center"
    actions={(
      <OreButton variant="secondary" disabled={hasPendingRelation} onClick={onClose}>
        {t('libraryPage.tagModal.done')}
      </OreButton>
    )}
  >
    <div className="grid gap-3">
      <div className="border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] px-3 py-2">
        <div className="truncate font-minecraft text-sm text-white">{item?.title}</div>
        <div className="mt-1 text-xs text-[var(--ore-color-text-muted-soft)]">{t('libraryPage.tagModal.hint')}</div>
      </div>

      {relationError && (
        <div className="border-2 border-[var(--ore-color-border-danger-subtle)] bg-[var(--ore-color-background-danger-muted)] px-3 py-2 text-sm text-[var(--ore-color-text-danger-soft)]">
          {relationError}
        </div>
      )}

      {tags.length === 0 ? (
        <div className="border-2 border-dashed border-[var(--ore-color-border-neutral-muted)] bg-[var(--ore-color-background-surface-base)] px-4 py-8 text-center text-sm text-[var(--ore-color-text-muted-dim)]">
          {t('libraryPage.tagModal.empty')}
        </div>
      ) : (
        <div className="grid max-h-[18rem] gap-2 overflow-y-auto pr-1 custom-scrollbar">
          {tags.map((tag) => {
            const active = activeTagIds.has(tag.id);
            const pending = Boolean(
              item && pendingRelationKeys.has(getRelationPendingKey(tag.id, item.id)),
            );
            return (
              <FocusItem
                key={tag.id}
                focusKey={`library-tag-modal-${tag.id}`}
                disabled={pending}
                onEnter={() => onToggleTag(tag.id)}
              >
                {({ ref, focused }) => (
                  <button
                    ref={ref as React.RefObject<HTMLButtonElement>}
                    type="button"
                    tabIndex={-1}
                    disabled={pending}
                    onClick={() => onToggleTag(tag.id)}
                    className={[
                      'flex h-10 items-center justify-between border-2 px-3 font-minecraft text-sm outline-none transition-none disabled:cursor-wait disabled:opacity-70',
                      active
                        ? 'border-[var(--ore-color-border-success-active)] bg-[var(--ore-color-background-success-default)] text-[var(--ore-color-text-onLight-soft)] shadow-[inset_0_-2px_0_var(--ore-color-background-primary-default)]'
                        : 'border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-raised)] text-white hover:border-white',
                      focused ? 'ring-2 ring-white/80' : '',
                    ].join(' ')}
                  >
                    <span className="truncate">{tag.name}</span>
                    <span className="ml-3 shrink-0 text-xs">
                      {pending ? t('libraryPage.tagModal.pending') : active ? t('libraryPage.tagModal.added') : t('libraryPage.tagModal.add')}
                    </span>
                  </button>
                )}
              </FocusItem>
            );
          })}
        </div>
      )}
    </div>
  </OreModal>
  );
};
