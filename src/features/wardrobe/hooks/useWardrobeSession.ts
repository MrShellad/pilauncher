import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { useAccountStore, type MinecraftAccount } from '../../../store/useAccountStore';
import { useWardrobeStore } from '../../../store/useWardrobeStore';
import type { WardrobeProfile, WardrobeSkinLibrary } from '../types';
import {
  isMicrosoftAccount,
  isSessionExpiredError,
  toAccountData,
  resolveSkinModel,
  findActiveSkin,
} from '../utils/wardrobe.utils';

export function useWardrobeSession() {
  const { updateAccount } = useAccountStore();
  const { setProfile: setCachedProfile, getProfile: getCachedProfile } = useWardrobeStore();

  const [profile, setProfileState] = useState<WardrobeProfile | null>(null);
  const [skinLibrary, setSkinLibrary] = useState<WardrobeSkinLibrary | null>(null);

  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchSkinLibrary = useCallback(async (accountUuid: string) => {
    return invoke<WardrobeSkinLibrary>('get_wardrobe_skin_library', {
      accountUuid,
    });
  }, []);

  const refreshAccountSession = useCallback(
    async (account: MinecraftAccount) => {
      if (!account.refreshToken) {
        throw new Error('会话已过期，请重新登录微软账号');
      }

      setNotice('会话已过期，正在刷新登录状态');
      const rawAccount = await invoke<Record<string, any>>('refresh_microsoft_token', {
        refreshToken: account.refreshToken,
      });
      const refreshed = toAccountData(rawAccount, account);
      updateAccount(account.uuid, refreshed);
      setNotice('账号会话已刷新');
      return refreshed;
    },
    [updateAccount]
  );

  const runWithSessionRefresh = useCallback(
    async <T,>(
      account: MinecraftAccount,
      action: (accountForAction: MinecraftAccount) => Promise<T>
    ): Promise<T> => {
      try {
        return await action(account);
      } catch (caughtError) {
        if (!isMicrosoftAccount(account) || !isSessionExpiredError(caughtError)) {
          throw caughtError;
        }

        const refreshed = await refreshAccountSession(account);
        return action(refreshed);
      }
    },
    [refreshAccountSession]
  );

  const loadProfile = useCallback(
    async (account: MinecraftAccount) => {
      return runWithSessionRefresh(account, (accountForAction) =>
        invoke<WardrobeProfile>('get_wardrobe_profile', {
          accessToken: accountForAction.accessToken,
          accountUuid: accountForAction.uuid,
        })
      );
    },
    [runWithSessionRefresh]
  );

  const touchAccountSkinCache = useCallback(
    (account: MinecraftAccount, skinUrl?: string | null) => {
      updateAccount(account.uuid, {
        skinUrl: `${skinUrl || account.skinUrl || account.uuid}?t=${Date.now()}`,
      });
    },
    [updateAccount]
  );

  const setProfile = useCallback(
    (newProfile: WardrobeProfile | null, accountUuid?: string) => {
      setProfileState(newProfile);
      if (newProfile && accountUuid) {
        setCachedProfile(accountUuid, newProfile);
      }
    },
    [setCachedProfile]
  );

  const hydrateWardrobe = useCallback(
    async (
      account: MinecraftAccount,
      onModelResolved: (model: ReturnType<typeof resolveSkinModel>) => void,
      onClearSkinMenuAsset: () => void,
      silent = false
    ) => {
      setError(null);
      onClearSkinMenuAsset();

      if (isMicrosoftAccount(account)) {
        if (silent) {
          const cached = getCachedProfile(account.uuid);
          if (cached) {
            setProfile(cached);
            try {
              const nextLibrary = await fetchSkinLibrary(account.uuid);
              setSkinLibrary(nextLibrary);
              onModelResolved(resolveSkinModel(findActiveSkin(cached)?.variant));
            } catch (err) {
               console.error(err);
            }
            return;
          }
        }

        setIsLoadingProfile(true);
        try {
          const nextProfile = await loadProfile(account);
          const nextLibrary = await fetchSkinLibrary(account.uuid);
          const nextModel = resolveSkinModel(findActiveSkin(nextProfile)?.variant);

          setProfile(nextProfile, account.uuid);
          setSkinLibrary(nextLibrary);
          onModelResolved(nextModel);
          touchAccountSkinCache(account, findActiveSkin(nextProfile)?.url);

          if (!silent) {
            setNotice('皮肤与披风资产已同步');
          }
        } catch (caughtError) {
          setError(String(caughtError));
        } finally {
          setIsLoadingProfile(false);
        }

        return;
      }

      setProfile(null);
      try {
        const nextLibrary = await fetchSkinLibrary(account.uuid);
        setSkinLibrary(nextLibrary);
        
        const activeLocalAsset = nextLibrary.assets.find(a => a.isActive);
        if (activeLocalAsset && activeLocalAsset.variant) {
          onModelResolved(resolveSkinModel(activeLocalAsset.variant));
        }

        setNotice(silent ? '离线账号可在本地管理皮肤，披风需要微软正版账号' : '本地皮肤资产已刷新');
      } catch (caughtError) {
        setError(String(caughtError));
      }
    },
    [fetchSkinLibrary, loadProfile, touchAccountSkinCache]
  );

  return {
    profile,
    setProfile,
    skinLibrary,
    setSkinLibrary,
    isLoadingProfile,
    error,
    setError,
    notice,
    setNotice,
    fetchSkinLibrary,
    refreshAccountSession,
    runWithSessionRefresh,
    loadProfile,
    touchAccountSkinCache,
    hydrateWardrobe,
  };
}
