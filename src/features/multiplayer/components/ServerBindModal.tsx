import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Link as LinkIcon, Server, Blocks, HardDrive, Plus } from 'lucide-react';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreButton } from '../../../ui/primitives/OreButton';
import type { OnlineServer } from '../types';
import { useLauncherStore } from '../../../store/useLauncherStore';

interface InstanceItem {
  id: string;
  name: string;
  version: string;
  loader: string;
}

interface ServerBindModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: OnlineServer | null;
}

export const ServerBindModal: React.FC<ServerBindModalProps> = ({ isOpen, onClose, server }) => {
  const setActiveTab = useLauncherStore(state => state.setActiveTab);

  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBinding, setIsBinding] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (isOpen && server) {
      void fetchCompatibleInstances();
    }
  }, [isOpen, server]);

  const fetchCompatibleInstances = async () => {
    try {
      setIsLoading(true);
      const gameVersions = server?.versions || [];
      const data = await invoke<InstanceItem[]>('get_compatible_instances', {
        gameVersions,
        loaders: [],
        ignoreLoader: true
      });
      setInstances(data);
      if (data.length > 0) {
        setSelectedInstanceId(data[0].id);
      }
    } catch (e) {
      console.error('获取兼容实例失败:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBind = async () => {
    if (!server || !selectedInstanceId) return;

    try {
      setIsBinding(true);

      const ipMatch = server.address?.match(/^([^:]+)(?::(\d+))?$/);
      const ip = ipMatch ? ipMatch[1] : server.address || '';
      const port = ipMatch && ipMatch[2] ? parseInt(ipMatch[2], 10) : 25565;

      await invoke('bind_server_to_instance', {
        instanceId: selectedInstanceId,
        serverBinding: {
          uuid: server.id,
          name: server.name,
          ip,
          port
        }
      });

      onClose();
      // Optional: Prompt to start game right away
      if (window.confirm(`绑定成功！是否立即启动 [${server.name}]?`)) {
        setActiveTab('instances');
        // You could dispatch a global event or store an action to launch this instance
      }
    } catch (error) {
      console.error('绑定失败:', error);
      alert(`绑定失败: ${error}`);
    } finally {
      setIsBinding(false);
    }
  };

  const handleDownloadModpack = async () => {
    if (!server || !server.modpackUrl) return;
    try {
      setIsDownloading(true);
      const ipMatch = server.address?.match(/^([^:]+)(?::(\d+))?$/);
      const ip = ipMatch ? ipMatch[1] : server.address || '';
      const port = ipMatch && ipMatch[2] ? parseInt(ipMatch[2], 10) : 25565;

      await invoke('download_and_import_modpack', {
        url: server.modpackUrl,
        instanceName: server.name,
        serverBinding: {
          uuid: server.id,
          name: server.name,
          ip,
          port
        }
      });
      onClose();
      setActiveTab('downloads');
    } catch (error) {
      console.error('触发下载失败:', error);
      alert(`下载触发失败: ${error}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCreateNew = () => {
    if (!server) return;
    useLauncherStore.getState().setPendingServerBinding(server);
    onClose();
    setActiveTab('new-instance');
  };

  if (!server) return null;

  const isModServer = server.isModded || server.serverType?.toLowerCase() === 'modded';

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={isModServer ? "专属服务器客户端部署" : "服务器快速绑定与直连"}
      className="w-[500px]"
    >
      <div className="flex flex-col pt-2 pb-4 px-4">
        {isModServer && server.modpackUrl ? (
          /* ================= MODDED VIEW ================= */
          <div className="flex flex-col">
            <Server size={32} className="text-ore-green mx-auto mb-4 drop-shadow-[0_0_8px_rgba(108,195,73,0.8)]" />
            <h3 className="text-white font-minecraft text-center font-bold text-xl mb-1 ore-text-shadow">
              部署：{server.name}
            </h3>
            <p className="text-[#A0A0A0] text-center font-minecraft text-xs mb-6 px-2 leading-relaxed">
              这是一个 Mod 专属服务器，PiLauncher 将一键为您全自动部署最新整合包。<br />
              下载导入完成后，您将自动获得一键直连能力。
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-black/30 p-3 flex items-center border border-white/5">
                <Blocks size={24} className="text-blue-400 mr-3 opacity-80" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-ore-text-muted uppercase tracking-wider">游戏版本</span>
                  <span className="font-minecraft text-white truncate">Minecraft {server.versions?.join(', ') || '未知'}</span>
                </div>
              </div>
              <div className="bg-black/30 p-3 flex items-center border border-white/5 overflow-hidden">
                <LinkIcon size={24} className="text-orange-400 mr-3 opacity-80" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[10px] text-ore-text-muted uppercase tracking-wider">服务器地址</span>
                  <span className="font-minecraft text-white truncate">{server.address || '内部地址'}</span>
                </div>
              </div>
            </div>

            <div className="flex w-full space-x-4 mt-2">
              <OreButton variant="secondary" size="full" onClick={onClose}>
                暂不部署
              </OreButton>
              <OreButton
                variant="primary"
                size="full"
                onClick={handleDownloadModpack}
                disabled={isDownloading}
              >
                <div className="flex items-center justify-center">
                  <HardDrive size={16} className="mr-2 flex-shrink-0" />
                  <span>{isDownloading ? '准备中...' : '开始部署'}</span>
                </div>
              </OreButton>
            </div>
          </div>
        ) : (
          /* ================= VANILLA VIEW ================= */
          <div className="flex flex-col text-center">
            <Server size={32} className="text-[#6CC349] mx-auto mb-4 drop-shadow-[0_0_8px_rgba(108,195,73,0.8)]" />
            <h3 className="text-white font-minecraft font-bold text-xl mb-1 ore-text-shadow">
              绑定到实例：{server.name}
            </h3>
            <p className="text-[#A0A0A0] font-minecraft text-xs mb-6 px-2">
              绑定后，启动该实例将通过 Quick Play 绕过主菜单直接为您连接本服务器。
            </p>

            <div className="flex space-x-2 w-full mb-6 relative">
              <div className="flex flex-col flex-1 text-left">
                <label className="text-white/80 font-minecraft text-sm mb-2">选择要绑定的本地实例</label>
                {isLoading ? (
                  <div className="h-10 border border-white/10 bg-black/40 flex items-center px-4 text-white/50 text-sm">检索中...</div>
                ) : (
                  <select
                    title="选择实例"
                    className="w-full bg-[#1E1E1F] border-2 border-white/20 p-2 text-white font-minecraft focus:border-[#FFE866] focus:outline-none transition-colors"
                    value={selectedInstanceId}
                    onChange={(e) => setSelectedInstanceId(e.target.value)}
                  >
                    {!instances.length && <option value="">无匹配版本的实例</option>}
                    {instances.map(inst => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({inst.version} {inst.loader})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex justify-center mb-6">
              <button
                onClick={handleCreateNew}
                className="flex items-center text-sm font-minecraft text-ore-green hover:text-white transition-colors"
              >
                <Plus size={16} className="mr-1" />
                没有合适的？新建实例并绑定
              </button>
            </div>

            <div className="flex w-full space-x-4">
              <OreButton variant="secondary" size="full" onClick={onClose}>
                取消
              </OreButton>
              <OreButton
                variant="primary"
                size="full"
                onClick={handleBind}
                disabled={instances.length === 0 || isBinding || !selectedInstanceId}
              >
                <div className="flex items-center justify-center">
                  <LinkIcon size={16} className="mr-2 flex-shrink-0" />
                  <span>{isBinding ? '绑定中...' : '确认绑定并直连'}</span>
                </div>
              </OreButton>
            </div>
          </div>
        )}
      </div>
    </OreModal>
  );
};
