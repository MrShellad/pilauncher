// /src/features/InstanceDetail/components/tabs/mods/ModList.tsx
import React from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { OreList } from '../../../../../ui/primitives/OreList';
import { Blocks, Loader2 } from 'lucide-react';
import type { ModMeta } from '../../../logic/modService';

interface ModListProps {
  mods: ModMeta[];
  isLoading: boolean;
  onSelectMod: (mod: ModMeta) => void;
}

export const ModList: React.FC<ModListProps> = ({ mods, isLoading, onSelectMod }) => {
  if (isLoading) {
    return <div className="flex justify-center py-12 text-ore-green"><Loader2 size={32} className="animate-spin" /></div>;
  }

  return (
    // ✅ 修复 1：增加 px-2。为滚动容器撑开左右安全距离，防止内部的 scale/ring 特效被 overflow-y-auto 切割截断！
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-0 overflow-y-auto px-2 pb-4 custom-scrollbar">
      {mods.map((mod, i) => {
        const displayName = mod.name || mod.networkInfo?.title || mod.fileName;
        const displayDesc = mod.description || mod.networkInfo?.description || "没有提供该模组的描述。";
        const iconUrl = mod.iconAbsolutePath 
          ? `${convertFileSrc(mod.iconAbsolutePath)}?t=${Date.now()}` 
          : (mod.networkIconUrl || mod.networkInfo?.icon_url);

        return (
          <OreList
            key={i}
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
            description={displayDesc}
            icon={
              mod.isFetchingNetwork ? (
                <Loader2 size={24} className="animate-spin text-ore-text-muted" />
              ) : iconUrl ? (
                // ✅ 修复 3：移除之前加的 p-2，改回 object-cover，让图片完美填满整个 w-20/h-20 的容器，消除黑边
                <img src={iconUrl} alt="icon" className="w-full h-full object-cover" />
              ) : (
                <Blocks size={32} className="text-ore-text-muted/50 drop-shadow-md" />
              )
            }
          />
        );
      })}
    </div>
  );
};