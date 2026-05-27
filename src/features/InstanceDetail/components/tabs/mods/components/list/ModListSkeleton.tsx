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
    className={`animate-pulse rounded-[3px] ${className}`}
    style={{
      backgroundColor: listTheme === 'light' ? 'rgba(30,30,31,0.16)' : 'rgba(255,255,255,0.09)'
    }}
  />
);

export const ModListSkeleton: React.FC<ModListSkeletonProps> = ({
  listTheme,
  rowCount = 9
}) => {
  const isLightTheme = listTheme === 'light';
  const rowBackgroundClass = isLightTheme ? 'bg-[#C6C8CB]' : 'bg-[#1A1D24]';
  const borderClass = isLightTheme ? 'border-[#A9ABAE]' : 'border-[#242B38]';
  const headerClass = isLightTheme
    ? 'border-[#1E1E1F] bg-[#A9ABAE]'
    : 'border-[#242B38] bg-[#111318]';

  return (
    <div className="h-full overflow-hidden px-2 pb-1 pt-[2px]" aria-busy="true" aria-label="正在加载模组">
      <div className={`mb-1 flex h-10 items-center border-b px-3 ${headerClass}`}>
        <SkeletonBlock className="h-4 w-28" listTheme={listTheme} />
        <SkeletonBlock className="ml-4 h-3 w-44" listTheme={listTheme} />
      </div>

      {Array.from({ length: rowCount }).map((_, index) => (
        <div
          key={index}
          className={`grid min-h-[5.5rem] ${MOD_LIST_TABLE_GRID_CLASS} items-center gap-2 overflow-hidden border-b px-2 ${borderClass} ${rowBackgroundClass}`}
        >
          <div className="flex items-center justify-center">
            <SkeletonBlock className="h-4 w-4" listTheme={listTheme} />
          </div>

          <div className="flex min-w-0 items-center gap-[11px] pl-2">
            <SkeletonBlock className="h-[3.25rem] w-[3.25rem]" listTheme={listTheme} />
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="h-4 w-3/4" listTheme={listTheme} />
              <SkeletonBlock className="mt-2 h-3 w-1/2" listTheme={listTheme} />
            </div>
          </div>

          <SkeletonBlock className="h-4 w-4/5" listTheme={listTheme} />

          <div>
            <SkeletonBlock className="h-5 w-20" listTheme={listTheme} />
            <SkeletonBlock className="mt-2 h-4 w-28" listTheme={listTheme} />
          </div>

          <div className="flex justify-end gap-2 pr-5">
            <SkeletonBlock className="h-8 w-8" listTheme={listTheme} />
            <SkeletonBlock className="h-8 w-8" listTheme={listTheme} />
            <SkeletonBlock className="h-8 w-8" listTheme={listTheme} />
          </div>
        </div>
      ))}
    </div>
  );
};
