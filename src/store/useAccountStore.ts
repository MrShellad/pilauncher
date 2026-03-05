// src/store/useAccountStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MinecraftAccount {
  uuid: string;
  name: string;
  // ✅ 将 type 改为支持任意字符串，为以后的 LittleSkin / 自建外置登录铺路
  type: 'microsoft' | 'offline' | string; 
  accessToken: string;
  refreshToken?: string;
  skinUrl?: string;
}

interface AccountStore {
  accounts: MinecraftAccount[];
  activeAccountId: string | null;
  addAccount: (account: MinecraftAccount) => void;
  updateAccount: (oldUuid: string, updates: Partial<MinecraftAccount>) => void; // ✅ 新增修改方法
  removeAccount: (uuid: string) => void;
  setActiveAccount: (uuid: string) => void;
}

export const useAccountStore = create<AccountStore>()(
  persist(
    (set) => ({
      accounts: [],
      activeAccountId: null,
      
      addAccount: (account) => set((state) => {
        const exists = state.accounts.some(a => a.uuid === account.uuid);
        const newAccounts = exists 
          ? state.accounts.map(a => a.uuid === account.uuid ? account : a)
          : [...state.accounts, account];
          
        return { 
          accounts: newAccounts,
          activeAccountId: account.uuid 
        };
      }),

      // ✅ 核心逻辑：修改账号时，如果 UUID 发了生改变，自动迁移活动状态
      updateAccount: (oldUuid, updates) => set((state) => {
        const newAccounts = state.accounts.map(a => 
          a.uuid === oldUuid ? { ...a, ...updates } : a
        );
        let newActiveId = state.activeAccountId;
        if (state.activeAccountId === oldUuid && updates.uuid) {
          newActiveId = updates.uuid;
        }
        return { accounts: newAccounts, activeAccountId: newActiveId };
      }),

      removeAccount: (uuid) => set((state) => {
        const newAccounts = state.accounts.filter(a => a.uuid !== uuid);
        return {
          accounts: newAccounts,
          activeAccountId: state.activeAccountId === uuid 
            ? (newAccounts[0]?.uuid || null) 
            : state.activeAccountId
        };
      }),

      setActiveAccount: (uuid) => set({ activeAccountId: uuid }),
    }),
    { name: 'pilauncher-accounts' }
  )
);