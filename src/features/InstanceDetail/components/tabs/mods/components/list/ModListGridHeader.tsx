import React from 'react';
import { CheckSquare, ChevronDown, ChevronUp, Square } from 'lucide-react';

import { type ModSortOrder, type ModSortType } from '../../../../../hooks/useModManager';
import { MOD_LIST_TABLE_GRID_CLASS, type ModListTheme } from '../../modListShared';

interface ModListGridHeaderProps {
  isAllSelected: boolean;
  selectedCount: number;
  sortType: ModSortType;
  sortOrder: ModSortOrder;
  onSelectAll: () => void;
  onSortClick: (type: ModSortType) => void;
  listTheme: ModListTheme;
}

interface SortableHeaderCellProps {
  label: string;
  sortKey: ModSortType;
  sortType: ModSortType;
  sortOrder: ModSortOrder;
  tone?: 'primary' | 'secondary';
  listTheme: ModListTheme;
  className?: string;
  onSortClick: (type: ModSortType) => void;
}

const SortDirectionIcon: React.FC<{ active: boolean; sortOrder: ModSortOrder }> = ({ active, sortOrder }) => {
  if (!active) return <span className="h-3.5 w-3.5 text-[#7E879A]" />;

  return sortOrder === 'asc'
    ? <ChevronUp size={15} className="text-[#7AA2FF]" />
    : <ChevronDown size={15} className="text-[#7AA2FF]" />;
};

const SortableHeaderCell: React.FC<SortableHeaderCellProps> = ({
  label,
  sortKey,
  sortType,
  sortOrder,
  tone = 'secondary',
  listTheme,
  className = 'justify-start',
  onSortClick
}) => {
  const active = sortType === sortKey;
  const isLightTheme = listTheme === 'light';
  const textClass = isLightTheme
    ? tone === 'primary'
      ? 'text-[#111214] hover:text-black'
      : 'text-[#4A4C50] hover:text-[#111214]'
    : tone === 'primary'
      ? 'text-[#DCE3F1] hover:text-white'
      : 'text-[#8B93A7] hover:text-[#DCE3F1]';
  const activeClass = isLightTheme ? 'text-[#111214]' : 'text-[#DCE3F1]';

  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => onSortClick(sortKey)}
      className={`inline-flex min-h-12 min-w-0 items-center gap-1.5 text-[1.0625rem] transition-colors focus:outline-none ${className} ${
        active ? activeClass : textClass
      }`}
    >
      <span className="truncate">{label}</span>
      <SortDirectionIcon active={active} sortOrder={sortOrder} />
    </button>
  );
};

export const ModListGridHeader: React.FC<ModListGridHeaderProps> = ({
  isAllSelected,
  selectedCount,
  sortType,
  sortOrder,
  onSelectAll,
  onSortClick,
  listTheme
}) => {
  const isLightTheme = listTheme === 'light';
  const headerClass = isLightTheme
    ? 'border-[#1E1E1F] border-b-[#1E1E1F] bg-[#B8BBC2] text-[#313233] outline-black shadow-[inset_0_-0.1875rem_0_#8C8D90,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.62)]'
    : 'border-[#2A3140] border-b-[#313A4D] bg-[#1A1F29] text-[#8B93A7] outline-black shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
  const selectButtonClass = isLightTheme
    ? 'border-[#1E1E1F] bg-[#DDE0E3] text-[#313233] hover:bg-[#F2F2F2] hover:text-[#111214] shadow-[inset_0_-0.125rem_0_#A9ABAE]'
    : 'border-[#313A4D] bg-[#232937] text-[#C7D2E6] hover:bg-[#2B3447] hover:text-white';
  const selectedCountClass = isLightTheme
    ? 'border-[#1E1E1F] bg-[#F2F2F2] text-[#111214] shadow-[inset_0_-0.125rem_0_#B8BBC2]'
    : 'border-[#313A4D] bg-[#232937] text-[#C7D2E6]';

  return (
    <div className={`relative z-20 mx-2 grid min-h-12 ${MOD_LIST_TABLE_GRID_CLASS} items-center gap-2 border px-2 outline outline-2 outline-offset-[-2px] ${headerClass}`}>
      <div className="mx-auto flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          tabIndex={-1}
          onClick={onSelectAll}
          className={`flex h-10 w-10 items-center justify-center border transition-colors focus:outline-none ${selectButtonClass}`}
          title={isAllSelected ? '\u53d6\u6d88\u5168\u9009' : '\u5168\u9009'}
        >
          {isAllSelected ? <CheckSquare size={18} className="text-ore-green" /> : <Square size={18} />}
        </button>
        {selectedCount > 0 && (
          <span className={`shrink-0 rounded-[6px] border px-2 py-0.5 text-[1.0625rem] font-semibold ${selectedCountClass}`}>
            {selectedCount}
          </span>
        )}
      </div>

      <SortableHeaderCell
        label={'\u540d\u79f0'}
        sortKey="name"
        sortType={sortType}
        sortOrder={sortOrder}
        tone="primary"
        className="justify-start pl-[4.25rem]"
        onSortClick={onSortClick}
        listTheme={listTheme}
      />
      <SortableHeaderCell
        label={'\u6587\u4ef6\u540d'}
        sortKey="fileName"
        sortType={sortType}
        sortOrder={sortOrder}
        onSortClick={onSortClick}
        listTheme={listTheme}
      />
      <SortableHeaderCell
        label={'\u7248\u672c'}
        sortKey="version"
        sortType={sortType}
        sortOrder={sortOrder}
        onSortClick={onSortClick}
        listTheme={listTheme}
      />
      <span className={`justify-self-end pr-5 text-[1.0625rem] ${isLightTheme ? 'text-[#4A4C50]' : 'text-[#8B93A7]'}`}>
        {'\u64cd\u4f5c'}
      </span>
    </div>
  );
};
