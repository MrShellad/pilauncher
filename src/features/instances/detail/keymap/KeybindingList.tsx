import type { Ref } from 'react';
import { AlertTriangle, CheckCircle2, Search, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FocusItem } from '@/ui/focus/FocusItem';
import { OreButton } from '@/ui/primitives/OreButton';
import { OreOverlayScrollArea } from '@/ui/primitives/OreOverlayScrollArea';

import type { KeyBind, SortField, SortOrder } from './keymapTypes';

interface KeybindingListProps {
  keybindings: KeyBind[];
  conflictCountMap: Record<string, number>;
  searchQuery: string;
  selectedKey: string | null;
  sortField: SortField;
  sortOrder: SortOrder;
  onSearchQueryChange: (query: string) => void;
  onSelectedKeyChange: (key: string | null) => void;
  onSortChange: (field: SortField) => void;
  onEditKeybinding: (keybinding: KeyBind) => void;
  onOpenConfiguration: () => void;
  getActionDisplayName: (actionName: string) => string;
  getFriendlyKeyName: (keyValue: string) => string;
}

const SortIndicator = ({ field, activeField, order }: {
  field: SortField;
  activeField: SortField;
  order: SortOrder;
}) => (
  <span className="text-[0.875rem] font-bold text-ore-green">
    {activeField === field ? (order === 'asc' ? '▲' : '▼') : ''}
  </span>
);

export const KeybindingList = ({
  keybindings,
  conflictCountMap,
  searchQuery,
  selectedKey,
  sortField,
  sortOrder,
  onSearchQueryChange,
  onSelectedKeyChange,
  onSortChange,
  onEditKeybinding,
  onOpenConfiguration,
  getActionDisplayName,
  getFriendlyKeyName,
}: KeybindingListProps) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-[1.25rem] flex flex-wrap items-center justify-between gap-[0.75rem]">
        <div className="flex min-w-[20rem] flex-1 items-center gap-[0.75rem]">
          <div className="relative flex-1">
            <Search size="1.125rem" className="pointer-events-none absolute left-[0.75rem] top-1/2 -translate-y-1/2 text-ore-text-muted" />
            <input
              type="text"
              placeholder={t('instanceDetail.game.searchPlaceholder', '搜索按键名称、键名或描述...')}
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              className="w-full rounded-[2px] border-[0.125rem] border-ore-gray-border bg-[#141415] py-[0.5rem] pl-[2.5rem] pr-[1rem] text-[1.125rem] text-white outline-none transition-all hover:border-white/50 focus:border-ore-green"
            />
          </div>

          {selectedKey && (
            <div className="flex shrink-0 items-center gap-[0.375rem] rounded-[2px] border border-ore-green/30 bg-[#23301F] px-[0.75rem] py-[0.5rem] animate-fade-in">
              <span className="text-[1.0625rem] text-[#8e8e93]">筛选:</span>
              <span className="text-[1.0625rem] font-bold text-ore-green">{getFriendlyKeyName(selectedKey)}</span>
              <button
                onClick={() => onSelectedKeyChange(null)}
                className="ml-[0.375rem] text-[0.9375rem] text-[#8e8e93] transition-colors hover:text-white focus:outline-none"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <OreButton
          focusKey="keybind-btn-config-open"
          variant="secondary"
          onClick={onOpenConfiguration}
          className="flex items-center gap-[0.375rem]"
        >
          <Settings size="1rem" />
          <span className="text-[1.0625rem]">按钮配置</span>
        </OreButton>
      </div>

      <div className="flex h-[30rem] flex-col overflow-hidden rounded-[2px] border-[0.125rem] border-ore-gray-border bg-[#141415]">
        <div className="grid select-none grid-cols-[1.5fr_1.2fr_0.8fr] border-b-[0.125rem] border-ore-gray-border bg-[#1E1E1F] px-[1rem] py-[0.625rem] text-[1.0625rem] uppercase tracking-[0.08em] text-ore-text-muted">
          <button className="flex cursor-pointer items-center gap-[0.25rem] transition-colors hover:text-white" onClick={() => onSortChange('name')}>
            <span>动作</span>
            <SortIndicator field="name" activeField={sortField} order={sortOrder} />
          </button>
          <button className="flex cursor-pointer items-center gap-[0.25rem] transition-colors hover:text-white" onClick={() => onSortChange('key')}>
            <span>映射按键</span>
            <SortIndicator field="key" activeField={sortField} order={sortOrder} />
          </button>
          <button className="flex cursor-pointer items-center justify-end gap-[0.25rem] transition-colors hover:text-white" onClick={() => onSortChange('status')}>
            <span>状态</span>
            <SortIndicator field="status" activeField={sortField} order={sortOrder} />
          </button>
        </div>

        <OreOverlayScrollArea className="min-h-0 flex-1" contentClassName="divide-y-[0.125rem] divide-ore-gray-border/40">
          {keybindings.length === 0 ? (
            <div className="flex h-[8rem] flex-col items-center justify-center text-center text-[1.125rem] text-ore-text-muted">
              {t('libraryPage.empty.noMatchTitle', '没有匹配项目')}
            </div>
          ) : (
            keybindings.map((keybinding) => {
              const isConflicting = (conflictCountMap[keybinding.key] || 0) > 1;
              return (
                <FocusItem
                  key={keybinding.name}
                  focusKey={`keybind-item-${keybinding.name}`}
                  onEnter={() => onEditKeybinding(keybinding)}
                >
                  {({ ref, focused }) => (
                    <div
                      ref={ref as Ref<HTMLDivElement>}
                      onClick={() => onEditKeybinding(keybinding)}
                      className={`grid cursor-pointer select-none grid-cols-[1.5fr_1.2fr_0.8fr] items-center border-[0.125rem] border-transparent px-[1rem] py-[0.75rem] outline-none transition-all ${
                        focused ? 'border-ore-focus bg-ore-green/10 drop-shadow-ore-glow' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex min-w-0 flex-col pr-[0.5rem]">
                        <span className="truncate text-[1.125rem] font-bold text-white">{getActionDisplayName(keybinding.name)}</span>
                        <span className="mt-[0.125rem] truncate text-[1.0625rem] text-ore-text-muted">{keybinding.name}</span>
                      </div>
                      <div className="truncate font-minecraft text-[1.125rem] text-ore-green">{getFriendlyKeyName(keybinding.key)}</div>
                      <div className="flex items-center justify-end">
                        {isConflicting ? (
                          <span className="inline-flex items-center gap-[0.25rem] rounded-[2px] border border-[#ff4d4d]/30 bg-[#3A1414] px-[0.5rem] py-[0.125rem] text-[1.0625rem] font-bold text-[#ff4d4d]">
                            <AlertTriangle size="0.875rem" />
                            {t('instanceDetail.game.conflict', '冲突')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-[0.25rem] rounded-[2px] border border-ore-green/30 bg-[#23301F] px-[0.5rem] py-[0.125rem] text-[1.0625rem] font-bold text-ore-green">
                            <CheckCircle2 size="0.875rem" />
                            {t('instanceDetail.game.noConflict', '正常')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </FocusItem>
              );
            })
          )}
        </OreOverlayScrollArea>
      </div>
    </>
  );
};
