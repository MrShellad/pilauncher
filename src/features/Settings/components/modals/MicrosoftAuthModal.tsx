// src/features/Settings/components/modals/MicrosoftAuthModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { invoke } from '@tauri-apps/api/core';
import { Copy, Loader2, SmartphoneNfc } from 'lucide-react';

import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import type { DeviceCodeInfo } from '../../hooks/useMicrosoftAuth';

interface MicrosoftAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  deviceCodeInfo: DeviceCodeInfo | null;
  loginStatusMsg: string;
  copyCodeAndOpen: () => void;
}

const COPY_BUTTON_FOCUS_KEY = 'ms-auth-copy';
const CLOSE_BUTTON_FOCUS_KEY = 'ms-auth-close';

export const MicrosoftAuthModal: React.FC<MicrosoftAuthModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  deviceCodeInfo,
  loginStatusMsg,
  copyCodeAndOpen
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const lastFocusBeforeModalRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    const currentFocus = getCurrentFocusKey();
    if (currentFocus && currentFocus !== 'SN:ROOT') {
      lastFocusBeforeModalRef.current = currentFocus;
    }
  }, [isOpen]);

  useEffect(() => {
    if (deviceCodeInfo && isOpen) {
      invoke<string>('generate_device_auth_qr', { url: deviceCodeInfo.verification_uri })
        .then(setQrDataUrl)
        .catch((error) => console.error('QR generation failed:', error));
      return;
    }

    setQrDataUrl(null);
  }, [deviceCodeInfo, isOpen]);

  useEffect(() => {
    if (!isOpen || isLoading || !deviceCodeInfo) return;

    const timer = setTimeout(() => {
      if (doesFocusableExist(COPY_BUTTON_FOCUS_KEY)) {
        setFocus(COPY_BUTTON_FOCUS_KEY);
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [deviceCodeInfo, isLoading, isOpen]);

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      return;
    }

    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;

    const timer = setTimeout(() => {
      const lastFocus = lastFocusBeforeModalRef.current;
      if (lastFocus && doesFocusableExist(lastFocus)) {
        setFocus(lastFocus);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen]);

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title="微软账号登录"
      closeOnOutsideClick={false}
      defaultFocusKey={!isLoading && deviceCodeInfo ? COPY_BUTTON_FOCUS_KEY : undefined}
    >
      <div className="flex flex-col items-center px-8 py-6">
        {isLoading || !deviceCodeInfo ? (
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 size={40} className="mb-4 animate-spin text-ore-green" />
            <p className="font-minecraft text-white">正在向微软请求安全口令...</p>
          </div>
        ) : (
          <>
            <p className="mb-4 max-w-sm text-center text-sm font-minecraft leading-relaxed text-ore-text-muted">
              请扫描下方二维码打开验证页面，或复制验证码后在本机浏览器继续。
            </p>

            {qrDataUrl && (
              <div className="group relative mb-5 border-4 border-[#141415] bg-white p-2 shadow-[0_0_20px_rgba(255,255,255,0.05)] rounded-sm">
                <div className="absolute -right-3 -top-3 rounded-full bg-ore-green p-1.5 text-black shadow-lg">
                  <SmartphoneNfc size={18} />
                </div>
                <img
                  src={qrDataUrl}
                  alt="Microsoft Login QR Code"
                  className="h-36 w-36 md:h-40 md:w-40"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            )}

            <div className="relative mb-6 flex w-full max-w-[300px] flex-col items-center border-[2px] border-[#2A2A2C] bg-[#141415] px-8 py-3 shadow-inner">
              <span className="absolute -top-2.5 whitespace-nowrap bg-[#1E1E1F] px-2 text-center text-[10px] font-minecraft text-ore-text-muted">
                扫码后请输入此口令
              </span>
              <span className="mt-1 select-all font-minecraft text-3xl tracking-widest text-white">
                {deviceCodeInfo.user_code}
              </span>
            </div>

            <div className="flex w-full gap-3">

              <OreButton
                focusKey={COPY_BUTTON_FOCUS_KEY}
                variant="primary"
                onClick={copyCodeAndOpen}
                onArrowPress={(direction) => {
                  if (direction === 'LEFT') {
                    setFocus(CLOSE_BUTTON_FOCUS_KEY);
                    return false;
                  }
                  return true;
                }}
                size="lg"
                className="flex-1 font-minecraft"
              >
                <Copy size={18} className="mr-2" /> 复制并打开浏览器
              </OreButton>
            </div>

            <div className={`mt-5 flex items-center text-xs font-minecraft ${loginStatusMsg.includes('失败') ? 'text-red-400' : 'text-ore-text-muted'}`}>
              {!loginStatusMsg.includes('失败') && <Loader2 size={12} className="mr-2 animate-spin" />}
              {loginStatusMsg}
            </div>
          </>
        )}
      </div>
    </OreModal>
  );
};
