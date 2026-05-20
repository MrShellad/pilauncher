// src/features/Settings/components/tabs/AccountSettings.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open as openShell } from '@tauri-apps/plugin-shell';
import { Users, Plus, AlertTriangle, ShoppingCart, Server } from 'lucide-react';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { FocusItem } from '../../../../ui/focus/FocusItem';

import { useAccountStore } from '../../../../store/useAccountStore';
import { AccountCard } from './AS/AccountCard';
import { useMicrosoftAuth } from '../../hooks/useMicrosoftAuth';
import { useOfflineAuth } from '../../hooks/useOfflineAuth';
import { useAuthlibAuth } from '../../hooks/useAuthlibAuth';

// ✅ 引入刚刚抽离的独立弹窗组件
import { MicrosoftAuthModal } from '../modals/MicrosoftAuthModal';
import { OfflineAuthModal } from '../modals/OfflineAuthModal';
import { AuthlibAuthModal } from '../modals/AuthlibAuthModal';

export const AccountSettings: React.FC = () => {
  const { t } = useTranslation();
  const {
    accounts,
    activeAccountId,
    hasUnlockedThirdPartyAuth,
    removeAccount,
    setActiveAccount
  } = useAccountStore();
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

  const {
    isAuthlibModalOpen,
    authlibForm,
    setAuthlibForm,
    authlibError,
    setAuthlibError,
    isAuthlibLoading,
    openAuthlibLogin,
    closeAuthlibLogin,
    handleAuthlibLogin
  } = useAuthlibAuth();

  const confirmDelete = () => {
    if (accountToDelete) {
      removeAccount(accountToDelete);
      setAccountToDelete(null);
    }
  };

  const hasMicrosoftAccount = accounts.some((account) => account.type?.toLowerCase() === 'microsoft');
  const canUseThirdPartyAuth = hasUnlockedThirdPartyAuth || hasMicrosoftAccount;

  const accountSortWeight = (type?: string) => {
    const normalizedType = type?.toLowerCase();
    if (normalizedType === 'microsoft') return 3;
    if (normalizedType === 'authlib') return 2;
    return 1;
  };

  const sortedAccounts = [...accounts].sort((a, b) => {
    const typeWeightDiff = accountSortWeight(b.type) - accountSortWeight(a.type);
    if (typeWeightDiff !== 0) return typeWeightDiff;

    const aIsActive = activeAccountId === a.uuid ? 1 : 0;
    const bIsActive = activeAccountId === b.uuid ? 1 : 0;
    return bIsActive - aIsActive;
  });

  return (
    <SettingsPageLayout adaptiveScale>
      <SettingsSection title={t('settings.account.sections.identities')} icon={<Users size={18} />}>
        <div className="p-6 flex flex-col flex-1 min-h-[500px]">

          <div className="flex-1 flex flex-col items-center justify-center w-full pb-8">
            <div className="flex flex-wrap items-center justify-center gap-6 mb-12 w-full">
              <OreButton focusKey="btn-add-ms" variant="purple" size="lg" onClick={startMicrosoftLogin}>
                <span className="flex items-center"><Plus size={20} className="mr-2" /> {t('settings.account.btnAddMs')}</span>
              </OreButton>
              <OreButton focusKey="btn-add-offline" variant="secondary" size="lg" onClick={openAddOffline}>
                <span className="flex items-center"><Plus size={20} className="mr-2" /> {t('settings.account.btnAddOffline')}</span>
              </OreButton>
              {canUseThirdPartyAuth && (
                <OreButton focusKey="btn-add-authlib" variant="secondary" size="lg" onClick={openAuthlibLogin}>
                  <span className="flex items-center"><Server size={20} className="mr-2" /> {t('settings.account.btnAddAuthlib')}</span>
                </OreButton>
              )}
            </div>

            {accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 border-[2px] border-dashed border-[var(--ore-border-color)] bg-[#141415]/50 rounded-sm w-full max-w-2xl">
                <Users size={56} className="mb-4 opacity-20" />
                <span className="text-ore-text-muted font-minecraft text-xl tracking-wider">{t('settings.account.noAccount')}</span>
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
            <span className="text-ore-text-muted font-minecraft text-sm mb-5">{t('settings.account.noMcTip')}</span>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <FocusItem focusKey="link-buy-mc" onEnter={() => openShell('https://www.minecraft.net/zh-hans/store/minecraft-java-bedrock-edition-pc')}>
                {({ ref, focused }) => (
                  <button
                    ref={ref as any} onClick={() => openShell('https://www.minecraft.net/zh-hans/store/minecraft-java-bedrock-edition-pc')}
                    className={`flex items-center text-sm text-green-400 hover:text-green-300 transition-all font-minecraft px-4 py-2 bg-green-400/10 rounded-full outline-none ${focused ? 'outline outline-[2px] outline-white scale-105 shadow-lg' : 'hover:underline'}`}
                  >
                    <ShoppingCart size={16} className="mr-2" /> {t('settings.account.buyMc')}</button>
                )}
              </FocusItem>

              <FocusItem focusKey="link-buy-ms" onEnter={() => openShell('ms-windows-store://pdp/?productid=9NXP44L49SHJ')}>
                {({ ref, focused }) => (
                  <button
                    ref={ref as any} onClick={() => openShell('ms-windows-store://pdp/?productid=9NXP44L49SHJ')}
                    className={`flex items-center text-sm text-purple-400 hover:text-purple-300 transition-all font-minecraft px-4 py-2 bg-purple-400/10 rounded-full outline-none ${focused ? 'outline outline-[2px] outline-white scale-105 shadow-lg' : 'hover:underline'}`}
                  >
                    <ShoppingCart size={16} className="mr-2" /> {t('settings.account.buyMs')}</button>
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

      <AuthlibAuthModal
        isOpen={isAuthlibModalOpen}
        onClose={closeAuthlibLogin}
        authlibForm={authlibForm}
        setAuthlibForm={setAuthlibForm}
        authlibError={authlibError}
        setAuthlibError={setAuthlibError}
        isLoading={isAuthlibLoading}
        handleLogin={handleAuthlibLogin}
      />

      {/* 删除确认弹窗依然留在页面内，因为它强关联于当前的账号列表展示逻辑 */}
      <OreModal isOpen={!!accountToDelete} onClose={() => setAccountToDelete(null)} title={t('settings.account.delConfirmTitle')}>
        <div className="p-6 flex flex-col">
          <div className="bg-red-500/10 border-[2px] border-red-500/50 p-4 flex items-start mb-6 rounded-sm">
            <AlertTriangle size={18} className="text-red-500 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400/90 leading-relaxed font-minecraft">
              {t('settings.account.delConfirmDesc')}
            </p>
          </div>
          <div className="flex justify-end space-x-3 mt-2">
            <OreButton focusKey="btn-del-cancel" variant="secondary" onClick={() => setAccountToDelete(null)}>{t('settings.account.cancel')}</OreButton>
            <OreButton focusKey="btn-del-confirm" variant="danger" onClick={confirmDelete}>{t('settings.account.confirmDel')}</OreButton>
          </div>
        </div>
      </OreModal>
    </SettingsPageLayout>
  );
};
