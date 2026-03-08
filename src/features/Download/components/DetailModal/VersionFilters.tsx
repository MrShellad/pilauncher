// src/features/Download/components/DetailModal/VersionFilters.tsx
import React, { useMemo } from 'react';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreToggleButton } from '../../../../ui/primitives/OreToggleButton';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown'; 

interface VersionFiltersProps {
  versionsCount: number;
  loaderOptions: any[];
  activeLoader: string;
  setActiveLoader: (val: string) => void;
  availableVersions: string[];
  activeVersion: string;
  setActiveVersion: (val: string) => void;
}

export const VersionFilters: React.FC<VersionFiltersProps> = ({ 
  versionsCount, loaderOptions, activeLoader, setActiveLoader, availableVersions, activeVersion, setActiveVersion 
}) => {

  const { majorGroups, topMajors, moreReleases, snapshots } = useMemo(() => {
    const groups: Record<string, string[]> = {};
    const snaps: string[] = [];

    const versionSortDesc = (a: string, b: string) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });

    availableVersions.forEach(v => {
      const lowerV = v.toLowerCase();
      if (/^\d{2}w\d{2}[a-z]$/.test(lowerV) || lowerV.includes('snapshot') || lowerV.includes('experimental') || lowerV.includes('alpha') || lowerV.includes('beta')) {
        snaps.push(v);
      } else if (/^1\.\d+/.test(v)) {
        const match = v.match(/^1\.(\d+)/);
        const major = match ? match[0] : '1.x';
        if (!groups[major]) groups[major] = [];
        groups[major].push(v);
      } else {
        snaps.push(v); 
      }
    });

    const sortedMajors = Object.keys(groups).sort((a, b) => {
      const numA = parseInt(a.split('.')[1] || '0');
      const numB = parseInt(b.split('.')[1] || '0');
      return numB - numA;
    });

    const top4 = sortedMajors.slice(0, 4); 
    const rest = sortedMajors.slice(4);

    const moreRels: string[] = [];
    rest.forEach(m => {
      groups[m].sort(versionSortDesc);
      moreRels.push(...groups[m]);
    });

    top4.forEach(m => groups[m].sort(versionSortDesc));
    snaps.sort(versionSortDesc); 

    return { majorGroups: groups, topMajors: top4, moreReleases: moreRels, snapshots: snaps };
  }, [availableVersions]);

  return (
    <div className="flex flex-col px-5 py-4 border-b border-white/5 bg-[#141415] gap-4 shadow-xl z-50 relative flex-shrink-0 w-full box-border">
      
      {/* ================= 行 1：引导器 ================= */}
      <div className="flex items-center gap-3 w-full">
        <span className="text-sm font-minecraft text-gray-400 flex-shrink-0 w-[60px]">引导器:</span>
        {/* ✅ 核心修复：统一使用 flex-1 min-w-0 占据相同的剩余宽度 */}
        <div className="flex-1 min-w-0">
          <FocusItem 
            onEnter={() => {
              if (!loaderOptions || loaderOptions.length === 0) return;
              const currentIndex = loaderOptions.findIndex((opt: any) => opt.value === activeLoader);
              const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % loaderOptions.length;
              setActiveLoader(loaderOptions[nextIndex].value);
            }}
          >
            {({ ref, focused }) => (
              // ✅ 核心修复：移除 max-w-[800px]，使用 w-full 彻底撑满右侧边界
              <div ref={ref as any} className={`w-full h-9 transition-all ${focused ? 'ring-2 ring-white rounded-sm scale-[1.01] brightness-110' : ''}`}>
                <OreToggleButton 
                  options={loaderOptions} 
                  value={activeLoader} 
                  onChange={setActiveLoader} 
                  // 强制内部组件也 100% 拉伸
                  className="!m-0 w-full h-full flex [&>.ore-toggle-btn-group]:!h-full [&>.ore-toggle-btn-group]:!w-full text-xs" 
                />
              </div>
            )}
          </FocusItem>
        </div>
      </div>

      {/* ================= 行 2：游戏版本 ================= */}
      <div className="flex items-center gap-3 w-full">
        <span className="text-sm font-minecraft text-gray-400 flex-shrink-0 w-[60px]">版本:</span>
        {/* ✅ 核心修复：统一使用 flex-1 min-w-0 占据相同的剩余宽度 */}
        <div className="flex-1 min-w-0 flex gap-2 flex-wrap items-center">
          
          {/* ✅ 核心修复：移除所有的 max-w，仅保留 flex-1 和 min-w，让它们自动平分且完全填满父容器 */}
          {topMajors.map(major => (
            <OreDropdown
              key={major}
              searchable
              className="flex-1 min-w-[100px]" 
              placeholder={major}
              value={activeVersion}
              onChange={setActiveVersion}
              options={[
                { label: `清除选择 (${major})`, value: '' },
                ...majorGroups[major].map(v => ({ label: v, value: v }))
              ]}
            />
          ))}

          {moreReleases.length > 0 && (
            <OreDropdown
               searchable
               className="flex-1 min-w-[100px]"
               placeholder="更多历史"
               value={activeVersion}
               onChange={setActiveVersion}
               options={[
                { label: '清除选择 (历史)', value: '' },
                ...moreReleases.map(v => ({ label: v, value: v }))
               ]}
            />
          )}

          {snapshots.length > 0 && (
            <OreDropdown
               searchable
               className="flex-1 min-w-[100px]"
               placeholder="快照/预览"
               value={activeVersion}
               onChange={setActiveVersion}
               options={[
                { label: '清除选择 (快照)', value: '' },
                ...snapshots.map(v => ({ label: v, value: v }))
               ]}
            />
          )}
        </div>
      </div>
      
      {/* 行 3：结果统计 */}
      <div className="text-[11px] text-gray-500 font-minecraft ml-[72px]">
        共找到 <span className="text-white font-bold mx-0.5">{versionsCount}</span> 个匹配的文件
      </div>
    </div>
  );
};