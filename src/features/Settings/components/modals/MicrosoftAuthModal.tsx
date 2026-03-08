// src/features/Settings/components/modals/MicrosoftAuthModal.tsx
import React, { useEffect, useState } from 'react';
import { Loader2, Copy, SmartphoneNfc } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../ui/primitives/OreButton';
import type { DeviceCodeInfo } from '../../hooks/useMicrosoftAuth';

interface MicrosoftAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  deviceCodeInfo: DeviceCodeInfo | null;
  loginStatusMsg: string;
  copyCodeAndOpen: () => void;
}

export const MicrosoftAuthModal: React.FC<MicrosoftAuthModalProps> = ({
  isOpen, 
  onClose, 
  isLoading, 
  deviceCodeInfo, 
  loginStatusMsg, 
  copyCodeAndOpen
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (deviceCodeInfo && isOpen) {
      // ✅ 修复：由于微软第三方应用风控限制，移除 ?otc= 拼接。
      // 直接使用纯净的 verification_uri 生成二维码，省去用户手动输入网址的麻烦。
      const authUrl = deviceCodeInfo.verification_uri;
      
      invoke<string>('generate_device_auth_qr', { url: authUrl })
        .then(setQrDataUrl)
        .catch(err => console.error("二维码生成失败:", err));
    } else {
      setQrDataUrl(null);
    }
  }, [deviceCodeInfo, isOpen]);

  return (
    <OreModal isOpen={isOpen} onClose={onClose} title="微软账号登录" closeOnOutsideClick={false}>
      <div className="flex flex-col items-center px-8 py-6">
        {isLoading || !deviceCodeInfo ? (
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 size={40} className="text-ore-green animate-spin mb-4" />
            <p className="font-minecraft text-white">正在向微软请求安全口令...</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-minecraft text-ore-text-muted mb-4 text-center max-w-sm leading-relaxed">
              请扫描下方二维码打开验证网页，并手动输入安全口令。
            </p>
            
            {/* 二维码区 */}
            {qrDataUrl && (
              <div className="bg-white p-2 rounded-sm shadow-[0_0_20px_rgba(255,255,255,0.05)] mb-5 border-4 border-[#141415] relative group">
                <div className="absolute -top-3 -right-3 bg-ore-green text-black p-1.5 rounded-full shadow-lg">
                   <SmartphoneNfc size={18} />
                </div>
                <img 
                  src={qrDataUrl} 
                  alt="Microsoft Login QR Code" 
                  className="w-36 h-36 md:w-40 md:h-40" 
                  style={{ imageRendering: 'pixelated' }} 
                />
              </div>
            )}

            {/* 需要输入的安全口令 CODE 框 */}
            <div className="bg-[#141415] border-[2px] border-[#2A2A2C] px-8 py-3 mb-6 shadow-inner relative flex flex-col items-center w-full max-w-[300px]">
              <span className="text-[10px] text-ore-text-muted absolute -top-2.5 bg-[#1E1E1F] px-2 font-minecraft text-center whitespace-nowrap">
                扫码后请输入此口令
              </span>
              <span className="text-3xl font-minecraft text-white tracking-widest mt-1 select-all">
                {deviceCodeInfo.user_code}
              </span>
            </div>

            {/* 传统 PC 体验的万能按钮 */}
            <OreButton focusKey="btn-ms-copy" variant="primary" onClick={copyCodeAndOpen} size="lg" className="w-full flex items-center justify-center font-minecraft">
              <Copy size={18} className="mr-2" /> 在本机浏览器继续
            </OreButton>

            <div className={`mt-5 flex items-center text-xs font-minecraft ${loginStatusMsg.includes('失败') ? 'text-red-400' : 'text-ore-text-muted'}`}>
              {!loginStatusMsg.includes('失败') && <Loader2 size={12} className="animate-spin mr-2" />} {loginStatusMsg}
            </div>
          </>
        )}
      </div>
    </OreModal>
  );
};