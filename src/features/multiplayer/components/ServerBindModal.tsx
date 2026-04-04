import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Download, Link as LinkIcon, Server } from 'lucide-react';
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
      await invoke('download_and_import_modpack', {
        url: server.modpackUrl,
        instanceName: server.name
      });
      onClose();
      setActiveTab('downloads');
      alert('已触发整合包下载，请在下载中心查看进度。完成后请再次点击本服务器进行绑定。');
    } catch (error) {
      console.error('触发下载失败:', error);
      alert(`下载触发失败: ${error}`);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!server) return null;

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title="服务器快速绑定与直连"
      className="w-[500px]"
    >
      <div className="flex flex-col pt-2 pb-4 px-4 text-center">
        <Server size={32} className="text-[#6CC349] mx-auto mb-4 drop-shadow-[0_0_8px_rgba(108,195,73,0.8)]" />
        <h3 className="text-white font-minecraft font-bold text-xl mb-1 ore-text-shadow">
          绑定到实例：{server.name}
        </h3>
        <p className="text-[#A0A0A0] font-minecraft text-xs mb-6 px-2">
          绑定后，当您启动该实例时，PiLauncher 将通过 Quick Play 功能自动让您直连进入此服务器。
        </p>

        {/* 兼容实例下拉框 */}
        <div className="bg-black/40 border border-white/10 p-4 rounded-sm flex flex-col items-start w-full mb-6 text-left">
          <label className="text-white/80 font-minecraft text-sm mb-2">选择要绑定的本地实例</label>
          {isLoading ? (
            <div className="text-white/50 text-sm">正在检索本地实例...</div>
          ) : instances.length > 0 ? (
            <select
              title="选择实例"
              className="w-full bg-[#1E1E1F] border-2 border-white/20 p-2 text-white font-minecraft focus:border-[#FFE866] focus:outline-none transition-colors"
              value={selectedInstanceId}
              onChange={(e) => setSelectedInstanceId(e.target.value)}
            >
              {instances.map(inst => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} ({inst.version} {inst.loader})
                </option>
              ))}
            </select>
          ) : (
            <div className="text-[#E5A02E] text-sm">
              没有找到适用于版本 {server.versions?.join(', ') || '未知'} 的本地实例。
            </div>
          )}
        </div>

        {/* 整合包提示区块 */}
        {server.isModded && server.modpackUrl && (
          <div className="bg-[#1E1E1F] border border-[#E5A02E]/30 p-4 rounded-sm flex flex-col items-start w-full mb-6 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#E5A02E]/5 rounded-bl-full pointer-events-none" />
            <h4 className="text-[#E5A02E] font-bold font-minecraft text-sm mb-2 flex items-center">
              <Download size={14} className="mr-2" />
              该服务器需要专属整合包客户端
            </h4>
            <p className="text-white/60 text-xs mb-4">
              为了确保最佳体验并防止缺少必要的 Mod，我们强烈建议您下载服务器提供的官方整合包。
            </p>
            <OreButton
              variant="secondary"
              size="full"
              onClick={handleDownloadModpack}
              disabled={isDownloading}
            >
              部署并下载专属整合包 {isDownloading && '...'}
            </OreButton>
          </div>
        )}

        {/* 底部操作区 */}
        <div className="flex w-full space-x-4">
          <OreButton
            variant="secondary"
            size="full"
            onClick={onClose}
          >
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
    </OreModal>
  );
};
