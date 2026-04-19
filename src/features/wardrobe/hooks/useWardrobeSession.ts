import { useCallback, useState, useRef } from 'react';
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
  const { 
    setProfile: setCachedProfile, 
    getProfile: getCachedProfile,
    setLibrary: setCachedLibrary,
    getLibrary: getCachedLibrary
  } = useWardrobeStore();

  const [profile, setProfileState] = useState<WardrobeProfile | null>(null);
  const [skinLibrary, setSkinLibraryState] = useState<WardrobeSkinLibrary | null>(null);

  const setSkinLibrary = useCallback(
    (newLibrary: WardrobeSkinLibrary | null, accountUuid?: string) => {
      setSkinLibraryState((prev) => {
        // 局部更新优化：如果数据内容完全一致，则不触发重绘
        if (JSON.stringify(prev) === JSON.stringify(newLibrary)) {
          return prev;
        }
        return newLibrary;
      });
      
      if (newLibrary && accountUuid) {
        setCachedLibrary(accountUuid, newLibrary);
      }
    },
    [setCachedLibrary]
  );

  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const isHydratingRef = useRef(false); // 核心并发锁，确保 hydrateWardrobe 引用稳定
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
      const nextUrl = skinUrl || account.skinUrl || account.uuid;
      const currentUrlNoTs = account.skinUrl?.split('?t=')[0];

      // 如果 URL 没变（忽略时间戳），则不更新 Store 以免引起重绘
      if (currentUrlNoTs === nextUrl) return;

      updateAccount(account.uuid, {
        skinUrl: `${nextUrl}?t=${Date.now()}`,
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
      silent = false
    ) => {
      // 使用 Ref 进行并发检查，避免 isLoadingProfile 引起函数引用变化
      if (isHydratingRef.current) return;

      setError(null);
      
      const cachedProfile = getCachedProfile(account.uuid);
      const cachedLibrary = getCachedLibrary(account.uuid);

      if (cachedProfile) {
        setProfileState(cachedProfile);
        onModelResolved(resolveSkinModel(findActiveSkin(cachedProfile)?.variant));
      }
      if (cachedLibrary) {
        setSkinLibraryState(cachedLibrary);
      }

      const isMicrosoft = isMicrosoftAccount(account);
      
      isHydratingRef.current = true;
      setIsLoadingProfile(true);

      try {
        if (isMicrosoft) {
          const [nextProfile, nextLibrary] = await Promise.all([
            loadProfile(account),
            fetchSkinLibrary(account.uuid)
          ]);
          
          const nextModel = resolveSkinModel(findActiveSkin(nextProfile)?.variant);

          setProfile(nextProfile, account.uuid);
          setSkinLibrary(nextLibrary, account.uuid);
          onModelResolved(nextModel);
          touchAccountSkinCache(account, findActiveSkin(nextProfile)?.url);

          if (!silent) setNotice('资产已同步');
        } else {
          const nextLibrary = await fetchSkinLibrary(account.uuid);
          setSkinLibrary(nextLibrary, account.uuid);
          
          const activeLocalAsset = nextLibrary.assets.find(a => a.isActive);
          if (activeLocalAsset?.variant) {
            onModelResolved(resolveSkinModel(activeLocalAsset.variant));
          }

          if (!silent) setNotice('本地预览已同步');
        }
      } catch (caughtError) {
        if (!cachedProfile && !cachedLibrary) {
          setError(String(caughtError));
        } else {
          console.error('[Hydrate] Background sync failed:', caughtError);
        }
      } finally {
        setIsLoadingProfile(false);
        isHydratingRef.current = false;
      }
    },
    [fetchSkinLibrary, getCachedLibrary, getCachedProfile, loadProfile, setProfile, setSkinLibrary, touchAccountSkinCache]
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
