// src/features/InstanceDetail/components/tabs/mods/InstanceFilterBar.tsx
import React from 'react';
import { Search, RotateCcw, ArrowLeft } from 'lucide-react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { OreToggleButton } from '../../../../../ui/primitives/OreToggleButton';
import { OreInput } from '../../../../../ui/primitives/OreInput';
import { OreDropdown } from '../../../../../ui/primitives/OreDropdown';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { FocusItem } from '../../../../../ui/focus/FocusItem'; // ✅ 补充引入焦点引擎
import { ModrinthIcon, CurseforgeIcon } from '../../../../Download/components/FilterBar';

interface InstanceFilterBarProps {
  onBack: () => void;
  query: string; setQuery: (v: string) => void;
  source: string; setSource: (v: string) => void;
  category: string; setCategory: (v: string) => void;
  sort: string; setSort: (v: string) => void;
  onSearch: () => void;
  onReset: () => void;
}

type FilterKey =
  | 'inst-filter-back'
  | 'inst-filter-source'
  | 'inst-filter-category'
  | 'inst-filter-sort'
  | 'inst-filter-search'
  | 'inst-filter-btn-search'
  | 'inst-filter-btn-reset';

const firstRow: FilterKey[] = [
  'inst-filter-back',
  'inst-filter-source',
  'inst-filter-category',
  'inst-filter-sort'
];

const secondRow: FilterKey[] = [
  'inst-filter-search',
  'inst-filter-btn-search',
  'inst-filter-btn-reset'
];

