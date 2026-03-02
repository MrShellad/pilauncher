import React from 'react';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreToggleButton } from '../../../../ui/primitives/OreToggleButton';

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
  return (
    <div className="flex flex-col p-4 lg:p-5 border-b border-white/5 bg-black/20 gap-3 shadow-md z-20 flex-shrink-0">
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

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start lg:items-center gap-3">
          <span className="text-sm font-minecraft text-gray-400 flex-shrink-0 w-[70px] mt-1 lg:mt-0">游戏版本:</span>
          <div className="flex flex-1 gap-2 overflow-x-auto custom-scrollbar pb-1.5 pt-1 items-center">
            <FocusItem onEnter={() => setActiveVersion('')}>
              {({ ref, focused }) => (
                <button ref={ref as any} onClick={() => setActiveVersion('')} className={`px-3 py-1.5 rounded-sm font-minecraft text-xs transition-all whitespace-nowrap border flex-shrink-0 outline-none ${activeVersion === '' ? 'bg-ore-green text-black border-ore-green shadow-[0_0_10px_rgba(74,222,128,0.3)]' : 'bg-black/40 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/30'} ${focused ? 'ring-2 ring-white scale-[1.05] z-10 brightness-125' : ''}`}>
                  所有版本
                </button>
              )}
            </FocusItem>
            {availableVersions.map((v: string) => (
              <FocusItem key={v} onEnter={() => setActiveVersion(v)}>
                {({ ref, focused }) => (
                  <button ref={ref as any} onClick={() => setActiveVersion(v)} className={`px-3 py-1.5 rounded-sm font-minecraft text-xs transition-all whitespace-nowrap border flex-shrink-0 outline-none ${activeVersion === v ? 'bg-ore-green text-black border-ore-green shadow-[0_0_10px_rgba(74,222,128,0.3)]' : 'bg-black/40 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/30'} ${focused ? 'ring-2 ring-white scale-[1.05] z-10 brightness-125' : ''}`}>
                    {v}
                  </button>
                )}
              </FocusItem>
            ))}
          </div>
        </div>
        <div className="text-[11px] text-gray-500 font-minecraft ml-[82px]">
          共找到 <span className="text-white">{versionsCount}</span> 个匹配的版本文件
        </div>
      </div>
    </div>
  );
};