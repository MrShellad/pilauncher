import React from 'react';
import { Blocks, HardDrive, Link as LinkIcon, Play, Plus, Server } from 'lucide-react';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../ui/primitives/OreDropdown';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../ui/focus/useLinearNavigation';
import type { OnlineServer } from '../types';
import { useServerBindModal } from '../hooks/useServerBindModal';

interface ServerBindModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: OnlineServer | null;
}

export const ServerBindModal: React.FC<ServerBindModalProps> = ({ isOpen, onClose, server }) => {
  const {
    boundInstance,
    handleBind,
    handleCreateNew,
    handleDownloadModpack,
    handleLaunchBoundInstance,
    instances,
    isBinding,
    isCheckingBinding,
    isDownloading,
    isLaunching,
    isLoading,
    isModServer,
    launchTargetName,
    selectedInstanceId,
    setSelectedInstanceId,
  } = useServerBindModal({
    isOpen,
    onClose,
    server,
  });

  const focusOrder = React.useMemo(() => {
    if (isCheckingBinding) return [];
    if (boundInstance) return ['modal-launch-cancel', 'modal-launch-action'];
    if (isModServer && server?.modpackUrl) return ['modal-mod-cancel', 'modal-mod-action'];
    if (!instances.length) return ['modal-bind-create', 'modal-bind-cancel'];
    return ['modal-bind-dropdown', 'modal-bind-create', 'modal-bind-cancel', 'modal-bind-action'];
  }, [isCheckingBinding, boundInstance, isModServer, server, instances.length]);

  const { handleLinearArrow } = useLinearNavigation(focusOrder, focusOrder[0]);

  if (!server) return null;

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={boundInstance ? '启动已关联实例' : isModServer ? '部署专属客户端' : '服务器快速绑定与直连'}
      className="w-[500px]"
      hideCloseButton
      defaultFocusKey={focusOrder[0]}
    >
      <div className="flex flex-col px-4 pt-2 pb-4">
        {isCheckingBinding ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Server size={32} className="mb-4 text-[#6CC349]" />
            <p className="font-minecraft text-sm text-white">正在检查服务器关联实例...</p>
          </div>
        ) : boundInstance ? (
          <div className="flex flex-col text-center">
            <Play size={32} className="mx-auto mb-4 text-[#6CC349] drop-shadow-[0_0_8px_rgba(108,195,73,0.8)]" />
            <h3 className="mb-1 font-minecraft text-xl text-white ore-text-shadow">是否启动游戏</h3>
            <p className="mb-6 px-2 font-minecraft text-xs text-[#A0A0A0] leading-relaxed">
              服务器 <span className="text-white">{server.name}</span> 已关联到实例
              <span className="text-white"> {launchTargetName}</span>。
              {boundInstance.version ? ` 当前版本为 ${boundInstance.version}` : ''}
              {boundInstance.loader ? `，加载器为 ${boundInstance.loader}` : ''}。
            </p>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="flex items-center border border-white/5 bg-black/30 p-3">
                <Blocks size={24} className="mr-3 opacity-80 text-blue-400" />
                <div className="flex flex-col text-left">
                  <span className="text-[10px] uppercase tracking-wider text-ore-text-muted">目标实例</span>
                  <span className="font-minecraft text-white truncate">{launchTargetName}</span>
                </div>
              </div>
              <div className="flex items-center border border-white/5 bg-black/30 p-3">
                <LinkIcon size={24} className="mr-3 opacity-80 text-orange-400" />
                <div className="flex min-w-0 flex-col text-left">
                  <span className="text-[10px] uppercase tracking-wider text-ore-text-muted">服务器地址</span>
                  <span className="font-minecraft text-white truncate">{server.address || '内部地址'}</span>
                </div>
              </div>
            </div>

            <div className="flex w-full space-x-4">
              <OreButton variant="secondary" size="full" onClick={onClose} disabled={isLaunching} focusKey="modal-launch-cancel" onArrowPress={handleLinearArrow}>
                取消
              </OreButton>
              <OreButton variant="primary" size="full" onClick={handleLaunchBoundInstance} disabled={isLaunching} focusKey="modal-launch-action" onArrowPress={handleLinearArrow}>
                <div className="flex items-center justify-center">
                  <Play size={16} className="mr-2 flex-shrink-0" />
                  <span>{isLaunching ? '启动中...' : '启动游戏'}</span>
                </div>
              </OreButton>
            </div>
          </div>
        ) : isModServer && server.modpackUrl ? (
          <div className="flex flex-col">
            <Server size={32} className="mx-auto mb-4 text-ore-green drop-shadow-[0_0_8px_rgba(108,195,73,0.8)]" />
            <h3 className="mb-1 text-center font-minecraft text-xl font-bold text-white ore-text-shadow">部署：{server.name}</h3>
            <p className="mb-6 px-2 text-center font-minecraft text-xs leading-relaxed text-[#A0A0A0]">
              这是一个 Mod 专属服务器，PiLauncher 将一键为您自动部署对应客户端。
              <br />
              下载导入完成后，实例会自动写入服务器绑定信息。
            </p>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="flex items-center border border-white/5 bg-black/30 p-3">
                <Blocks size={24} className="mr-3 opacity-80 text-blue-400" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-ore-text-muted">游戏版本</span>
                  <span className="font-minecraft text-white truncate">Minecraft {server.versions?.join(', ') || '未知'}</span>
                </div>
              </div>
              <div className="flex items-center overflow-hidden border border-white/5 bg-black/30 p-3">
                <LinkIcon size={24} className="mr-3 opacity-80 text-orange-400" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-ore-text-muted">服务器地址</span>
                  <span className="font-minecraft text-white truncate">{server.address || '内部地址'}</span>
                </div>
              </div>
            </div>

            <div className="mt-2 flex w-full space-x-4">
              <OreButton variant="secondary" size="full" onClick={onClose} focusKey="modal-mod-cancel" onArrowPress={handleLinearArrow}>
                暂不部署
              </OreButton>
              <OreButton variant="primary" size="full" onClick={handleDownloadModpack} disabled={isDownloading} focusKey="modal-mod-action" onArrowPress={handleLinearArrow}>
                <div className="flex items-center justify-center">
                  <HardDrive size={16} className="mr-2 flex-shrink-0" />
                  <span>{isDownloading ? '准备中...' : '开始部署'}</span>
                </div>
              </OreButton>
            </div>
          </div>
        ) : (
          <div className="flex flex-col text-center">
            <Server size={32} className="mx-auto mb-4 text-[#6CC349] drop-shadow-[0_0_8px_rgba(108,195,73,0.8)]" />
            <h3 className="mb-1 font-minecraft text-xl font-bold text-white ore-text-shadow">绑定到实例：{server.name}</h3>
            <p className="mb-6 px-2 font-minecraft text-xs text-[#A0A0A0]">
              绑定后，启动该实例将通过快速连接功能，直接连接到该服务器。
            </p>

            <div className="relative mb-6 flex w-full space-x-2">
              <div className="flex flex-1 flex-col text-left">
                <label className="mb-2 font-minecraft text-sm text-white/80">选择要绑定的本地实例</label>
                {isLoading ? (
                  <div className="flex h-10 items-center border border-white/10 bg-black/40 px-4 text-sm text-white/50">检索中...</div>
                ) : (
                  <OreDropdown
                    value={selectedInstanceId}
                    onChange={setSelectedInstanceId}
                    options={
                      instances.length > 0 
                        ? instances.map(inst => ({ value: inst.id, label: `${inst.name} (${inst.version} ${inst.loader})` }))
                        : [{ value: '', label: '无匹配版本的实例' }]
                    }
                    focusKey="modal-bind-dropdown"
                    onArrowPress={handleLinearArrow}
                    disabled={instances.length === 0}
                  />
                )}
              </div>
            </div>

            <div className="mb-6 flex justify-center">
              <FocusItem focusKey="modal-bind-create" onArrowPress={handleLinearArrow} onEnter={handleCreateNew}>
                {({ ref, focused }) => (
                  <button
                    ref={ref as any}
                    onClick={handleCreateNew}
                    tabIndex={-1}
                    className={`flex items-center text-sm font-minecraft transition-colors outline-none
                      ${focused ? 'text-white underline drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'text-ore-green hover:text-white'}
                    `}
                  >
                    <Plus size={16} className="mr-1" />
                    没有合适的？新建实例并绑定
                  </button>
                )}
              </FocusItem>
            </div>

            <div className="flex w-full space-x-4">
              <OreButton variant="secondary" size="full" onClick={onClose} focusKey="modal-bind-cancel" onArrowPress={handleLinearArrow}>
                取消
              </OreButton>
              <OreButton
                variant="primary"
                size="full"
                onClick={handleBind}
                disabled={instances.length === 0 || isBinding || !selectedInstanceId}
                focusKey="modal-bind-action"
                onArrowPress={handleLinearArrow}
              >
                <div className="flex items-center justify-center">
                  <LinkIcon size={16} className="mr-2 flex-shrink-0" />
                  <span>{isBinding ? '绑定中...' : '绑定并直连'}</span>
                </div>
              </OreButton>
            </div>
          </div>
        )}
      </div>
    </OreModal>
  );
};
