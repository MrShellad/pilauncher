import React from 'react';
import {
  Check,
  Pencil,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Collection } from '../../../types/library';
import {
  getOreIcon,
  normalizeOreIconId,
  ORE_DEFAULT_ICON_ID,
  OreIconPicker,
} from '../../../ui/primitives/OreIconPicker';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreModal } from '../../../ui/primitives/OreModal';
import { useLibraryStore } from '../../../stores/useLibraryStore';
import { FocusItem } from '../../../ui/focus/FocusItem';

interface CollectionSidebarProps {
  collections: Collection[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
  onCreateCollection: (collection: Collection) => Promise<void>;
  onUpdateCollection: (collection: Collection) => Promise<void>;
  onRemoveCollection: (id: string) => Promise<void>;
}

interface SectionHeaderProps {
  label: string;
  actionLabel?: string;
  onAction?: () => void;
  actionFocusKey?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ label, actionLabel, onAction, actionFocusKey }) => (
  <div className="mb-[1rem] mt-[0.5rem] flex w-full items-center justify-between px-[1rem] font-minecraft text-[length:var(--ore-typography-size-sm)] text-[var(--ore-color-text-muted-dim)]">
    <span className="uppercase tracking-[0.05em]">{label}</span>
    {onAction && (
      <FocusItem focusKey={actionFocusKey} onEnter={onAction}>
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

const createGroupId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const DEFAULT_TAG_COLOR = '#90A6D6';
const TAG_COLOR_OPTIONS = [
  '#90A6D6',
  '#6CC349',
  '#E0A33A',
  '#D84A4A',
  '#A783E6',
  '#43B7B8',
  '#D872B4',
  '#B8B07A',
];

const TAG_ICON_PREFIX = 'tagIcon:';

const normalizeTagColor = (value?: string) =>
  value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : DEFAULT_TAG_COLOR;

const getTagIconId = (description?: string) => {
  if (!description?.startsWith(TAG_ICON_PREFIX)) return ORE_DEFAULT_ICON_ID;
  return normalizeOreIconId(description.slice(TAG_ICON_PREFIX.length));
};

const createTagDescription = (iconId: string) => `${TAG_ICON_PREFIX}${normalizeOreIconId(iconId)}`;

const getReadableTextColor = (hex: string) => {
  const normalized = normalizeTagColor(hex).slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150
    ? 'var(--ore-color-text-onLight-soft)'
    : 'var(--ore-color-text-emphasis-default)';
};

interface TagColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  label: string;
}

const TagColorPicker: React.FC<TagColorPickerProps> = ({ value, onChange, disabled, label }) => {
  const normalizedValue = normalizeTagColor(value);

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[5.25rem_3rem_minmax(0,1fr)] items-center gap-3">
        <div className="text-xs text-[var(--ore-color-text-muted-soft)]">{label}</div>
        <input
          type="color"
          value={normalizedValue}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-12 cursor-pointer border-[0.125rem] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-deep)] p-0 disabled:cursor-not-allowed disabled:opacity-50"
          title={label}
        />
        <div className="grid min-w-0 grid-cols-8 gap-1.5">
          {TAG_COLOR_OPTIONS.map((color) => {
            const active = normalizedValue.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={color}
                type="button"
                disabled={disabled}
                onClick={() => onChange(color)}
                title={color}
                className={[
                  'h-8 border-[0.125rem] outline-none transition-none disabled:opacity-50',
                  'shadow-[inset_0_-0.1875rem_0_rgba(0,0,0,0.28),inset_0.125rem_0.125rem_0_rgba(255,255,255,0.22)]',
                  active
                    ? 'border-white'
                    : 'border-[var(--ore-color-border-primary-default)] hover:border-white focus-visible:border-white',
                ].join(' ')}
                style={{ backgroundColor: color }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const CollectionSidebar: React.FC<CollectionSidebarProps> = ({
  collections,
  selectedGroupId,
  onSelectGroup,
  onCreateCollection,
  onUpdateCollection,
  onRemoveCollection,
}) => {
  const { t } = useTranslation();
  const collectionItems = useLibraryStore((state) => state.collectionItems);
  const groups = collections
    .filter((collection) => collection.type === 'group')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const [isManagingTags, setIsManagingTags] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState('');
  const [newTagColor, setNewTagColor] = React.useState(DEFAULT_TAG_COLOR);
  const [newTagIcon, setNewTagIcon] = React.useState(ORE_DEFAULT_ICON_ID);
  const [isSavingTag, setIsSavingTag] = React.useState(false);
  const [editingTagId, setEditingTagId] = React.useState<string | null>(null);
  const [editingTagName, setEditingTagName] = React.useState('');
  const [editingTagColor, setEditingTagColor] = React.useState(DEFAULT_TAG_COLOR);
  const [editingTagIcon, setEditingTagIcon] = React.useState(ORE_DEFAULT_ICON_ID);
  const [deletingTagId, setDeletingTagId] = React.useState<string | null>(null);
  const [openIconPicker, setOpenIconPicker] = React.useState<string | null>(null);
  const [tagError, setTagError] = React.useState('');
  const newTagInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (isManagingTags) {
      setTimeout(() => newTagInputRef.current?.focus(), 80);
    }
  }, [isManagingTags]);

  const closeTagManager = () => {
    if (isSavingTag) return;
    setIsManagingTags(false);
    setNewTagName('');
    setNewTagColor(DEFAULT_TAG_COLOR);
    setNewTagIcon(ORE_DEFAULT_ICON_ID);
    setEditingTagId(null);
    setEditingTagName('');
    setEditingTagColor(DEFAULT_TAG_COLOR);
    setEditingTagIcon(ORE_DEFAULT_ICON_ID);
    setDeletingTagId(null);
    setOpenIconPicker(null);
    setTagError('');
  };

  const isDuplicateTagName = (name: string, ignoredId?: string) =>
    groups.some(
      (group) => group.id !== ignoredId && group.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );

  const getTagItemCount = (collectionId: string) =>
    collectionItems.filter((relation) => relation.collectionId === collectionId).length;

  const startEditingTag = (collection: Collection) => {
    setEditingTagId(collection.id);
    setEditingTagName(collection.name);
    setEditingTagColor(normalizeTagColor(collection.coverImage));
    setEditingTagIcon(getTagIconId(collection.description));
    setOpenIconPicker(null);
    setDeletingTagId(null);
    setTagError('');
  };

  const handleCreateTag = async () => {
    const normalizedName = newTagName.trim();
    if (!normalizedName || isSavingTag) return;

    if (isDuplicateTagName(normalizedName)) {
      setTagError(t('libraryPage.sidebar.duplicateTag'));
      return;
    }

    setTagError('');
    setIsSavingTag(true);
    const now = Math.floor(Date.now() / 1000);
    const maxSortOrder = groups.reduce((currentMax, group) => Math.max(currentMax, group.sortOrder), 0);
    const newGroup: Collection = {
      id: createGroupId(),
      name: normalizedName,
      type: 'group',
      sortOrder: maxSortOrder + 1,
      createdAt: now,
      updatedAt: now,
      description: createTagDescription(newTagIcon),
      coverImage: normalizeTagColor(newTagColor),
    };

    try {
      await onCreateCollection(newGroup);
      onSelectGroup(newGroup.id);
      setNewTagName('');
      setNewTagColor(DEFAULT_TAG_COLOR);
      setNewTagIcon(ORE_DEFAULT_ICON_ID);
      setOpenIconPicker(null);
    } finally {
      setIsSavingTag(false);
    }
  };

  const handleUpdateTag = async (collection: Collection) => {
    const normalizedName = editingTagName.trim();
    if (!normalizedName || isSavingTag) return;

    if (isDuplicateTagName(normalizedName, collection.id)) {
      setTagError(t('libraryPage.sidebar.duplicateTag'));
      return;
    }

    const normalizedColor = normalizeTagColor(editingTagColor);
    const currentColor = normalizeTagColor(collection.coverImage);
    const normalizedIcon = normalizeOreIconId(editingTagIcon);
    const currentIcon = getTagIconId(collection.description);

    if (normalizedName === collection.name && normalizedColor === currentColor && normalizedIcon === currentIcon) {
      setEditingTagId(null);
      setEditingTagName('');
      setEditingTagColor(DEFAULT_TAG_COLOR);
      setEditingTagIcon(ORE_DEFAULT_ICON_ID);
      setOpenIconPicker(null);
      return;
    }

    setTagError('');
    setIsSavingTag(true);
    try {
      await onUpdateCollection({
        ...collection,
        name: normalizedName,
        description: createTagDescription(normalizedIcon),
        coverImage: normalizedColor,
        updatedAt: Math.floor(Date.now() / 1000),
      });
      setEditingTagId(null);
      setEditingTagName('');
      setEditingTagColor(DEFAULT_TAG_COLOR);
      setEditingTagIcon(ORE_DEFAULT_ICON_ID);
      setOpenIconPicker(null);
    } finally {
      setIsSavingTag(false);
    }
  };

  const handleRemoveTag = async (collection: Collection) => {
    if (deletingTagId !== collection.id) {
      setDeletingTagId(collection.id);
      setEditingTagId(null);
      setOpenIconPicker(null);
      setTagError('');
      return;
    }

    setIsSavingTag(true);
    try {
      await onRemoveCollection(collection.id);
      if (selectedGroupId === collection.id) {
        onSelectGroup('all');
      }
      setDeletingTagId(null);
    } finally {
      setIsSavingTag(false);
    }
  };

  return (
    <aside className="flex w-full flex-col overflow-y-auto bg-[var(--ore-library-sidebar-shellBg)] p-[1rem] text-white">
      <div>
        <SectionHeader
          label={t('libraryPage.sidebar.tagSystem')}
          actionLabel={t('libraryPage.sidebar.manageTags')}
          actionFocusKey="library-tags-manage"
          onAction={() => setIsManagingTags(true)}
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

      <OreModal
        isOpen={isManagingTags}
        onClose={closeTagManager}
        title={t('libraryPage.sidebar.manageTags')}
        className="h-[38rem] w-[42rem] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)]"
        contentClassName="p-0 overflow-hidden min-h-0"
        actionsClassName="!justify-center"
        actions={(
          <OreButton variant="secondary" onClick={closeTagManager} disabled={isSavingTag}>
            {t('libraryPage.tagModal.done')}
          </OreButton>
        )}
      >
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-[var(--ore-color-background-surface-base)]">
          <div className="border-b-[0.125rem] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-library-sidebar-headerBg)] p-4">
            <div className="mb-3 text-sm text-[var(--ore-color-text-muted-soft)]">{t('libraryPage.sidebar.newTag')}</div>
            <div className="grid gap-3">
              <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.75rem] items-center gap-3">
                <OreIconPicker
                  value={newTagIcon}
                  onChange={setNewTagIcon}
                  disabled={isSavingTag}
                  isOpen={openIconPicker === 'new'}
                  onOpenChange={(open) => setOpenIconPicker(open ? 'new' : null)}
                />
                <input
                  ref={newTagInputRef}
                  type="text"
                  value={newTagName}
                  maxLength={24}
                  disabled={isSavingTag}
                  placeholder={t('libraryPage.sidebar.tagNamePlaceholder')}
                  onChange={(event) => {
                    setNewTagName(event.target.value);
                    setTagError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleCreateTag();
                    }
                  }}
                  className="h-10 min-w-0 border-[0.125rem] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-raised)] px-3 font-minecraft text-sm text-white shadow-[inset_0_0.25rem_0_var(--ore-color-background-surface-layer)] outline-none placeholder:text-[var(--ore-color-text-muted-dim)] focus:border-white"
                />
                <OreButton
                  variant="primary"
                  size="auto"
                  disabled={isSavingTag || newTagName.trim() === ''}
                  onClick={() => void handleCreateTag()}
                  title={t('libraryPage.sidebar.saveTag')}
                  className="!h-10 !w-11 !min-w-0 !px-0"
                >
                  <Check size={16} strokeWidth={3} />
                </OreButton>
              </div>
              <TagColorPicker
                label={t('libraryPage.sidebar.tagColor')}
                value={newTagColor}
                onChange={setNewTagColor}
                disabled={isSavingTag}
              />
            </div>
            {tagError && (
              <div className="mt-2 border-[0.125rem] border-[var(--ore-color-border-danger-default)] bg-[var(--ore-color-background-danger-subtle)] px-3 py-2 text-xs text-[var(--ore-color-text-danger-default)]">
                {tagError}
              </div>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto p-4 custom-scrollbar">
            {groups.length === 0 ? (
              <div className="flex h-[10rem] items-center justify-center border-[0.125rem] border-dashed border-[var(--ore-color-border-neutral-muted)] bg-[var(--ore-color-background-surface-panel)] text-sm text-[var(--ore-library-sidebar-emptyText)]">
                {t('libraryPage.sidebar.noTags')}
              </div>
            ) : (
              <div className="grid gap-2">
                {groups.map((collection) => {
                  const isEditing = editingTagId === collection.id;
                  const isDeleting = deletingTagId === collection.id;
                  const tagColor = normalizeTagColor(collection.coverImage);
                  const RowTagIcon = getOreIcon(isEditing ? editingTagIcon : getTagIconId(collection.description));
                  return (
                    <div
                      key={collection.id}
                      className="grid grid-cols-[2.5rem_minmax(0,1fr)_5.75rem] items-start gap-3 border-[0.125rem] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-library-sidebar-rowBg)] p-3 shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.08),inset_0_-0.125rem_0_rgba(0,0,0,0.24)]"
                    >
                      {isEditing ? (
                        <OreIconPicker
                          value={editingTagIcon}
                          onChange={setEditingTagIcon}
                          disabled={isSavingTag}
                          isOpen={openIconPicker === `edit:${collection.id}`}
                          onOpenChange={(open) => setOpenIconPicker(open ? `edit:${collection.id}` : null)}
                        />
                      ) : (
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center border-[0.125rem] border-[var(--ore-color-border-primary-default)] shadow-[inset_0_-0.1875rem_0_rgba(0,0,0,0.28),inset_0.125rem_0.125rem_0_rgba(255,255,255,0.18)]"
                          style={{ backgroundColor: tagColor, color: getReadableTextColor(tagColor) }}
                        >
                          <RowTagIcon size={16} strokeWidth={2.5} />
                        </div>
                      )}

                      {isEditing ? (
                        <div className="grid min-w-0 gap-3">
                          <input
                            type="text"
                            value={editingTagName}
                            maxLength={24}
                            disabled={isSavingTag}
                            onChange={(event) => {
                              setEditingTagName(event.target.value);
                              setTagError('');
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                void handleUpdateTag(collection);
                              } else if (event.key === 'Escape') {
                                event.preventDefault();
                                setEditingTagId(null);
                                setEditingTagName('');
                                setEditingTagColor(DEFAULT_TAG_COLOR);
                                setEditingTagIcon(ORE_DEFAULT_ICON_ID);
                                setOpenIconPicker(null);
                              }
                            }}
                            className="h-10 min-w-0 border-[0.125rem] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-raised)] px-3 font-minecraft text-sm text-white shadow-[inset_0_0.25rem_0_var(--ore-color-background-surface-layer)] outline-none focus:border-white"
                            autoFocus
                          />
                          <TagColorPicker
                            label={t('libraryPage.sidebar.tagColor')}
                            value={editingTagColor}
                            onChange={setEditingTagColor}
                            disabled={isSavingTag}
                          />
                        </div>
                      ) : (
                        <div className="min-w-0 self-center">
                          <div className="truncate text-sm text-white">{collection.name}</div>
                          <div className="mt-1 text-xs text-[var(--ore-color-text-muted-dim)]">
                            {t('libraryPage.sidebar.tagResourceCount', { count: getTagItemCount(collection.id) })}
                          </div>
                        </div>
                      )}

                      <div className="flex shrink-0 items-start justify-end gap-2">
                        {isEditing ? (
                          <>
                            <OreButton
                              variant="primary"
                              size="auto"
                              disabled={isSavingTag || editingTagName.trim() === ''}
                              onClick={() => void handleUpdateTag(collection)}
                              title={t('libraryPage.sidebar.saveChanges')}
                              className="!h-10 !w-10 !min-w-0 !px-0"
                            >
                              <Check size={14} strokeWidth={3} />
                            </OreButton>
                            <OreButton
                              variant="secondary"
                              size="auto"
                              disabled={isSavingTag}
                              onClick={() => {
                                setEditingTagId(null);
                                setEditingTagName('');
                                setEditingTagColor(DEFAULT_TAG_COLOR);
                                setEditingTagIcon(ORE_DEFAULT_ICON_ID);
                                setOpenIconPicker(null);
                              }}
                              title={t('common.cancel')}
                              className="!h-10 !w-10 !min-w-0 !px-0"
                            >
                              <X size={14} />
                            </OreButton>
                          </>
                        ) : (
                          <>
                            <OreButton
                              variant="secondary"
                              size="auto"
                              disabled={isSavingTag}
                              onClick={() => startEditingTag(collection)}
                              title={t('libraryPage.sidebar.renameTag')}
                              className="!h-10 !w-10 !min-w-0 !px-0"
                            >
                              <Pencil size={14} />
                            </OreButton>
                            <OreButton
                              variant="danger"
                              size="auto"
                              disabled={isSavingTag}
                              onClick={() => void handleRemoveTag(collection)}
                              title={isDeleting ? t('libraryPage.sidebar.confirmDelete') : t('libraryPage.sidebar.deleteTag')}
                              className={isDeleting ? '!h-10 !w-[5.75rem] !min-w-0 !px-2 !text-xs' : '!h-10 !w-10 !min-w-0 !px-0'}
                            >
                              {isDeleting ? t('libraryPage.sidebar.confirmShort') : <Trash2 size={14} />}
                            </OreButton>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </OreModal>
    </aside>
  );
};
