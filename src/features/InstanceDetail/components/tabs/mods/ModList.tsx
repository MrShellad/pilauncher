// /src/features/InstanceDetail/components/tabs/mods/ModList.tsx
import React from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { OreList } from '../../../../../ui/primitives/OreList';
import { Blocks, Loader2, RefreshCw } from 'lucide-react';
import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import type { ModMeta } from '../../../logic/modService';

interface ModListProps {
  mods: ModMeta[];
  isLoading: boolean;
  onSelectMod: (mod: ModMeta) => void;
}

export const ModList: React.FC<ModListProps> = ({ mods, isLoading, onSelectMod }) => {

  // ✅ 修复 1：严格区分【首次加载】与【后台热刷新】
  // 只有当完全没有数据时，才显示巨大的居中加载条
  if (isLoading && mods.length === 0) {
    return <div className="flex justify-center py-12 text-ore-green"><Loader2 size={32} className="animate-spin" /></div>;
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0">

      {/* ✅ 优化：如果是后台刷新（且有数据），在右上角给一个小提示，而不销毁列表 */}
      {isLoading && mods.length > 0 && (
        <div className="absolute top-0 right-6 z-50 flex items-center bg-[#2A2A2C] px-3 py-1.5 rounded-b-md shadow-lg border border-t-0 border-[#313233]">
          <RefreshCw size={14} className="animate-spin text-ore-green mr-2" />
          <span className="text-xs text-gray-300 font-minecraft">正在同步目录...</span>
        </div>
      )}

      <FocusBoundary
        id="mod-list-grid"
        defaultFocusKey="mod-item-0"
        className="flex-1 min-h-0 grid content-start grid-cols-1 xl:grid-cols-2 gap-0 overflow-y-auto px-2 pb-4 custom-scrollbar"
      >
        {mods.map((mod, i) => {
          const displayName = mod.name || mod.networkInfo?.title || mod.fileName;
          const displayDesc = mod.description || mod.networkInfo?.description || "没有提供该模组的描述。";

          // ✅ 修复 2：采用绝对稳定的缓存 Key
          // 优先修改时间 -> 其次文件大小 -> 最后文件名。坚决不用 Date.now()！
          const cacheKey = mod.modifiedAt || mod.fileSize || mod.fileName;
          const iconUrl = mod.iconAbsolutePath
            ? `${convertFileSrc(mod.iconAbsolutePath)}?t=${cacheKey}`
            : (mod.networkIconUrl || mod.networkInfo?.icon_url);

          return (
            <OreList
              key={mod.fileName} // ✅ React 渲染树复用：使用文件名做 key，不要用索引 i，防止顺序变动导致 DOM 错乱
              focusKey={`mod-item-${i}`}
              isInactive={!mod.isEnabled}
              onClick={() => onSelectMod(mod)}
              title={
                <div className="flex items-center">
                  <span className="truncate">{displayName}</span>
                  {mod.version && (
                    <span className="text-xs font-normal bg-[#2A2A2C] text-ore-green px-1.5 py-0.5 rounded ml-2 shadow-inner flex-shrink-0 border border-[#1E1E1F]">
                      v{mod.version}
                    </span>
                  )}
                </div>
              }
              subtitle={mod.fileName}
              content={<div className="truncate">{displayDesc}</div>}
              leading={
                mod.isFetchingNetwork ? (
                  <Loader2 size={24} className="animate-spin text-ore-text-muted" />
                ) : iconUrl ? (
                  <img src={iconUrl} alt="icon" className="w-full h-full object-cover rounded-sm border-[2px] border-[#18181B] shadow-md" />
                ) : (
                  <Blocks size={32} className="text-ore-text-muted/50 drop-shadow-md" />
                )
              }
            />
          );
        })}
      </FocusBoundary>
    </div>
  );
};
