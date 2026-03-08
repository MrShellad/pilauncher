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
        deviceName: request.device_name,
        publicKey: request.public_key,
        accept: accept
      });
    } catch (e) {
      console.error('Failed to resolve trust request:', e);
    } finally {
      setIsProcessing(false);
      setRequest(null);
    }
  };

  if (!request) return null;

  return (
    <OreModal isOpen={!!request} onClose={() => handleResolve(false)} hideTitleBar={true} className="w-full max-w-md bg-[#1E1E1F] border-[2px] border-[#313233] p-0">
      <div className="p-8 flex flex-col relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 border-2 border-blue-500/50 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <MonitorSmartphone size={32} />
            </div>
          </div>
          
          <h3 className="text-xl text-center text-white font-bold mb-2">来自 "{request.device_name}"</h3>
          <p className="text-center text-gray-400 text-sm mb-6 font-minecraft">
            请求与您建立信任连接（添加为局域网好友）。<br/>
            同意后，双方将可以互传实例、共享游玩状态。
          </p>

          <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 flex items-start mb-8 rounded-sm">
            <ShieldAlert size={18} className="text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-500/90 leading-relaxed font-minecraft">
              安全提示：请确认这是您认识的设备。如果您不认识该玩家，请直接拒绝以保护您的存档安全。
            </p>
          </div>

          <div className="flex justify-between gap-4">
            <OreButton variant="secondary" className="flex-1" onClick={() => handleResolve(false)} disabled={isProcessing}>
              拒绝并忽略
            </OreButton>
            <OreButton variant="primary" className="flex-1 font-bold text-black" onClick={() => handleResolve(true)} disabled={isProcessing}>
              {isProcessing ? '处理中...' : '同意并添加好友'}
            </OreButton>
          </div>
        </div>
      </div>
    </OreModal>
  );
};