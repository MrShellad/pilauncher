import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Blocks, HardDrive, Link as LinkIcon, Play, Plus, Server } from 'lucide-react';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreButton } from '../../../ui/primitives/OreButton';
import type { OnlineServer } from '../types';
import { useLauncherStore } from '../../../store/useLauncherStore';
import { useGameLaunch } from '../../../hooks/useGameLaunch';

interface InstanceItem {
  id: string;
  name: string;
  version: string;
  loader: string;
}

interface ServerBindingRecord {
  uuid: string;
  name: string;
  ip: string;
  port: number;
}

interface ServerBindModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: OnlineServer | null;
}

const parseServerAddress = (server: OnlineServer) => {
  const ipMatch = server.address?.match(/^([^:]+)(?::(\d+))?$/);
  return {
    ip: ipMatch ? ipMatch[1] : server.address || '',
    port: ipMatch && ipMatch[2] ? parseInt(ipMatch[2], 10) : 25565,
  };
};

const matchesBinding = (server: OnlineServer, binding: ServerBindingRecord) => {
  const { ip, port } = parseServerAddress(server);
  return (
    binding.uuid === server.id ||
    (binding.name && binding.name === server.name) ||
    (binding.ip === ip && binding.port === port)
  );
};

export const ServerBindModal: React.FC<ServerBindModalProps> = ({ isOpen, onClose, server }) => {
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const { launchGame, isLaunching } = useGameLaunch();

  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [boundInstance, setBoundInstance] = useState<InstanceItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBinding, setIsBinding] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCheckingBinding, setIsCheckingBinding] = useState(false);

  useEffect(() => {
    if (!isOpen || !server) {
      setInstances([]);
      setSelectedInstanceId('');
      setBoundInstance(null);
      setIsLoading(false);
      setIsCheckingBinding(false);
      return;
    }

    void initializeModal(server);
  }, [isOpen, server]);

  const initializeModal = async (currentServer: OnlineServer) => {
    try {
      setIsCheckingBinding(true);
      setBoundInstance(null);

      const [bindings, allInstances] = await Promise.all([
        invoke<Record<string, ServerBindingRecord>>('get_server_bindings').catch(() => ({})),
        invoke<InstanceItem[]>('get_all_instances').catch(() => []),
      ]);

      const matchedBindingEntry = Object.entries(bindings).find(([, binding]) => matchesBinding(currentServer, binding));
      if (matchedBindingEntry) {
        const [instanceId] = matchedBindingEntry;
        const matchedInstance = allInstances.find((item) => item.id === instanceId);
        setBoundInstance(
          matchedInstance || {
            id: instanceId,
            name: instanceId,
            version: '',
            loader: '',
          }
        );
        return;
      }

      await fetchCompatibleInstances(currentServer);
    } finally {
      setIsCheckingBinding(false);
    }
  };

  const fetchCompatibleInstances = async (currentServer: OnlineServer) => {
    try {
      setIsLoading(true);
      const gameVersions = currentServer.versions || [];
      const data = await invoke<InstanceItem[]>('get_compatible_instances', {
        gameVersions,
        loaders: [],
        ignoreLoader: true,
      });
      setInstances(data);
      setSelectedInstanceId(data.length > 0 ? data[0].id : '');
    } catch (error) {
      console.error('获取兼容实例失败:', error);
      setInstances([]);
      setSelectedInstanceId('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchBoundInstance = async () => {
    if (!boundInstance) return;
    onClose();
    await launchGame(boundInstance.id);
  };

  const handleBind = async () => {
    if (!server || !selectedInstanceId) return;

    try {
      setIsBinding(true);
      const { ip, port } = parseServerAddress(server);

      await invoke('bind_server_to_instance', {
        instanceId: selectedInstanceId,
        serverBinding: {
          uuid: server.id,
          name: server.name,
          ip,
          port,
        },
      });

      const selectedInstance = instances.find((item) => item.id === selectedInstanceId);
      setBoundInstance(
        selectedInstance || {
          id: selectedInstanceId,
          name: selectedInstanceId,
          version: '',
          loader: '',
        }
      );
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
      const { ip, port } = parseServerAddress(server);

      await invoke('download_and_import_modpack', {
        url: server.modpackUrl,
        instanceName: server.name,
        serverBinding: {
          uuid: server.id,
          name: server.name,
          ip,
          port,
        },
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
  const launchTargetName = boundInstance?.name || server.name;

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={boundInstance ? '启动已关联实例' : isModServer ? '部署专属客户端' : '服务器快速绑定与直连'}
      className="w-[500px]"
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
              <OreButton variant="secondary" size="full" onClick={onClose} disabled={isLaunching}>
                取消
              </OreButton>
              <OreButton variant="primary" size="full" onClick={handleLaunchBoundInstance} disabled={isLaunching}>
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
              <OreButton variant="secondary" size="full" onClick={onClose}>
                暂不部署
              </OreButton>
              <OreButton variant="primary" size="full" onClick={handleDownloadModpack} disabled={isDownloading}>
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
              绑定后，启动该实例将通过 Quick Play 绕过主菜单，直接连接到该服务器。
            </p>

            <div className="relative mb-6 flex w-full space-x-2">
              <div className="flex flex-1 flex-col text-left">
                <label className="mb-2 font-minecraft text-sm text-white/80">选择要绑定的本地实例</label>
                {isLoading ? (
                  <div className="flex h-10 items-center border border-white/10 bg-black/40 px-4 text-sm text-white/50">检索中...</div>
                ) : (
                  <select
                    title="选择实例"
                    className="w-full border-2 border-white/20 bg-[#1E1E1F] p-2 font-minecraft text-white transition-colors focus:border-[#FFE866] focus:outline-none"
                    value={selectedInstanceId}
                    onChange={(e) => setSelectedInstanceId(e.target.value)}
                  >
                    {!instances.length && <option value="">无匹配版本的实例</option>}
                    {instances.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({inst.version} {inst.loader})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="mb-6 flex justify-center">
              <button
                onClick={handleCreateNew}
                className="flex items-center text-sm font-minecraft text-ore-green transition-colors hover:text-white"
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
