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

const SortDirectionIcon: React.FC<{ active: boolean; sortOrder: ModSortOrder }> = ({ active, sortOrder }) => {
  if (!active) return <span className="h-3 w-3 text-transparent" />;
  return sortOrder === 'asc'
    ? <ChevronUp size={13} className="text-[#57D38C]" />
    : <ChevronDown size={13} className="text-[#57D38C]" />;
};

export const ModListGridHeader: React.FC<ModListGridHeaderProps> = ({
  isAllSelected,
  selectedCount,
  sortType,
  sortOrder,
  onSelectAll,
  onSortClick
}) => {
  const renderSortCell = (label: string, sortKey: ModSortType, className = '') => {
    const active = sortType === sortKey;
    return (
      <button
        type="button"
        tabIndex={-1}
        onClick={() => onSortClick(sortKey)}
        className={`inline-flex items-center gap-1 font-minecraft text-[11px] font-bold uppercase tracking-wider transition-colors focus:outline-none ${
          active ? 'text-[#57D38C]' : 'text-[#9DA9BD] hover:text-white'
        } ${className}`}
      >
        <span className="truncate">{label}</span>
        <SortDirectionIcon active={active} sortOrder={sortOrder} />
      </button>
    );
  };

  return (
    <div
      className="grid h-9 w-full select-none items-center gap-3 border-b-[2px] border-[#16181E] bg-[#222630] px-3 font-minecraft text-[11px] font-bold uppercase tracking-wider text-[#9DA9BD]"
      style={{
        gridTemplateColumns: '32px 68px minmax(0, 1fr) 130px 80px 110px 120px'
      }}
    >
      {/* 1. 全选框 */}
      <div className="flex items-center justify-center">
        <button
          type="button"
          tabIndex={-1}
          onClick={onSelectAll}
          className="flex h-5 w-5 items-center justify-center border-[2px] border-[#16181E] bg-[#181C26] text-[#C7D2E6] hover:bg-[#252C3D] hover:text-white transition-colors"
        >
          {isAllSelected ? <CheckSquare size={13} className="text-[#57D38C]" /> : <Square size={13} />}
        </button>
      </div>

      {/* 2. 图标占位 / 选中统计 */}
      <div className="flex items-center justify-center">
        {selectedCount > 0 && (
          <span className="border-[2px] border-[#16181E] bg-[#14261C] px-1.5 py-0.5 text-[10px] font-bold text-[#57D38C]">
            {selectedCount}
          </span>
        )}
      </div>

      {/* 3. 模组名称 */}
      <div className="min-w-0 pr-2">
        {renderSortCell('模组', 'name')}
      </div>

      {/* 4. 版本 */}
      <div>
        {renderSortCell('版本', 'version')}
      </div>

      {/* 5. 大小 */}
      <div>
        <span>大小</span>
      </div>

      {/* 6. 修改时间 */}
      <div>
        {renderSortCell('修改时间', 'time')}
      </div>

      {/* 7. 操作列占位 */}
      <div className="text-right pr-2">
        <span>操作</span>
      </div>
    </div>
  );
};
