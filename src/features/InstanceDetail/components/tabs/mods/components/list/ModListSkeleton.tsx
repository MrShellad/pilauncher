import React from 'react';

import { MOD_LIST_TABLE_GRID_CLASS, type ModListTheme } from '../../modListShared';

interface ModListSkeletonProps {
  listTheme: ModListTheme;
  rowCount?: number;
}

const SkeletonBlock: React.FC<{ className: string; listTheme: ModListTheme }> = ({
  className,
  listTheme
}) => (
  <div
    className={`animate-pulse ${className}`}
    style={{
      backgroundColor: listTheme === 'light' ? 'rgba(30,30,31,0.16)' : 'rgba(255,255,255,0.09)'
    }}
  />
);

export const ModListSkeleton: React.FC<ModListSkeletonProps> = ({
  listTheme,
  rowCount = 10
}) => {
  const isLightTheme = listTheme === 'light';
  const rowBackgroundClass = isLightTheme ? 'bg-[#C6C8CB]' : 'bg-[#181C25]';
  const borderClass = isLightTheme ? 'border-b-[#A9ABAE]' : 'border-b-[#1E2430]';
  const headerClass = isLightTheme
    ? 'border-[#1E1E1F] bg-[#B8BBC2]'
    : 'border-[#1E1E1F] bg-[#1A1F29]';

  return (
    <div className="h-full overflow-hidden px-2 pb-1 pt-[2px]" aria-busy="true" aria-label="正在加载模组">
      <div className={`mb-1 flex h-8 items-center border-[2px] px-3 ${headerClass}`}>
        <SkeletonBlock className="h-3 w-28" listTheme={listTheme} />
        <SkeletonBlock className="ml-4 h-3 w-44" listTheme={listTheme} />
      </div>

      {Array.from({ length: rowCount }).map((_, index) => (
        <div
          key={index}
          className={`grid min-h-[4rem] ${MOD_LIST_TABLE_GRID_CLASS} items-center gap-2.5 overflow-hidden border-b-[2px] px-2 py-1.5 ${borderClass} ${rowBackgroundClass}`}
        >
          <div className="flex items-center justify-center">
            <SkeletonBlock className="h-4 w-4" listTheme={listTheme} />
          </div>

          <div className="flex items-center justify-center">
            <SkeletonBlock className="h-12 w-12 border-[2px] border-[#1E1E1F]" listTheme={listTheme} />
          </div>

          <div className="min-w-0 pr-2">
            <SkeletonBlock className="h-4 w-3/4" listTheme={listTheme} />
            <SkeletonBlock className="mt-1.5 h-3 w-1/2" listTheme={listTheme} />
          </div>

          <div className="flex items-center gap-1">
            <SkeletonBlock className="h-4 w-12" listTheme={listTheme} />
          </div>

          <div className="min-w-0">
            <SkeletonBlock className="h-3 w-10" listTheme={listTheme} />
          </div>

          <div className="flex justify-end gap-1.5 pr-1">
            <SkeletonBlock className="h-7 w-7" listTheme={listTheme} />
            <SkeletonBlock className="h-7 w-7" listTheme={listTheme} />
          </div>
        </div>
      ))}
    </div>
  );
};
