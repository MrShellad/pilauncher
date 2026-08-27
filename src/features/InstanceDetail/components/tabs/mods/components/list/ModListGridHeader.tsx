import React from 'react';
import { CheckSquare, ChevronDown, ChevronUp, Square } from 'lucide-react';

import { type ModSortOrder, type ModSortType } from '../../../../../hooks/useModManager';
import { type ModListTheme } from '../../modListShared';

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
    ? <ChevronUp size={14} className="text-[#7AA2FF]" />
    : <ChevronDown size={14} className="text-[#7AA2FF]" />;
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
      ? 'text-[#FFFFFF] hover:text-white'
      : 'text-[#8B93A7] hover:text-[#DCE3F1]';
  const activeClass = isLightTheme ? 'text-[#111214]' : 'text-[#FFFFFF]';

  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => onSortClick(sortKey)}
      className={`inline-flex min-h-8 min-w-0 items-center gap-1 font-minecraft text-[12px] font-bold uppercase tracking-wider transition-colors focus:outline-none ${className} ${
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
    ? 'border-[2px] border-[#1E1E1F] bg-[#B8BBC2] text-[#313233] shadow-[inset_0_-2px_0_#8C8D90,inset_1px_1px_0_rgba(255,255,255,0.62)]'
    : 'border-[2px] border-[#1E1E1F] bg-[#1A1F29] text-[#8B93A7] shadow-[inset_0_-2px_0_#12151C,inset_1px_1px_0_rgba(255,255,255,0.05)]';
  const selectButtonClass = isLightTheme
    ? 'border-[2px] border-[#1E1E1F] bg-[#DDE0E3] text-[#313233] hover:bg-[#F2F2F2] hover:text-[#111214] shadow-[inset_0_-2px_0_#A9ABAE]'
    : 'border-[2px] border-[#1E1E1F] bg-[#232937] text-[#C7D2E6] hover:bg-[#2B3447] hover:text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.4)]';
  const selectedCountClass = isLightTheme
    ? 'border-[2px] border-[#1E1E1F] bg-[#F2F2F2] text-[#111214] shadow-[inset_0_-2px_0_#B8BBC2]'
    : 'border-[2px] border-[#1E1E1F] bg-[#232937] text-[#C7D2E6] shadow-[inset_0_-2px_0_rgba(0,0,0,0.4)]';

  return (
    <div className={`relative z-20 mx-2 flex min-h-8 items-center gap-3 px-3 py-1 ${headerClass}`}>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          tabIndex={-1}
          onClick={onSelectAll}
          className={`flex h-6 w-6 items-center justify-center transition-colors focus:outline-none ${selectButtonClass}`}
          title={isAllSelected ? '取消全选' : '全选'}
        >
          {isAllSelected ? <CheckSquare size={14} className="text-ore-green" /> : <Square size={14} />}
        </button>
        {selectedCount > 0 && (
          <span className={`shrink-0 border px-1 py-0.5 font-minecraft text-[10px] font-bold ${selectedCountClass}`}>
            {selectedCount}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <SortableHeaderCell
          label={'模组'}
          sortKey="name"
          sortType={sortType}
          sortOrder={sortOrder}
          tone="primary"
          onSortClick={onSortClick}
          listTheme={listTheme}
        />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="w-32 lg:w-36 shrink-0">
          <SortableHeaderCell
            label={'版本'}
            sortKey="version"
            sortType={sortType}
            sortOrder={sortOrder}
            onSortClick={onSortClick}
            listTheme={listTheme}
          />
        </div>

        <div className="w-20 lg:w-24 shrink-0 font-minecraft text-[12px] font-bold uppercase tracking-wider">
          <span className={isLightTheme ? 'text-[#4A4C50]' : 'text-[#8B93A7]'}>
            {'大小'}
          </span>
        </div>

        <div className="w-24 lg:w-28 shrink-0 font-minecraft text-[12px] font-bold uppercase tracking-wider">
          <SortableHeaderCell
            label={'修改时间'}
            sortKey="time"
            sortType={sortType}
            sortOrder={sortOrder}
            onSortClick={onSortClick}
            listTheme={listTheme}
          />
        </div>
      </div>

      <div className="w-32 shrink-0 text-right pr-2 font-minecraft text-[12px] font-bold uppercase tracking-wider">
        <span className={isLightTheme ? 'text-[#4A4C50]' : 'text-[#8B93A7]'}>
          {'操作'}
        </span>
      </div>
    </div>
  );
};
