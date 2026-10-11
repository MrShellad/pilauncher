import React from 'react';
import { Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Collection } from '../../../types/library';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { getOreIcon } from '../../../ui/primitives/OreIconPicker';
import { CollectionTagManagerModal } from './CollectionTagManagerModal';
import {
  getReadableTextColor,
  getTagIconId,
  normalizeTagColor,
} from './collectionTagModel';

interface CollectionSidebarProps {
  collections: Collection[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
  onCreateCollection: (collection: Collection) => Promise<void>;
  onUpdateCollection: (collection: Collection) => Promise<void>;
  onRemoveCollection: (id: string) => Promise<void>;
  focusable?: boolean;
}

interface SectionHeaderProps {
  label: string;
  actionLabel?: string;
  onAction?: () => void;
  actionFocusKey?: string;
  focusable?: boolean;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  label,
  actionLabel,
  onAction,
  actionFocusKey,
  focusable = true,
}) => (
  <div className="mb-[1rem] mt-[0.5rem] flex w-full items-center justify-between px-[1rem] font-minecraft text-[length:var(--ore-typography-size-sm)] text-[var(--ore-color-text-muted-dim)]">
    <span className="uppercase tracking-[0.05em]">{label}</span>
    {onAction && (
      <FocusItem focusKey={actionFocusKey} onEnter={onAction} focusable={focusable}>
        {({ ref, focused }) => (
          <button
            ref={ref as React.RefObject<HTMLButtonElement>}
            type="button"
            onClick={onAction}
            tabIndex={-1}
            title={actionLabel}
            className={[
              'inline-flex h-[1.75rem] items-center gap-[0.375rem] rounded-[0.125rem] bg-[var(--ore-library-sidebar-actionBg)] px-[0.5rem] text-[length:var(--ore-typography-size-caption)] text-white',
              'shadow-[inset_0_0.0625rem_0_rgba(255,255,255,0.15),inset_0_-0.0625rem_0_rgba(0,0,0,0.4)] outline-none transition-none',
              'hover:outline hover:outline-[0.125rem] hover:-outline-offset-[0.125rem] hover:outline-white active:translate-y-[0.0625rem] active:shadow-none',
              focused ? 'outline outline-[0.125rem] -outline-offset-[0.125rem] outline-white' : '',
            ].join(' ')}
          >
            <Settings2 size={14} />
            <span>{actionLabel}</span>
          </button>
        )}
      </FocusItem>
    )}
  </div>
);

export const CollectionSidebar: React.FC<CollectionSidebarProps> = ({
  collections,
  selectedGroupId,
  onSelectGroup,
  onCreateCollection,
  onUpdateCollection,
  onRemoveCollection,
  focusable = true,
}) => {
  const { t } = useTranslation();
  const groups = collections
    .filter((collection) => collection.type === 'group')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const [isManagingTags, setIsManagingTags] = React.useState(false);

  return (
    <aside className="flex w-full flex-col overflow-y-auto bg-[var(--ore-library-sidebar-shellBg)] p-[1rem] text-white">
      <div>
        <SectionHeader
          label={t('libraryPage.sidebar.tagSystem')}
          actionLabel={t('libraryPage.sidebar.manageTags')}
          actionFocusKey="library-tags-manage"
          onAction={() => setIsManagingTags(true)}
          focusable={focusable}
        />

        {groups.length === 0 ? (
          <div className="px-[1rem] py-[0.5rem] font-minecraft text-[length:var(--ore-typography-size-sm)] italic text-[var(--ore-color-border-neutral-subtle)]">
            {t('libraryPage.sidebar.noTags')}
          </div>
        ) : (
          <div className="flex flex-wrap gap-[0.5rem] px-[1rem] py-[0.5rem]">
            {groups.map((collection) => {
              const active = selectedGroupId === collection.id;
              const tagColor = normalizeTagColor(collection.coverImage);
              const SidebarTagIcon = getOreIcon(getTagIconId(collection.description));
              return (
                <FocusItem
                  key={collection.id}
                  focusKey={`library-tag-${collection.id}`}
                  onEnter={() => onSelectGroup(collection.id)}
                  focusable={focusable}
                >
                  {({ ref, focused }) => (
                    <button
                      ref={ref as React.RefObject<HTMLButtonElement>}
                      type="button"
                      tabIndex={-1}
                      onClick={() => onSelectGroup(collection.id)}
                      className={[
                        'inline-flex h-[1.75rem] max-w-full items-center rounded-[0.125rem] border-[0.125rem] border-[var(--ore-color-border-primary-default)] px-[0.5rem] font-minecraft text-[length:var(--ore-typography-size-xs)] outline-none transition-none',
                        'active:translate-y-[0.0625rem] active:shadow-none hover:outline hover:outline-[0.125rem] hover:-outline-offset-[0.125rem] hover:outline-white',
                        focused ? 'outline outline-[0.125rem] -outline-offset-[0.125rem] outline-white' : '',
                        active
                          ? 'shadow-[inset_0_-0.1875rem_0_rgba(0,0,0,0.28),inset_0.125rem_0.125rem_0_rgba(255,255,255,0.24)]'
                          : 'shadow-[inset_0_-0.125rem_0_rgba(0,0,0,0.24),inset_0.125rem_0.125rem_0_rgba(255,255,255,0.16)]',
                      ].join(' ')}
                      style={{
                        backgroundColor: tagColor,
                        color: getReadableTextColor(tagColor),
                      }}
                    >
                      <SidebarTagIcon className="mr-[0.375rem] h-[0.875rem] w-[0.875rem] shrink-0" strokeWidth={2.5} />
                      <span className="truncate">{collection.name}</span>
                    </button>
                  )}
                </FocusItem>
              );
            })}
          </div>
        )}
      </div>

      <CollectionTagManagerModal
        isOpen={isManagingTags}
        groups={groups}
        selectedGroupId={selectedGroupId}
        onClose={() => setIsManagingTags(false)}
        onSelectGroup={onSelectGroup}
        onCreateCollection={onCreateCollection}
        onUpdateCollection={onUpdateCollection}
        onRemoveCollection={onRemoveCollection}
      />
    </aside>
  );
};