export const InstanceFilterBar: React.FC<InstanceFilterBarProps> = (props) => {
  const sourceOptions = [
    { label: <div className="flex items-center justify-center w-full font-minecraft tracking-wider"><ModrinthIcon className={`mr-1.5 text-[18px] ${props.source === 'modrinth' ? 'text-white' : 'text-ore-green'}`} /> Modrinth</div>, value: 'modrinth' },
    { label: <div className="flex items-center justify-center w-full font-minecraft tracking-wider"><CurseforgeIcon className={`mr-1.5 text-[18px] ${props.source === 'curseforge' ? 'text-white' : 'text-[#F16436]'}`} /> CurseForge</div>, value: 'curseforge' }
  ];

  const categoryOptions = [
    { label: '全部分类', value: '' }, { label: '科技', value: 'technology' },
    { label: '魔法', value: 'magic' }, { label: '性能优化', value: 'optimization' }, { label: '实用工具', value: 'utility' }
  ];

  const sortOptions = [
    { label: '综合排序', value: 'relevance' }, { label: '下载最高', value: 'downloads' }, { label: '最近更新', value: 'updated' }
  ];

  const moveFocusToResults = () => {
    if (doesFocusableExist('download-grid-item-0')) {
      setFocus('download-grid-item-0');
      return false;
    }
    return true;
  };

  const handleArrow = (key: FilterKey) => (direction: string) => {
    const firstRowIndex = firstRow.indexOf(key);
    const secondRowIndex = secondRow.indexOf(key);

    if (direction === 'left' || direction === 'right') {
      const row = firstRowIndex >= 0 ? firstRow : secondRow;
      const index = firstRowIndex >= 0 ? firstRowIndex : secondRowIndex;
      const nextIndex = direction === 'right'
        ? (index + 1) % row.length
        : (index - 1 + row.length) % row.length;
      const nextKey = row[nextIndex];
      if (doesFocusableExist(nextKey)) setFocus(nextKey);
      return false;
    }

    if (direction === 'down') {
      if (firstRowIndex >= 0) {
        const nextKey = secondRow[Math.min(firstRowIndex, secondRow.length - 1)];
        if (doesFocusableExist(nextKey)) {
          setFocus(nextKey);
          return false;
        }
      }
      return moveFocusToResults();
    }

    if (direction === 'up') {
      if (secondRowIndex >= 0) {
        const nextKey = firstRow[Math.min(secondRowIndex, firstRow.length - 1)];
        if (doesFocusableExist(nextKey)) {
          setFocus(nextKey);
          return false;
        }
      }
      return false;
    }

    return true;
  };

  return (
    <div className="p-4 bg-[#18181B] border-2 border-[#2A2A2C] flex-shrink-0 z-20 mb-4 shadow-md">
      <div className="flex flex-col gap-4">
        
        {/* ================= 第一行：导航与下拉 ================= */}
        <div className="flex flex-wrap items-center gap-4">
          <OreButton
            focusKey="inst-filter-back"
            onArrowPress={handleArrow('inst-filter-back')}
            variant="ghost"
            size="auto"
            onClick={props.onBack}
            className="!h-[44px] !px-4 text-gray-400 hover:text-white border border-white/5 bg-black/30"
          >
            <ArrowLeft size={18} className="mr-1.5" /> 返回管理
          </OreButton>
          
          <div className="h-8 w-px bg-white/10 hidden sm:block" />
          
          {/* ✅ 修复重叠：加宽至 280px，并包裹焦点监听容器 */}
          <div className="w-[280px] relative focus-within:z-50">
            <FocusItem
              focusKey="inst-filter-source"
              onArrowPress={handleArrow('inst-filter-source')}
              onEnter={() => props.setSource(props.source === 'modrinth' ? 'curseforge' : 'modrinth')}
            >
              {({ ref, focused }) => (
                <div
                  ref={ref as React.RefObject<HTMLDivElement>}
                  className={`w-full h-[44px] transition-all rounded-sm ${focused ? 'ring-[2px] ring-white scale-[1.02] z-50 brightness-110 shadow-lg' : ''}`}
                >
                  <OreToggleButton options={sourceOptions} value={props.source} onChange={props.setSource} className="!m-0 h-full" />
                </div>
              )}
            </FocusItem>
          </div>
          
          {/* ✅ 修复重叠：改为 flex-1 弹性撑开剩余宽度 */}
          <div className="flex-1 min-w-[140px] relative focus-within:z-50">
            <OreDropdown
              focusKey="inst-filter-category"
              onArrowPress={handleArrow('inst-filter-category')}
              options={categoryOptions}
              value={props.category || categoryOptions[0].value}
              onChange={props.setCategory}
              className="w-full !h-[44px]"
            />
          </div>
          
          <div className="flex-1 min-w-[140px] relative focus-within:z-50">
            <OreDropdown
              focusKey="inst-filter-sort"
              onArrowPress={handleArrow('inst-filter-sort')}
              options={sortOptions}
              value={props.sort || sortOptions[0].value}
              onChange={props.setSort}
              className="w-full !h-[44px]"
            />
          </div>
        </div>

        {/* ================= 第二行：搜索区 ================= */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative focus-within:z-50">
            <OreInput
              focusKey="inst-filter-search"
              width="100%" height="44px"
              onArrowPress={handleArrow('inst-filter-search')}
              value={props.query} onChange={(e) => props.setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && props.onSearch()}
              placeholder="搜索适用于当前实例的模组..." prefixNode={<Search size={16} />} 
              containerClassName="!space-y-0 !h-[44px] w-full"
            />
          </div>
          <div className="w-[120px] relative focus-within:z-50">
            <OreButton
              focusKey="inst-filter-btn-search"
              onArrowPress={handleArrow('inst-filter-btn-search')}
              variant="primary"
              size="auto"
              onClick={props.onSearch}
              className="w-full !h-[44px] font-bold text-black tracking-wider"
            >
              <Search size={16} className="mr-1.5" /> 搜索
            </OreButton>
          </div>
          <div className="w-[100px] relative focus-within:z-50">
            <OreButton
              focusKey="inst-filter-btn-reset"
              onArrowPress={handleArrow('inst-filter-btn-reset')}
              variant="secondary"
              size="auto"
              onClick={props.onReset}
              className="w-full !h-[44px] text-black"
            >
              <RotateCcw size={16} className="mr-1.5" /> 重置
            </OreButton>
          </div>
        </div>

      </div>
    </div>
  );
};
