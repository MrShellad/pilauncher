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
  onSortClick: (type: ModSortType) => void;
}

const SortDirectionIcon: React.FC<{ active: boolean; sortOrder: ModSortOrder }> = ({ active, sortOrder }) => {
  if (!active) return <span className="h-3.5 w-3.5" />;

  return sortOrder === 'asc'
    ? <ChevronUp size={15} />
    : <ChevronDown size={15} />;
};

const SortableHeaderCell: React.FC<SortableHeaderCellProps> = ({
  label,
  sortKey,
  sortType,
  sortOrder,
  onSortClick
}) => {
  const active = sortType === sortKey;

  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => onSortClick(sortKey)}
      className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 text-center font-minecraft text-[0.9375rem] transition-colors focus:outline-none ${
        active ? 'text-white' : 'text-[#D2D5DC] hover:text-white'
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
    <div className={`mx-2 grid min-h-12 ${MOD_LIST_TABLE_GRID_CLASS} items-center gap-2 border-y border-white/[0.14] bg-[#303033] px-2 text-center text-[#D2D5DC] outline outline-2 outline-black outline-offset-[-2px]`}>
      <div className="mx-auto flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          tabIndex={-1}
          onClick={onSelectAll}
          className="flex h-10 w-10 items-center justify-center border border-white/[0.1] bg-white/[0.04] text-[#B8BBC2] transition-colors hover:text-white focus:outline-none"
          title={isAllSelected ? '取消全选' : '全选'}
        >
          {isAllSelected ? <CheckSquare size={18} className="text-ore-green" /> : <Square size={18} />}
        </button>
        {selectedCount > 0 && (
          <span className="shrink-0 border border-ore-green/40 bg-ore-green/10 px-1.5 py-0.5 font-mono text-[0.6875rem] text-ore-green">
            {selectedCount}
          </span>
        )}
      </div>

      <SortableHeaderCell
        label="名称"
        sortKey="name"
        sortType={sortType}
        sortOrder={sortOrder}
        onSortClick={onSortClick}
      />
      <SortableHeaderCell
        label="文件名"
        sortKey="fileName"
        sortType={sortType}
        sortOrder={sortOrder}
        onSortClick={onSortClick}
      />
      <SortableHeaderCell
        label="版本"
        sortKey="version"
        sortType={sortType}
        sortOrder={sortOrder}
        onSortClick={onSortClick}
      />
      <span className="text-center font-minecraft text-[0.9375rem] text-[#D2D5DC]">
        操作
      </span>
    </div>
  );
};
