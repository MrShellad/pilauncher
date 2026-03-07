// src/features/lan/components/LanTrustModal.tsx
import React, { useEffect, useState } from 'react';
import { listen,type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { ShieldAlert, MonitorSmartphone } from 'lucide-react';
import { OreModal } from '../../ui/primitives/OreModal';
import { OreButton } from '../../ui/primitives/OreButton';

interface TrustRequestPayload {
  device_id: string;
  device_name: string;
  public_key: string;
}

export const LanTrustModal: React.FC = () => {
  const [request, setRequest] = useState<TrustRequestPayload | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let unlisten: UnlistenFn;
    const setupListener = async () => {
      // 监听后端发来的 incoming-trust-request 事件
      unlisten = await listen<TrustRequestPayload>('incoming-trust-request', (event) => {
        setRequest(event.payload);
      });
    };
    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleResolve = async (accept: boolean) => {
    if (!request || isProcessing) return;
    setIsProcessing(true);
    try {
      await invoke('resolve_trust_request', {
        deviceId: request.device_id,
        accept: accept,
        deviceName: request.device_name,
        publicKey: request.public_key
      });
    } catch (e) {
      console.error("处理握手失败:", e);
    } finally {
      setIsProcessing(false);
      setRequest(null); // 关闭弹窗
    }
  };

  return (
    <OreModal isOpen={!!request} onClose={() => {}} title="局域网安全连接请求" closeOnOutsideClick={false}>
      {request && (
        <div className="flex flex-col p-6 sm:p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 border-2 border-blue-500/50 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <MonitorSmartphone size={32} />
            </div>
          </div>
          
          <h3 className="text-xl text-center text-white font-bold mb-2">设备 "{request.device_name}"</h3>
          <p className="text-center text-gray-400 text-sm mb-6 font-minecraft">
            请求与您的启动器建立基于 ED25519 加密的信任连接。<br/>
            同意后，双方将可以互传实例与世界存档。
          </p>

          <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 flex items-start mb-8 rounded-sm">
            <ShieldAlert size={18} className="text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-500/90 leading-relaxed font-minecraft">
              安全提示：请确认这是您认识的设备。如果不认识，请直接拒绝以保护您的存档安全。
            </p>
          </div>

          <div className="flex justify-between gap-4">
            <OreButton variant="secondary" className="flex-1" onClick={() => handleResolve(false)} disabled={isProcessing}>
              拒绝连接
            </OreButton>
            <OreButton variant="primary" className="flex-1 !bg-blue-600 hover:!bg-blue-500" onClick={() => handleResolve(true)} disabled={isProcessing}>
              {isProcessing ? '处理中...' : '信任并同意'}
            </OreButton>
          </div>
        </div>
      )}
    </OreModal>
  );
};