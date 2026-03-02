// src/features/Settings/components/tabs/AccountSettings.tsx
import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import { Users, Plus, Loader2, Copy, X } from 'lucide-react';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';

import { useAccountStore, type MinecraftAccount } from '../../../../store/useAccountStore';

interface DeviceCodeInfo {
  user_code: string;
  verification_uri: string;
  device_code: string;
  interval: number;
}

export const AccountSettings: React.FC = () => {
  const { accounts, activeAccountId, addAccount, removeAccount, setActiveAccount } = useAccountStore();
  
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [deviceCodeInfo, setDeviceCodeInfo] = useState<DeviceCodeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginStatusMsg, setLoginStatusMsg] = useState("等待浏览器授权中...");

  // 开始微软登录流程
  const startMicrosoftLogin = async () => {
    setIsLoginModalOpen(true);
    setIsLoading(true);
    setDeviceCodeInfo(null);
    setLoginStatusMsg("等待浏览器授权中...");

    try {
      // 1. 获取验证码
      const info = await invoke<DeviceCodeInfo>('request_microsoft_device_code');
      setDeviceCodeInfo(info);
      setIsLoading(false); // 停止 loading，显示验证码界面
      
      // 2. 开始静默轮询并等待五步换牌结果
      setLoginStatusMsg("正在后台静默等待授权与换牌 (不要关闭弹窗)...");
      const accountData = await invoke<MinecraftAccount>('poll_and_exchange_microsoft_token', {
        deviceCode: info.device_code, // 注意 Rust 中叫 device_code，前端传过去自动转驼峰
        interval: info.interval
      });

      // 3. 换牌成功！存入 Zustand Store
      addAccount(accountData);
      setIsLoginModalOpen(false); // 成功后自动关闭弹窗

    } catch (err: any) {
      console.error(err);
      setLoginStatusMsg(`登录失败: ${err}`);
    }
  };

  // 复制口令并调用系统浏览器打开授权页面
  const copyCodeAndOpen = async () => {
    if (!deviceCodeInfo) return;
    await navigator.clipboard.writeText(deviceCodeInfo.user_code);
    await open(deviceCodeInfo.verification_uri);
  };

  return (
    <SettingsPageLayout title="账户管理" subtitle="Account & Profile">
      <SettingsSection title="账户列表" icon={<Users size={18} />}>
        <div className="p-6">
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-[#1E1E1F] bg-[#141415]/50">
              <span className="text-ore-text-muted font-minecraft mb-4">尚未添加任何游戏账户</span>
              <div className="flex space-x-4">
                <OreButton onClick={startMicrosoftLogin} className="flex items-center">
                  <Plus size={16} className="mr-2" /> 添加微软账号
                </OreButton>
                <OreButton variant="secondary" className="flex items-center">
                  <Plus size={16} className="mr-2" /> 离线账号
                </OreButton>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 账户列表渲染区 */}
              {accounts.map(acc => (
                <div 
                  key={acc.uuid} 
                  className={`flex items-center justify-between p-4 border-2 transition-colors duration-200 ${
                    activeAccountId === acc.uuid 
                      ? 'border-ore-green bg-[#2A2A2C] shadow-[0_0_10px_rgba(56,133,39,0.15)]' 
                      : 'border-[#1E1E1F] bg-[#141415]'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    {/* 使用 Crafatar API 渲染正版皮肤头像 */}
                    <div className="w-12 h-12 bg-[#1E1E1F] border border-ore-gray-border p-0.5 shadow-sm">
                      <img 
                        src={`https://crafatar.com/avatars/${acc.uuid}?overlay=true&size=64`} 
                        alt={acc.name} 
                        className="w-full h-full object-cover rendering-pixelated"
                        onError={(e) => { 
                          // 加载失败回退到史蒂夫头像
                          e.currentTarget.src = 'https://crafatar.com/avatars/8667ba71b85a4004af54457a9734eed7?overlay=true'; 
                        }}
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white font-minecraft text-lg flex items-center">
                        {acc.name}
                        {activeAccountId === acc.uuid && (
                          <span className="ml-2 px-1.5 py-0.5 bg-ore-green text-[#141415] text-[10px] uppercase font-bold tracking-wider">当前使用</span>
                        )}
                      </span>
                      <span className="text-ore-text-muted font-minecraft text-xs mt-0.5">
                        {acc.type === 'microsoft' ? '微软正版账号' : '离线账号'} 
                        <span className="opacity-50 ml-2">{acc.uuid.substring(0, 8)}...</span>
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {activeAccountId !== acc.uuid && (
                      <OreButton size="sm" variant="secondary" onClick={() => setActiveAccount(acc.uuid)}>
                        设为当前
                      </OreButton>
                    )}
                    <button 
                      onClick={() => removeAccount(acc.uuid)}
                      className="p-2 text-ore-text-muted hover:text-red-400 transition-colors"
                      title="移除账号"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="pt-4 flex space-x-3">
                <OreButton onClick={startMicrosoftLogin} size="sm" className="flex items-center">
                  <Plus size={14} className="mr-1.5" /> 添加微软账号
                </OreButton>
                <OreButton variant="secondary" size="sm" className="flex items-center">
                  <Plus size={14} className="mr-1.5" /> 离线账号
                </OreButton>
              </div>
            </div>
          )}
        </div>
      </SettingsSection>

      {/* 微软登录专用弹窗 */}
      <OreModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
        title="微软账号登录"
        closeOnOverlayClick={false}
      >
        <div className="flex flex-col items-center py-6">
          {isLoading || !deviceCodeInfo ? (
            <>
              <Loader2 size={40} className="text-ore-green animate-spin mb-4" />
              <p className="font-minecraft text-white">正在向微软请求验证口令...</p>
            </>
          ) : (
            <>
              <p className="text-sm font-minecraft text-ore-text-muted mb-6 text-center max-w-sm leading-relaxed">
                请点击下方按钮复制验证码并在浏览器中打开微软登录页面。完成授权后，此窗口将自动继续。
              </p>
              
              <div className="bg-[#141415] border-2 border-[#1E1E1F] px-8 py-4 mb-6 relative group">
                <span className="text-4xl font-minecraft text-white tracking-widest">{deviceCodeInfo.user_code}</span>
              </div>

              <OreButton onClick={copyCodeAndOpen} size="lg" className="w-full flex items-center justify-center font-minecraft">
                <Copy size={18} className="mr-2" /> 复制验证码并打开浏览器
              </OreButton>
              
              <div className={`mt-6 flex items-center text-xs font-minecraft ${loginStatusMsg.includes('失败') ? 'text-red-400' : 'text-ore-text-muted'}`}>
                {!loginStatusMsg.includes('失败') && <Loader2 size={12} className="animate-spin mr-2" />} 
                {loginStatusMsg}
              </div>
            </>
          )}
        </div>
      </OreModal>
    </SettingsPageLayout>
  );
};