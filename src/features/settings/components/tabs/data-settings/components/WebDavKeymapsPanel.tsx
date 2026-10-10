import { Clock, Keyboard, Loader2, RefreshCw, Trash2 } from 'lucide-react';

import { OreButton } from '../../../../../../ui/primitives/OreButton';
import type { KeyboardProfileListItem, WebDavArrowHandler } from './webDavManageTypes';

interface WebDavKeymapsPanelProps {
  profiles: KeyboardProfileListItem[];
  isLoading: boolean;
  isSyncing: boolean;
  configured: boolean;
  autoSyncEnabled: boolean;
  onSync: () => void;
  onDelete: (item: KeyboardProfileListItem) => void;
  onArrowPress: WebDavArrowHandler;
}

export const WebDavKeymapsPanel = ({
  profiles,
  isLoading,
  isSyncing,
  configured,
  autoSyncEnabled,
  onSync,
  onDelete,
  onArrowPress,
}: WebDavKeymapsPanelProps) => (
  <div className="flex flex-col gap-3 font-minecraft">
    <div className="flex flex-col gap-3 border-2 border-[#1E1E1F] bg-[#242526] p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">按键配置同步</h3>
          <p className="mt-1 text-xs text-[#B1B2B5]">
            同步本地自定义键盘映射预设与 WebDAV 云端。
          </p>
        </div>
        <OreButton
          variant="primary"
          onClick={onSync}
          disabled={isSyncing || isLoading || !configured}
          focusKey="webdav-manage-keymap-sync"
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
          <span className="text-[#8E8F93]">云端保存路径：</span>
          <span className="font-mono text-white">PiLauncherSync/keyboard/user</span>
        </div>
        <div>
          <span className="text-[#8E8F93]">本地配置路径：</span>
          <span className="font-mono text-white">config/keyboard/user</span>
        </div>
        <div>
          <span className="text-[#8E8F93]">本地配置总数：</span>
          <span className="text-white font-bold">{profiles.length} 个</span>
        </div>
        <div>
          <span className="text-[#8E8F93]">自动同步状态：</span>
          <span className={autoSyncEnabled ? 'text-ore-green font-bold' : 'text-yellow-500'}>
            {autoSyncEnabled ? '已开启' : '未开启'}
          </span>
        </div>
      </div>
    </div>

    {isLoading && profiles.length === 0 ? (
      <div className="flex items-center justify-center py-12 text-ore-green">
        <Loader2 size={32} className="animate-spin" />
      </div>
    ) : profiles.length === 0 ? (
      <div className="border-2 border-[#1E1E1F] bg-[#242526] p-6 text-center text-sm text-[#B1B2B5]">
        暂无自定义按键配置预设。
      </div>
    ) : (
      <div className="flex flex-col gap-2 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-[#242526]/50 flex items-center justify-center z-10">
            <Loader2 size={24} className="animate-spin text-ore-green" />
          </div>
        )}
        <div className="px-1 text-xs font-bold text-[#8E8F93] font-minecraft">按键配置列表</div>
        {profiles.map((item) => (
          <div
            key={item.filename}
            className="flex items-center justify-between border-2 border-[#1E1E1F] bg-[#242526] p-3 transition-colors hover:border-ore-green/30"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[#1E1E1F] bg-black/20 text-[#5DADEC]">
                <Keyboard size={20} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-white">
                  {item.profile.name || item.filename}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#B1B2B5]">
                  {item.profile.author && <span>作者: {item.profile.author}</span>}
                  {item.profile.version && <span>版本: {item.profile.version}</span>}
                  {item.profile.updatedAt && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {item.profile.updatedAt}
                    </span>
                  )}
                </div>
                {item.profile.description && (
                  <div className="mt-1 truncate text-xs text-[#8E8F93]">
                    {item.profile.description}
                  </div>
                )}
              </div>
            </div>

            <div className="ml-4 flex shrink-0 items-center gap-2">
              <OreButton
                variant="danger"
                size="sm"
                onClick={() => onDelete(item)}
                focusKey={`webdav-manage-keymap-delete-${item.filename}`}
                onArrowPress={onArrowPress}
                disabled={isLoading}
              >
                <Trash2 size={14} className="mr-1" />
                删除
              </OreButton>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);
