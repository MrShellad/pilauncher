import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import i18n from '../../../ui/i18';
import { useAccountStore, type MinecraftAccount } from '../../../store/useAccountStore';

export interface AuthlibFormState {
  apiRoot: string;
  username: string;
  password: string;
}

const initialForm: AuthlibFormState = {
  apiRoot: '',
  username: '',
  password: '',
};

export const useAuthlibAuth = () => {
  const addAccount = useAccountStore((state) => state.addAccount);
  const [isAuthlibModalOpen, setIsAuthlibModalOpen] = useState(false);
  const [authlibForm, setAuthlibForm] = useState<AuthlibFormState>(initialForm);
  const [authlibError, setAuthlibError] = useState('');
  const [isAuthlibLoading, setIsAuthlibLoading] = useState(false);

  const openAuthlibLogin = () => {
    setAuthlibError('');
    setAuthlibForm((prev) => ({ ...prev, password: '' }));
    setIsAuthlibModalOpen(true);
  };

  const closeAuthlibLogin = () => {
    if (isAuthlibLoading) return;
    setIsAuthlibModalOpen(false);
  };

  const handleAuthlibLogin = async () => {
    const apiRoot = authlibForm.apiRoot.trim();
    const username = authlibForm.username.trim();
    const password = authlibForm.password;

    setAuthlibError('');

    if (!apiRoot) {
      setAuthlibError(i18n.t('settings.account.authlib.errors.missingApiRoot'));
      return;
    }

    if (!username || !password) {
      setAuthlibError(i18n.t('settings.account.authlib.errors.missingCredentials'));
      return;
    }

    setIsAuthlibLoading(true);
    try {
      const rawAccount = await invoke<any>('login_authlib', {
        apiRoot,
        username,
        password,
      });

      const accountData: MinecraftAccount = {
        uuid: rawAccount.uuid || rawAccount.id || rawAccount.profileId || '',
        name: rawAccount.username || rawAccount.name || rawAccount.displayName || username,
        type: 'authlib',
        accessToken: rawAccount.access_token || rawAccount.accessToken || '',
        refreshToken: rawAccount.refresh_token || rawAccount.refreshToken || null,
        expiresAt: rawAccount.expires_at || rawAccount.expiresAt || null,
        skinUrl: rawAccount.skin_url || rawAccount.skinUrl || null,
        authlibApiRoot:
          rawAccount.authlib_api_root || rawAccount.authlibApiRoot || apiRoot,
      };

      addAccount(accountData);
      setAuthlibForm((prev) => ({ ...prev, password: '' }));
      setIsAuthlibModalOpen(false);
    } catch (error) {
      setAuthlibError(String(error));
    } finally {
      setIsAuthlibLoading(false);
    }
  };

  return {
    isAuthlibModalOpen,
    setIsAuthlibModalOpen,
    authlibForm,
    setAuthlibForm,
    authlibError,
    setAuthlibError,
    isAuthlibLoading,
    openAuthlibLogin,
    closeAuthlibLogin,
    handleAuthlibLogin,
  };
};
