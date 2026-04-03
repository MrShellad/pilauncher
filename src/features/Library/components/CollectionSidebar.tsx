import React from 'react';
import { Check, FolderOpen, Package, Plus, Star, X } from 'lucide-react';
import type { Collection } from '../../../types/library';
import { useLibraryStore } from '../../../stores/useLibraryStore';

interface CollectionSidebarProps {
  collections: Collection[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
}

interface NavBtnProps {
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

interface SectionHeaderProps {
  label: string;
  onAdd?: () => void;
}

const NAV_BUTTON_STYLE: React.CSSProperties = {
  width: '100%',
  fontFamily: 'var(--ore-typography-family-body)',
};

const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--ore-typography-family-subheading)',
};

const NavBtn: React.FC<NavBtnProps> = ({ isActive, onClick, icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    style={NAV_BUTTON_STYLE}
    className={[
      'mb-[var(--ore-spacing-xs)] flex h-[var(--ore-unit-controlHeight)] items-center gap-[var(--ore-spacing-base)] overflow-hidden border-2 px-[var(--ore-spacing-md)] text-left text-[length:var(--ore-typography-size-sm)] text-[color:var(--ore-color-text-primary-default)] transition-[background-color,border-color,box-shadow] duration-75',
      'bg-[var(--ore-library-sidebar-button-bg)] border-[color:var(--ore-library-sidebar-button-border)] shadow-[var(--ore-library-sidebar-button-shadow)]',
      'hover:bg-[var(--ore-library-sidebar-button-bgActive)] hover:border-[color:var(--ore-library-sidebar-button-borderActive)] hover:shadow-none',
      isActive ? 'bg-[var(--ore-library-sidebar-button-bgActive)] border-[color:var(--ore-library-sidebar-button-borderActive)] shadow-none' : '',
    ].join(' ')}
  >
    <span className="shrink-0 text-[var(--ore-color-text-primary-default)]">{icon}</span>
    <span className="truncate">{label}</span>
  </button>
);

const SectionHeader: React.FC<SectionHeaderProps> = ({ label, onAdd }) => (
  <div
    style={SECTION_LABEL_STYLE}
    className="mb-[var(--ore-spacing-sm)] flex w-full items-center justify-between border-l-[6px] border-[color:var(--ore-library-sidebar-section-border)] bg-[var(--ore-library-sidebar-section-bg)] px-[var(--ore-spacing-md)] py-[var(--ore-spacing-xs)] text-[length:var(--ore-typography-size-xs)] text-[var(--ore-library-sidebar-section-text)]"
  >
    <span>{label}</span>
    {onAdd && (
      <button
        type="button"
        onClick={onAdd}
        title="新建标签"
        className="flex min-h-[20px] min-w-[20px] items-center justify-center px-[var(--ore-spacing-xs)] text-[var(--ore-library-sidebar-section-action)] transition-colors hover:text-[var(--ore-library-sidebar-section-actionHover)]"
      >
        <Plus size={16} />
      </button>
    )}
  </div>
);

const createGroupId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

export const CollectionSidebar: React.FC<CollectionSidebarProps> = ({
  collections,
  selectedGroupId,
  onSelectGroup,
}) => {
  const createCollection = useLibraryStore((state) => state.createCollection);
  const modpacks = collections.filter((collection) => collection.type === 'modpack');
  const groups = collections
    .filter((collection) => collection.type === 'group')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const [isAddingTag, setIsAddingTag] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState('');
  const [isSavingTag, setIsSavingTag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (isAddingTag) {
      inputRef.current?.focus();
    }
  }, [isAddingTag]);

  const closeTagEditor = () => {
    if (isSavingTag) return;
    setIsAddingTag(false);
    setNewTagName('');
  };

  const handleCreateTag = async () => {
    const normalizedName = newTagName.trim();
    if (!normalizedName || isSavingTag) return;

    const existing = groups.find(
      (group) => group.name.trim().toLowerCase() === normalizedName.toLowerCase(),
    );
    if (existing) {
      onSelectGroup(existing.id);
      setIsAddingTag(false);
      setNewTagName('');
      return;
    }

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
      description: '',
    };

    try {
      await createCollection(newGroup);
      onSelectGroup(newGroup.id);
      setIsAddingTag(false);
      setNewTagName('');
    } finally {
      setIsSavingTag(false);
    }
  };

  return (
    <aside
      className="flex w-full flex-col overflow-y-auto bg-[var(--ore-library-sidebar-panel-bg)] px-[var(--ore-spacing-sm)] py-[var(--ore-spacing-base)] text-[var(--ore-color-text-primary-default)]"
      style={{
        fontFamily: 'var(--ore-typography-family-body)',
        boxShadow: 'var(--ore-library-sidebar-panel-inset)',
      }}
    >
      <div className="mb-[var(--ore-spacing-xs)]">
        <SectionHeader label="库分类 Library" />
        <NavBtn
          isActive={selectedGroupId === 'all'}
          onClick={() => onSelectGroup('all')}
          icon={<FolderOpen size={16} />}
          label="全部资源"
        />
        <NavBtn
          isActive={selectedGroupId === 'starred'}
          onClick={() => onSelectGroup('starred')}
          icon={<Star size={16} />}
          label="已收藏"
        />
      </div>

      <hr className="mx-0 my-[var(--ore-spacing-sm)] h-[2px] w-full border-0 bg-[var(--ore-library-sidebar-section-divider)]" />

      <div className="mb-[var(--ore-spacing-xs)]">
        <SectionHeader label="整合包 Modpacks" onAdd={() => {}} />
        {modpacks.length === 0 ? (
          <div className="px-[var(--ore-spacing-md)] py-[var(--ore-spacing-xs)] text-[length:var(--ore-typography-size-xs)] italic text-[var(--ore-library-sidebar-section-emptyText)]">
            暂无整合包
          </div>
        ) : (
          modpacks.map((collection) => (
            <NavBtn
              key={collection.id}
              isActive={selectedGroupId === collection.id}
              onClick={() => onSelectGroup(collection.id)}
              icon={<Package size={16} />}
              label={collection.name}
            />
          ))
        )}
      </div>

      <hr className="mx-0 my-[var(--ore-spacing-sm)] h-[2px] w-full border-0 bg-[var(--ore-library-sidebar-section-divider)]" />

      <div>
        <SectionHeader label="标签 Tags" onAdd={() => setIsAddingTag(true)} />
        {isAddingTag && (
          <div className="mb-[var(--ore-spacing-sm)] flex items-center gap-[var(--ore-spacing-xs)]">
            <input
              ref={inputRef}
              type="text"
              value={newTagName}
              maxLength={24}
              disabled={isSavingTag}
              placeholder="输入标签名称"
              onChange={(event) => setNewTagName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleCreateTag();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  closeTagEditor();
                }
              }}
              className="h-[32px] flex-1 border-2 border-[var(--ore-library-sidebar-tag-inputBorder)] bg-[var(--ore-library-sidebar-tag-inputBg)] px-[var(--ore-spacing-sm)] text-[length:var(--ore-typography-size-sm)] text-[var(--ore-color-text-primary-default)] outline-none placeholder:text-[var(--ore-library-sidebar-tag-inputPlaceholder)]"
            />
            <button
              type="button"
              disabled={isSavingTag || newTagName.trim() === ''}
              onClick={() => void handleCreateTag()}
              className="flex h-[32px] w-[32px] items-center justify-center border-2 border-[var(--ore-library-sidebar-tag-border)] bg-[var(--ore-library-sidebar-tag-bgActive)] text-[var(--ore-library-sidebar-tag-textActive)] disabled:cursor-not-allowed disabled:opacity-50"
              title="保存标签"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              disabled={isSavingTag}
              onClick={closeTagEditor}
              className="flex h-[32px] w-[32px] items-center justify-center border-2 border-[var(--ore-library-sidebar-tag-border)] bg-[var(--ore-library-sidebar-tag-bg)] text-[var(--ore-library-sidebar-tag-text)]"
              title="取消"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {groups.length === 0 ? (
          <div className="px-[var(--ore-spacing-md)] py-[var(--ore-spacing-xs)] text-[length:var(--ore-typography-size-xs)] italic text-[var(--ore-library-sidebar-section-emptyText)]">
            暂无标签
          </div>
        ) : (
          <div className="flex flex-wrap gap-[var(--ore-spacing-xs)] px-[var(--ore-spacing-xs)] py-[var(--ore-spacing-xs)]">
            {groups.map((collection) => {
              const active = selectedGroupId === collection.id;
              return (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => onSelectGroup(collection.id)}
                  className={[
                    'inline-flex h-[24px] max-w-full items-center border-2 px-[var(--ore-spacing-xs)] text-[length:var(--ore-typography-size-xs)] transition-colors',
                    'border-[var(--ore-library-sidebar-tag-border)]',
                    active
                      ? 'bg-[var(--ore-library-sidebar-tag-bgActive)] text-[var(--ore-library-sidebar-tag-textActive)]'
                      : 'bg-[var(--ore-library-sidebar-tag-bg)] text-[var(--ore-library-sidebar-tag-text)] hover:bg-[var(--ore-library-sidebar-tag-bgHover)]',
                  ].join(' ')}
                >
                  <span className="truncate">{collection.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
