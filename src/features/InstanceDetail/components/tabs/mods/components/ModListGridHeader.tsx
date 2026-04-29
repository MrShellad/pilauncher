import React from 'react';
import { CheckSquare, ChevronDown, ChevronUp, Square } from 'lucide-react';

import { type ModSortOrder, type ModSortType } from '../../../../hooks/useModManager';
import { MOD_LIST_TABLE_GRID_CLASS } from '../modListShared';

interface ModListGridHeaderProps {
  isAllSelected: boolean;
  selectedCount: number;
  sortType: ModSortType;
  sortOrder: ModSortOrder;
  onSelectAll: () => void;
  onSortClick: (type: ModSortType) => void;
}

interface SortableHeaderCellProps {
  label: string;
  sortKey: ModSortType;
  sortType: ModSortType;
  sortOrder: ModSortOrder;
  tone?: 'primary' | 'secondary';
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
  className = 'justify-start',
  onSortClick
}) => {
  const active = sortType === sortKey;
  const textClass = tone === 'primary'
    ? 'text-[#DCE3F1] hover:text-white'
    : 'text-[#8B93A7] hover:text-[#DCE3F1]';

  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => onSortClick(sortKey)}
      className={`inline-flex min-h-12 min-w-0 items-center gap-1.5 text-[1.0625rem] transition-colors focus:outline-none ${className} ${
        active ? 'text-[#DCE3F1]' : textClass
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
  onSortClick
}) => {
  return (
    <div className={`relative z-20 mx-2 grid min-h-12 ${MOD_LIST_TABLE_GRID_CLASS} items-center gap-2 border border-[#2A3140] border-b-[#313A4D] bg-[#1A1F29] px-2 text-[#8B93A7] outline outline-2 outline-black shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}>
      <div className="mx-auto flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          tabIndex={-1}
          onClick={onSelectAll}
          className="flex h-10 w-10 items-center justify-center border border-[#313A4D] bg-[#232937] text-[#C7D2E6] transition-colors hover:bg-[#2B3447] hover:text-white focus:outline-none"
          title={isAllSelected ? '\u53d6\u6d88\u5168\u9009' : '\u5168\u9009'}
        >
          {isAllSelected ? <CheckSquare size={18} className="text-ore-green" /> : <Square size={18} />}
        </button>
        {selectedCount > 0 && (
          <span className="shrink-0 rounded-[6px] border border-[#313A4D] bg-[#232937] px-2 py-0.5 text-[1.0625rem] font-semibold text-[#C7D2E6]">
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
      />
      <SortableHeaderCell
        label={'\u6587\u4ef6\u540d'}
        sortKey="fileName"
        sortType={sortType}
        sortOrder={sortOrder}
        onSortClick={onSortClick}
      />
      <SortableHeaderCell
        label={'\u7248\u672c'}
        sortKey="version"
        sortType={sortType}
        sortOrder={sortOrder}
        onSortClick={onSortClick}
      />
      <span className="justify-self-end text-[1.0625rem] text-[#8B93A7]">
        {'\u64cd\u4f5c'}
      </span>
    </div>
  );
};
