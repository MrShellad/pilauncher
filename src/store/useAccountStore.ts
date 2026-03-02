import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface MinecraftAccount {
  uuid: string;
  name: string;
  type: 'microsoft' | 'offline';
  accessToken: string;
  refreshToken?: string;
  skinUrl?: string;
}

interface AccountStore {
  accounts: MinecraftAccount[];
  activeAccountId: string | null;
  addAccount: (account: MinecraftAccount) => void;
  removeAccount: (uuid: string) => void;
  setActiveAccount: (uuid: string) => void;
}

export const useAccountStore = create<AccountStore>()(
  persist(
    (set) => ({
      accounts: [],
      activeAccountId: null,
      
      addAccount: (account) => set((state) => {
        // 如果已存在同 UUID 账号则覆盖，否则追加
        const exists = state.accounts.some(a => a.uuid === account.uuid);
        const newAccounts = exists 
          ? state.accounts.map(a => a.uuid === account.uuid ? account : a)
          : [...state.accounts, account];
          
        return { 
          accounts: newAccounts,
          activeAccountId: account.uuid // 新添加的账号自动设为当前激活
        };
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
    {
      name: 'pilauncher-accounts', // 独立存储账户信息
      // TODO: 生产环境中，最好对账户 Token 进行本地系统级加密存储 (如 tauri-plugin-stronghold)
      // 目前开发阶段先明文存在 localStorage 或普通 JSON 中方便调试
    }
  )
);