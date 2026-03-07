// src/features/Settings/components/modals/MicrosoftAuthModal.tsx
import React from 'react';
import { Loader2, Copy } from 'lucide-react';
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
  return (
    <OreModal isOpen={isOpen} onClose={onClose} title="微软账号登录" closeOnOutsideClick={false}>
      <div className="flex flex-col items-center px-8 py-8">
        {isLoading || !deviceCodeInfo ? (
          <>
            <Loader2 size={40} className="text-ore-green animate-spin mb-4" />
            <p className="font-minecraft text-white">正在向微软请求验证口令...</p>
          </>
        ) : (
          <>
            <p className="text-sm font-minecraft text-ore-text-muted mb-6 text-center max-w-sm leading-relaxed">
              请点击下方按钮复制验证码并在浏览器中打开页面。完成授权后，此窗口将自动继续。
            </p>
            <div className="bg-[var(--ore-btn-secondary-bg)] border-[2px] border-[var(--ore-border-color)] px-8 py-4 mb-6 shadow-inner">
              <span className="text-4xl font-minecraft text-white tracking-widest">{deviceCodeInfo.user_code}</span>
            </div>
            <OreButton focusKey="btn-ms-copy" variant="primary" onClick={copyCodeAndOpen} size="lg" className="w-full flex items-center justify-center font-minecraft">
              <Copy size={18} className="mr-2" /> 复制验证码并打开浏览器
            </OreButton>
            <div className={`mt-6 flex items-center text-xs font-minecraft ${loginStatusMsg.includes('失败') ? 'text-red-400' : 'text-ore-text-muted'}`}>
              {!loginStatusMsg.includes('失败') && <Loader2 size={12} className="animate-spin mr-2" />} {loginStatusMsg}
            </div>
          </>
        )}
      </div>
    </OreModal>
  );
};