import { Loader2, Package, Palette, RefreshCw, Sparkles } from 'lucide-react';

import { OreButton } from '../../../../../../ui/primitives/OreButton';
import type { StarredItem, WebDavArrowHandler } from './webDavManageTypes';

interface WebDavFavoritesPanelProps {
  items: StarredItem[];
  isLoading: boolean;
  isSyncing: boolean;
  configured: boolean;
  autoSyncEnabled: boolean;
  onSync: () => void;
  onArrowPress: WebDavArrowHandler;
}

export const WebDavFavoritesPanel = ({
  items,
  isLoading,
  isSyncing,
  configured,
  autoSyncEnabled,
  onSync,
  onArrowPress,
}: WebDavFavoritesPanelProps) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-col gap-3 border-2 border-[#1E1E1F] bg-[#242526] p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-minecraft text-sm font-bold text-white">收藏夹同步</h3>
          <p className="mt-1 text-xs text-[#B1B2B5]">
            同步本地与 WebDAV 云端的收藏数据（包括本地导入的光影与资源包文件）。
          </p>
        </div>
        <OreButton
          variant="primary"
          onClick={onSync}
          disabled={isSyncing || isLoading || !configured}
          focusKey="webdav-manage-fav-sync"
          onArrowPress={onArrowPress}
        >
          {isSyncing ? (
            <Loader2 size={14} className="mr-2 animate-spin" />
          ) : (
            <RefreshCw size={14} className="mr-2" />
          )}
          立即同步
        </OreButton>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-4 border-t border-[#1E1E1F] pt-3 text-xs text-[#B1B2B5]">
        <div>
          <span className="text-[#8E8F93]">云端元数据路径：</span>
          <span className="font-mono text-white">PiLauncherSync/favorites</span>
        </div>
        <div>
          <span className="text-[#8E8F93]">云端物理文件路径：</span>
          <span className="font-mono text-white">PiLauncherSync/library</span>
        </div>
        <div>
          <span className="text-[#8E8F93]">本地收藏总数：</span>
          <span className="text-white font-bold">{items.length} 项</span>
        </div>
        <div>
          <span className="text-[#8E8F93]">自动同步状态：</span>
          <span className={autoSyncEnabled ? 'text-ore-green font-bold' : 'text-yellow-500'}>
            {autoSyncEnabled ? '已开启' : '未开启'}
          </span>
        </div>
      </div>
    </div>

    {isLoading && items.length === 0 ? (
      <div className="flex items-center justify-center py-12 text-ore-green">
        <Loader2 size={32} className="animate-spin" />
      </div>
    ) : items.length === 0 ? (
      <div className="border-2 border-[#1E1E1F] bg-[#242526] p-6 text-center text-sm text-[#B1B2B5]">
        暂无收藏项。
      </div>
    ) : (
      <div className="flex flex-col gap-2 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-[#242526]/50 flex items-center justify-center z-10">
            <Loader2 size={24} className="animate-spin text-ore-green" />
          </div>
        )}
        <div className="px-1 text-xs font-bold text-[#8E8F93] font-minecraft">收藏项列表</div>
        {items.map((item) => {
          const isCustom = item.source === 'custom';
          const isShader = item.type === 'shader';
          const isResourcePack = item.type === 'resourcepack';

          let icon = <Package size={16} className="text-blue-400" />;
          if (isShader) {
            icon = <Sparkles size={16} className="text-yellow-400" />;
          } else if (isResourcePack) {
            icon = <Palette size={16} className="text-pink-400" />;
          }

          return (
            <div
              key={item.id}
              className="flex items-center justify-between border-2 border-[#1E1E1F] bg-[#242526] p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-[#1E1E1F] bg-black/20">
                  {icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-white font-minecraft">
                      {item.title || item.id}
                    </span>
                    {isCustom ? (
                      <span className="shrink-0 bg-[#2b3528]/80 text-ore-green border border-ore-green/30 text-[10px] px-1 py-0.5 rounded font-minecraft">
                        本地导入
                      </span>
                    ) : (
                      <span className="shrink-0 bg-blue-950/80 text-blue-300 border border-blue-800/30 text-[10px] px-1 py-0.5 rounded font-minecraft capitalize">
                        {item.source}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-[#8E8F93] truncate">
                    作者: {item.author || '未知'} • 类型: {item.type}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                {isCustom ? (
                  <span className="text-xs text-ore-green font-minecraft">云端文件已同步</span>
                ) : (
                  <span className="text-xs text-[#B1B2B5] font-minecraft">云端元数据已同步</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
