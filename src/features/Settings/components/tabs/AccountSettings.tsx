// src/features/Settings/components/tabs/AccountSettings.tsx
import React, { useState } from 'react';
import { open as openShell } from '@tauri-apps/plugin-shell';
import { Users, Plus, Loader2, Copy, AlertTriangle, ShoppingCart } from 'lucide-react';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreInput } from '../../../../ui/primitives/OreInput';

// ✅ 引入焦点项支持底部自定义按键
import { FocusItem } from '../../../../ui/focus/FocusItem';

import { useAccountStore } from '../../../../store/useAccountStore';
import { AccountCard } from './AS/AccountCard';
import { useMicrosoftAuth } from '../../hooks/useMicrosoftAuth';
import { useOfflineAuth } from '../../hooks/useOfflineAuth';

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
    offlineForm, setOfflineForm, offlineError,
    openAddOffline, openEditOffline, handleSaveOffline, handleUploadSkin
  } = useOfflineAuth();

  const confirmDelete = () => {
    if (accountToDelete) {
      removeAccount(accountToDelete);
      setAccountToDelete(null);
    }
  };

  return (
    <SettingsPageLayout title="账户管理" subtitle="Account & Profile">
      <SettingsSection title="账户库" icon={<Users size={18} />}>
        <div className="p-6 flex flex-col min-h-[400px]">
          
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <OreButton focusKey="btn-add-ms" onClick={startMicrosoftLogin} className="flex items-center !bg-purple-600 hover:!bg-purple-500 !text-white !border-none shadow-[0_0_15px_rgba(147,51,234,0.3)]">
              <Plus size={16} className="mr-2" /> 添加微软账号
            </OreButton>
            <OreButton focusKey="btn-add-offline" variant="secondary" onClick={openAddOffline} className="flex items-center">
              <Plus size={16} className="mr-2" /> 添加离线账号
            </OreButton>
          </div>

          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-[#1E1E1F] bg-[#141415]/50 rounded-lg flex-1">
              <Users size={48} className="mb-4 opacity-20" />
              <span className="text-ore-text-muted font-minecraft text-lg">尚未添加任何游戏账户</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch">
              {accounts.map(acc => (
                <AccountCard 
                  key={acc.uuid} 
                  account={acc} 
                  isActive={activeAccountId === acc.uuid}
                  onSetCurrent={setActiveAccount}
                  onRemove={setAccountToDelete}
                  onEdit={openEditOffline}
                  onUploadSkin={handleUploadSkin}
                />
              ))}
            </div>
          )}

          <div className="mt-auto pt-8 flex flex-col items-center">
            <span className="text-ore-text-muted font-minecraft text-sm mb-5">尚未拥有 Minecraft 正版授权？通过官方渠道安全获取游戏</span>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {/* ✅ 重构底部跳转链接为 FocusItem，完美支持手柄选择 */}
              <FocusItem focusKey="link-buy-mc" onEnter={() => openShell('https://www.minecraft.net/zh-hans/store/minecraft-java-bedrock-edition-pc')}>
                {({ ref, focused }) => (
                  <button 
                    ref={ref as any} onClick={() => openShell('https://www.minecraft.net/zh-hans/store/minecraft-java-bedrock-edition-pc')} 
                    className={`flex items-center text-sm text-green-400 hover:text-green-300 transition-all font-minecraft px-4 py-2 bg-green-400/10 rounded-full outline-none ${focused ? 'ring-2 ring-green-400 scale-105 shadow-lg' : 'hover:underline'}`}
                  >
                    <ShoppingCart size={16} className="mr-2" /> Minecraft 官网获取
                  </button>
                )}
              </FocusItem>

              <FocusItem focusKey="link-buy-ms" onEnter={() => openShell('ms-windows-store://pdp/?productid=9NXP44L49SHJ')}>
                {({ ref, focused }) => (
                  <button 
                    ref={ref as any} onClick={() => openShell('ms-windows-store://pdp/?productid=9NXP44L49SHJ')} 
                    className={`flex items-center text-sm text-blue-400 hover:text-blue-300 transition-all font-minecraft px-4 py-2 bg-blue-400/10 rounded-full outline-none ${focused ? 'ring-2 ring-blue-400 scale-105 shadow-lg' : 'hover:underline'}`}
                  >
                    <ShoppingCart size={16} className="mr-2" /> 微软商店 (Windows Store)
                  </button>
                )}
              </FocusItem>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* ================= 微软登录专用弹窗 ================= */}
      <OreModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} title="微软账号登录" closeOnOverlayClick={false}>
        {/* ✅ 问题修复1：增加了弹窗内部的 px-8 和 py-8 */}
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
              <div className="bg-[#141415] border-2 border-[#1E1E1F] px-8 py-4 mb-6"><span className="text-4xl font-minecraft text-white tracking-widest">{deviceCodeInfo.user_code}</span></div>
              <OreButton focusKey="btn-ms-copy" onClick={copyCodeAndOpen} size="lg" className="w-full flex items-center justify-center font-minecraft"><Copy size={18} className="mr-2" /> 复制验证码并打开浏览器</OreButton>
              <div className={`mt-6 flex items-center text-xs font-minecraft ${loginStatusMsg.includes('失败') ? 'text-red-400' : 'text-ore-text-muted'}`}>
                {!loginStatusMsg.includes('失败') && <Loader2 size={12} className="animate-spin mr-2" />} {loginStatusMsg}
              </div>
            </>
          )}
        </div>
      </OreModal>

      {/* ================= 离线账号管理弹窗 ================= */}
      <OreModal isOpen={isOfflineModalOpen} onClose={() => setIsOfflineModalOpen(false)} title={offlineForm.isEdit ? "配置离线账号" : "创建离线账号"}>
        {/* ✅ 问题修复1：增加了弹窗内部的 p-6 */}
        <div className="flex flex-col p-6 sm:p-8">
          <label className="text-sm text-ore-text-muted font-bold tracking-wider mb-2">玩家名称 (ID)</label>
          <OreInput 
            focusKey="input-offline-name" // ✅ 焦点接入
            value={offlineForm.name} 
            onChange={(e) => setOfflineForm({ ...offlineForm, name: e.target.value })} 
            placeholder="例如: Steve_123" 
            className="font-minecraft text-lg mb-2 bg-[#141415]"
            maxLength={16}
          />
          <div className="text-xs text-gray-500 font-minecraft mb-6">
            规则：长度 3~16 位，只允许英文字母、数字及下划线。
          </div>

          {offlineForm.isEdit && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 flex items-start mb-6 rounded-sm">
              <AlertTriangle size={18} className="text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-500/90 leading-relaxed font-minecraft">
                <strong className="text-yellow-400">警告：</strong> 修改名称会导致联机 UUID 强制变更。<br/>
                您的单机世界存档和离线服务器将会把您识别为一个<strong className="text-yellow-400">全新的玩家</strong>，旧角色的物品栏和进度将无法直接继承！
              </p>
            </div>
          )}

          {offlineError && <div className="text-red-400 text-xs font-minecraft mb-4">{offlineError}</div>}

          <div className="flex justify-end space-x-3 mt-4">
            <OreButton focusKey="btn-offline-cancel" variant="secondary" onClick={() => setIsOfflineModalOpen(false)}>取消</OreButton>
            <OreButton focusKey="btn-offline-confirm" variant="primary" onClick={handleSaveOffline}>{offlineForm.isEdit ? '确认修改' : '确认创建'}</OreButton>
          </div>
        </div>
      </OreModal>

      {/* ================= 账号删除二次确认弹窗 ================= */}
      <OreModal isOpen={!!accountToDelete} onClose={() => setAccountToDelete(null)} title="确认移除账号">
        <div className="p-6 flex flex-col">
          <div className="bg-red-500/10 border border-red-500/30 p-4 flex items-start mb-6 rounded-sm">
            <AlertTriangle size={18} className="text-red-500 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400/90 leading-relaxed font-minecraft">
              确定要移除此账号吗？此操作仅会从启动器中移除该身份，<br/>不会删除您的任何本地游戏存档数据。
            </p>
          </div>
          <div className="flex justify-end space-x-3 mt-2">
            <OreButton focusKey="btn-del-cancel" variant="secondary" onClick={() => setAccountToDelete(null)}>取消操作</OreButton>
            <OreButton focusKey="btn-del-confirm" variant="primary" className="!bg-red-500 hover:!bg-red-600 !text-white !border-none" onClick={confirmDelete}>确认移除</OreButton>
          </div>
        </div>
      </OreModal>

    </SettingsPageLayout>
  );
};