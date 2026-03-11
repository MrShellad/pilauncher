// src/features/Settings/components/tabs/AccountSettings.tsx
import React, { useState } from 'react';
import { open as openShell } from '@tauri-apps/plugin-shell';
import { Users, Plus, AlertTriangle, ShoppingCart } from 'lucide-react';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { FocusItem } from '../../../../ui/focus/FocusItem';

import { useAccountStore } from '../../../../store/useAccountStore';
import { AccountCard } from './AS/AccountCard';
import { useMicrosoftAuth } from '../../hooks/useMicrosoftAuth';
import { useOfflineAuth } from '../../hooks/useOfflineAuth';

// ✅ 引入刚刚抽离的独立弹窗组件
import { MicrosoftAuthModal } from '../modals/MicrosoftAuthModal';
import { OfflineAuthModal } from '../modals/OfflineAuthModal';

export const AccountSettings: React.FC = () => {
  const { accounts, activeAccountId, removeAccount, setActiveAccount } = useAccountStore();
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);

  const {
    isLoginModalOpen, setIsLoginModalOpen,
    deviceCodeInfo, isLoading, loginStatusMsg,
    startMicrosoftLogin, copyCodeAndOpen
  } = useMicrosoftAuth();

  const {
    isOfflineModalOpen, setIsOfflineModalOpen,
    offlineForm, setOfflineForm, offlineError, setOfflineError,
    openAddOffline, openEditOffline, handleSaveOffline, handleUploadSkin
  } = useOfflineAuth();

  const confirmDelete = () => {
    if (accountToDelete) {
      removeAccount(accountToDelete);
      setAccountToDelete(null);
    }
  };

  const sortedAccounts = [...accounts].sort((a, b) => {
    const aIsMs = a.type?.toLowerCase() === 'microsoft' ? 1 : 0;
    const bIsMs = b.type?.toLowerCase() === 'microsoft' ? 1 : 0;
    if (aIsMs !== bIsMs) return bIsMs - aIsMs; 
    
    const aIsActive = activeAccountId === a.uuid ? 1 : 0;
    const bIsActive = activeAccountId === b.uuid ? 1 : 0;
    return bIsActive - aIsActive;
  });

  return (
    <SettingsPageLayout title="账户管理" subtitle="Account & Profile">
      <SettingsSection title="身份库" icon={<Users size={18} />}>
        <div className="p-6 flex flex-col flex-1 min-h-[500px]">
          
          <div className="flex-1 flex flex-col items-center justify-center w-full pb-8">
            <div className="flex flex-wrap items-center justify-center gap-6 mb-12 w-full">
              <OreButton focusKey="btn-add-ms" variant="purple" size="lg" onClick={startMicrosoftLogin}>
                <span className="flex items-center"><Plus size={20} className="mr-2" /> 添加微软正版</span>
              </OreButton>
              <OreButton focusKey="btn-add-offline" variant="secondary" size="lg" onClick={openAddOffline}>
                <span className="flex items-center"><Plus size={20} className="mr-2" /> 添加离线账号</span>
              </OreButton>
            </div>

            {accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 border-[2px] border-dashed border-[var(--ore-border-color)] bg-[#141415]/50 rounded-sm w-full max-w-2xl">
                <Users size={56} className="mb-4 opacity-20" />
                <span className="text-ore-text-muted font-minecraft text-xl tracking-wider">当前未连接任何游戏账户</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-stretch justify-center gap-8 w-full">
                {sortedAccounts.map(acc => (
                  <div key={acc.uuid} className="w-full sm:w-[340px] xl:w-[360px]">
                    <AccountCard 
                      account={acc} 
                      isActive={activeAccountId === acc.uuid}
                      onSetCurrent={setActiveAccount}
                      onRemove={setAccountToDelete}
                      onEdit={openEditOffline}
                      onUploadSkin={handleUploadSkin}
                    />
                  </div>
                ))}
              </div>
            )}
            
          </div>

          <div className="mt-auto pt-8 flex flex-col items-center">
            <span className="text-ore-text-muted font-minecraft text-sm mb-5">尚未拥有 Minecraft 正版授权？通过官方渠道安全获取游戏</span>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <FocusItem focusKey="link-buy-mc" onEnter={() => openShell('https://www.minecraft.net/zh-hans/store/minecraft-java-bedrock-edition-pc')}>
                {({ ref, focused }) => (
                  <button 
                    ref={ref as any} onClick={() => openShell('https://www.minecraft.net/zh-hans/store/minecraft-java-bedrock-edition-pc')} 
                    className={`flex items-center text-sm text-green-400 hover:text-green-300 transition-all font-minecraft px-4 py-2 bg-green-400/10 rounded-full outline-none ${focused ? 'outline outline-[2px] outline-white scale-105 shadow-lg' : 'hover:underline'}`}
                  >
                    <ShoppingCart size={16} className="mr-2" /> Minecraft 官网获取
                  </button>
                )}
              </FocusItem>

              <FocusItem focusKey="link-buy-ms" onEnter={() => openShell('ms-windows-store://pdp/?productid=9NXP44L49SHJ')}>
                {({ ref, focused }) => (
                  <button 
                    ref={ref as any} onClick={() => openShell('ms-windows-store://pdp/?productid=9NXP44L49SHJ')} 
                    className={`flex items-center text-sm text-purple-400 hover:text-purple-300 transition-all font-minecraft px-4 py-2 bg-purple-400/10 rounded-full outline-none ${focused ? 'outline outline-[2px] outline-white scale-105 shadow-lg' : 'hover:underline'}`}
                  >
                    <ShoppingCart size={16} className="mr-2" /> 微软商店 (Windows Store)
                  </button>
                )}
              </FocusItem>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* ✅ 挂载提取出来的独立弹窗 */}
      <MicrosoftAuthModal 
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        isLoading={isLoading}
        deviceCodeInfo={deviceCodeInfo}
        loginStatusMsg={loginStatusMsg}
        copyCodeAndOpen={copyCodeAndOpen}
      />

      <OfflineAuthModal 
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
        offlineForm={offlineForm}
        setOfflineForm={setOfflineForm}
        offlineError={offlineError}
        setOfflineError={setOfflineError}
        handleSaveOffline={handleSaveOffline}
      />

      {/* 删除确认弹窗依然留在页面内，因为它强关联于当前的账号列表展示逻辑 */}
      <OreModal isOpen={!!accountToDelete} onClose={() => setAccountToDelete(null)} title="确认移除账号">
        <div className="p-6 flex flex-col">
          <div className="bg-red-500/10 border-[2px] border-red-500/50 p-4 flex items-start mb-6 rounded-sm">
            <AlertTriangle size={18} className="text-red-500 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400/90 leading-relaxed font-minecraft">
              确定要移除此账号吗？此操作仅会从启动器中移除该身份，<br/>不会删除您的任何本地游戏存档数据。
            </p>
          </div>
          <div className="flex justify-end space-x-3 mt-2">
            <OreButton focusKey="btn-del-cancel" variant="secondary" onClick={() => setAccountToDelete(null)}>取消操作</OreButton>
            <OreButton focusKey="btn-del-confirm" variant="danger" onClick={confirmDelete}>确认移除</OreButton>
          </div>
        </div>
      </OreModal>
    </SettingsPageLayout>
  );
};
