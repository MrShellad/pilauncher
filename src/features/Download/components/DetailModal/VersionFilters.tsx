// /src/features/Download/components/DetailModal/VersionFilters.tsx
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

    const top5 = sortedMajors.slice(0, 5); 
    const rest = sortedMajors.slice(5);

    const moreRels: string[] = [];
    rest.forEach(m => {
      groups[m].sort(versionSortDesc);
      moreRels.push(...groups[m]);
    });

    top5.forEach(m => groups[m].sort(versionSortDesc));
    snaps.sort(versionSortDesc); 

    return { majorGroups: groups, topMajors: top5, moreReleases: moreRels, snapshots: snaps };
  }, [availableVersions]);

  return (
    // ✅ 修复 1：增加 relative 属性，确立更高的层叠上下文基准，防止面板掉入下方的 VersionList 中
    <div className="flex flex-col p-4 lg:p-5 border-b border-white/5 bg-black/20 gap-3 shadow-md z-20 relative flex-shrink-0">
      
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-sm font-minecraft text-gray-400 flex-shrink-0 w-[70px]">引导器:</span>
        <FocusItem 
          onEnter={() => {
            if (!loaderOptions || loaderOptions.length === 0) return;
            const currentIndex = loaderOptions.findIndex((opt: any) => opt.value === activeLoader);
            const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % loaderOptions.length;
            setActiveLoader(loaderOptions[nextIndex].value);
          }}
        >
          {({ ref, focused }) => (
            <div ref={ref as any} className={`w-full max-w-[800px] h-9 transition-all ${focused ? 'ring-2 ring-white rounded-sm scale-[1.01] brightness-110' : ''}`}>
              <OreToggleButton options={loaderOptions} value={activeLoader} onChange={setActiveLoader} className="!m-0 h-full [&>.ore-toggle-btn-group]:!h-full text-xs" />
            </div>
          )}
        </FocusItem>
      </div>

      <div className="flex flex-col gap-2 mt-1 lg:mt-0">
        <div className="flex items-start lg:items-center gap-3">
          <span className="text-sm font-minecraft text-gray-400 flex-shrink-0 w-[70px] mt-1 lg:mt-0">游戏版本:</span>
          
          {/* ✅ 修复 2：彻底移除 overflow-x-auto，改用 flex-wrap！这样子元素再长都会自动换行，且不会截断悬浮层 */}
          <div className="flex flex-1 gap-2.5 flex-wrap pb-2 items-center min-h-[40px]">
            
            <FocusItem onEnter={() => setActiveVersion('')}>
              {({ ref, focused }) => (
                <button 
                  ref={ref as any} onClick={() => setActiveVersion('')} 
                  className={`h-[34px] px-3 rounded-sm font-minecraft text-xs font-bold transition-all whitespace-nowrap border flex-shrink-0 outline-none 
                  ${activeVersion === '' ? 'bg-ore-green text-black border-ore-green shadow-[0_0_10px_rgba(74,222,128,0.3)]' : 'bg-[#1E1E1F] border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/30'} 
                  ${focused ? 'ring-2 ring-white scale-[1.05] z-10 brightness-125' : ''}`}
                >
                  清除过滤
                </button>
              )}
            </FocusItem>

            {topMajors.map(major => (
              <OreDropdown
                key={major}
                searchable
                className="w-28 h-[34px] text-xs font-minecraft" 
                placeholder={`${major}.x`}
                value={activeVersion}
                onChange={setActiveVersion}
                options={majorGroups[major].map(v => ({ label: v, value: v }))}
              />
            ))}

            {moreReleases.length > 0 && (
              <OreDropdown
                 searchable
                 className="w-32 h-[34px] text-xs font-minecraft"
                 placeholder="更多历史版本"
                 value={activeVersion}
                 onChange={setActiveVersion}
                 options={moreReleases.map(v => ({ label: v, value: v }))}
              />
            )}

            {snapshots.length > 0 && (
              <OreDropdown
                 searchable
                 className="w-32 h-[34px] text-xs font-minecraft"
                 placeholder="快照 / 预览版"
                 value={activeVersion}
                 onChange={setActiveVersion}
                 options={snapshots.map(v => ({ label: v, value: v }))}
              />
            )}
          </div>
        </div>
        
        <div className="text-[11px] text-gray-500 font-minecraft ml-[82px] mb-1">
          共找到 <span className="text-white font-bold mx-0.5">{versionsCount}</span> 个匹配的有效文件，已按大版本为您归类梳理。
        </div>
      </div>
    </div>
  );
};