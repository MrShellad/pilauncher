import { useCallback, useState } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

import type { MinecraftAccount } from '../../../store/useAccountStore';
import type {
  WardrobeSkinLibrary,
  WardrobeProfile,
  SkinCardAsset,
  WardrobeSkinModel,
  WardrobeCape,
} from '../types';
import { validateSkinImage, findActiveSkin } from '../utils/wardrobe.utils';

export interface UseSkinAssetsManagerOptions {
  currentAccount: MinecraftAccount | null;
  isMicrosoft: boolean;
  activeCape: WardrobeCape | null;
  pageSkinModel: WardrobeSkinModel;
  setPageSkinModel: (model: WardrobeSkinModel) => void;
  setSkinLibrary: (library: WardrobeSkinLibrary) => void;
  setProfile: (profile: WardrobeProfile, accountUuid?: string) => void;
  setError: (error: string | null) => void;
  setNotice: (notice: string | null) => void;
  fetchSkinLibrary: (uuid: string) => Promise<WardrobeSkinLibrary>;
  runWithSessionRefresh: <T>(account: MinecraftAccount, action: (acc: MinecraftAccount) => Promise<T>) => Promise<T>;
  touchAccountSkinCache: (account: MinecraftAccount, url?: string | null) => void;
  syncViewerToCurrentState: () => void;
}

export function useSkinAssetsManager(options: UseSkinAssetsManagerOptions) {
  const {
    currentAccount,
    isMicrosoft,
    activeCape,
    pageSkinModel,
    setPageSkinModel,
    setSkinLibrary,
    setProfile,
    setError,
    setNotice,
    fetchSkinLibrary,
    runWithSessionRefresh,
    touchAccountSkinCache,
    syncViewerToCurrentState,
  } = options;

  const [isApplying, setIsApplying] = useState(false);
  const [skinMenuAsset, setSkinMenuAsset] = useState<SkinCardAsset | null>(null);
  const [skinMenuModel, setSkinMenuModel] = useState<WardrobeSkinModel>('classic');
  const [capeMenuAsset, setCapeMenuAsset] = useState<WardrobeCape | null>(null);

  const closeSkinMenu = useCallback(
    (restoreViewer = true) => {
      setSkinMenuAsset(null);
      if (restoreViewer) {
        syncViewerToCurrentState();
      }
    },
    [syncViewerToCurrentState]
  );

  const handleOpenSkinMenu = useCallback((asset: SkinCardAsset) => {
    setSkinMenuAsset(asset);
    setSkinMenuModel(asset.variant);
  }, []);

  const handleChooseSkin = useCallback(async () => {
    if (!currentAccount) {
      setError('请先添加一个游戏账号');
      return;
    }

    const selected = await openDialog({
      multiple: false,
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    });

    if (!selected || typeof selected !== 'string') return;

    const previewUrl = convertFileSrc(selected);
    setError(null);

    try {
      await validateSkinImage(previewUrl);
      const nextLibrary = await invoke<WardrobeSkinLibrary>('save_wardrobe_skin_asset', {
        accountUuid: currentAccount.uuid,
        sourcePath: selected,
        variant: pageSkinModel,
      });

      setSkinLibrary(nextLibrary);
      setNotice('皮肤已加入资产库');
    } catch (caughtError) {
      setError(String(caughtError instanceof Error ? caughtError.message : caughtError));
    }
  }, [currentAccount, pageSkinModel, setError, setNotice, setSkinLibrary]);

  const handleChangeSkinMenuModel = useCallback(
    async (nextModel: WardrobeSkinModel) => {
      setSkinMenuModel(nextModel);

      if (!skinMenuAsset || !currentAccount) {
        return;
      }

      if (skinMenuAsset.kind === 'library') {
        try {
          const nextLibrary = await invoke<WardrobeSkinLibrary>('set_wardrobe_skin_asset_variant', {
            accountUuid: currentAccount.uuid,
            assetId: skinMenuAsset.id,
            variant: nextModel,
          });
          setSkinLibrary(nextLibrary);
        } catch (caughtError) {
          setError(String(caughtError));
        }
      }

      if (skinMenuAsset.isActive) {
        setPageSkinModel(nextModel);
        
        try {
          if (isMicrosoft) {
            const nextProfile = await runWithSessionRefresh(currentAccount, (accountForAction) =>
              invoke<WardrobeProfile>('update_active_wardrobe_skin_variant', {
                accessToken: accountForAction.accessToken,
                accountUuid: accountForAction.uuid,
                variant: nextModel,
              })
            );
            setProfile(nextProfile, currentAccount.uuid);
          } else {
            // For offline, we just need to ensure the local storage points to this variant.
            // If it was kind 'library', we already updated it above. 
            // If it was kind 'profile', offline accounts don't have 'profile', so we're covered.
          }
        } catch (caughtError) {
          setError(String(caughtError));
        }
      }
    },
    [currentAccount, isMicrosoft, runWithSessionRefresh, setError, setPageSkinModel, setProfile, setSkinLibrary, skinMenuAsset]
  );

  const handleApplySkinAsset = useCallback(async () => {
    if (!currentAccount || !skinMenuAsset || skinMenuAsset.kind !== 'library' || !skinMenuAsset.filePath) {
      return;
    }

    setIsApplying(true);
    setError(null);

    try {
      if (isMicrosoft) {
        const nextProfile = await runWithSessionRefresh(currentAccount, (accountForAction) =>
          invoke<WardrobeProfile>('apply_wardrobe_skin', {
            accessToken: accountForAction.accessToken,
            accountUuid: accountForAction.uuid,
            sourcePath: skinMenuAsset.filePath!,
            variant: skinMenuModel,
          })
        );

        const nextLibrary = await fetchSkinLibrary(currentAccount.uuid);
        setProfile(nextProfile, currentAccount.uuid);
        setSkinLibrary(nextLibrary);
        touchAccountSkinCache(currentAccount, findActiveSkin(nextProfile)?.url);
      } else {
        const nextLibrary = await invoke<WardrobeSkinLibrary>('set_active_wardrobe_skin_offline', {
          accountUuid: currentAccount.uuid,
          assetId: skinMenuAsset.id,
        });

        setSkinLibrary(nextLibrary);
        
        let localPath = skinMenuAsset.filePath;
        if (!localPath.endsWith("skin.png")) {
           // Provide standard offline skin path to cache buster
           // But since touchAccountSkinCache probably triggers asset:// reloading, any random string triggers it.
           localPath = `runtime/accounts/${currentAccount.uuid}/skin.png`;
        }
        touchAccountSkinCache(currentAccount, localPath);
      }

      setPageSkinModel(skinMenuModel);
      setNotice('皮肤已应用');
      closeSkinMenu(false);
    } catch (caughtError) {
      setError(String(caughtError));
    } finally {
      setIsApplying(false);
    }
  }, [
    closeSkinMenu,
    currentAccount,
    fetchSkinLibrary,
    isMicrosoft,
    runWithSessionRefresh,
    setError,
    setNotice,
    setPageSkinModel,
    setProfile,
    setSkinLibrary,
    skinMenuAsset,
    skinMenuModel,
    touchAccountSkinCache,
  ]);

  const handleDeleteSkinAsset = useCallback(async () => {
    if (!currentAccount || !skinMenuAsset || skinMenuAsset.kind !== 'library' || !skinMenuAsset.canDelete) {
      return;
    }

    setIsApplying(true);
    setError(null);

    try {
      const nextLibrary = await invoke<WardrobeSkinLibrary>('delete_wardrobe_skin_asset', {
        accountUuid: currentAccount.uuid,
        assetId: skinMenuAsset.id,
      });

      setSkinLibrary(nextLibrary);
      setNotice('皮肤已从资产库移除');
      closeSkinMenu(false);
    } catch (caughtError) {
      setError(String(caughtError));
    } finally {
      setIsApplying(false);
    }
  }, [closeSkinMenu, currentAccount, setError, setNotice, setSkinLibrary, skinMenuAsset]);

  const closeCapeMenu = useCallback(() => {
    setCapeMenuAsset(null);
  }, []);

  const handleOpenCapeMenu = useCallback((cape: WardrobeCape) => {
    setCapeMenuAsset(cape);
  }, []);

  const handleApplyCape = useCallback(
    async () => {
      if (!currentAccount || !isMicrosoft || !capeMenuAsset) return;

      const shouldClear = activeCape?.id === capeMenuAsset.id;
      setIsApplying(true);
      setError(null);

      try {
        const nextProfile = shouldClear
          ? await runWithSessionRefresh(currentAccount, (accountForAction) =>
              invoke<WardrobeProfile>('clear_active_cape', {
                accessToken: accountForAction.accessToken,
                accountUuid: accountForAction.uuid,
              })
            )
          : await runWithSessionRefresh(currentAccount, (accountForAction) =>
              invoke<WardrobeProfile>('set_active_cape', {
                accessToken: accountForAction.accessToken,
                accountUuid: accountForAction.uuid,
                capeId: capeMenuAsset.id,
              })
            );

        setProfile(nextProfile, currentAccount.uuid);
        touchAccountSkinCache(currentAccount, findActiveSkin(nextProfile)?.url);
        setNotice(shouldClear ? '披风已卸下' : '披风已装备');
        closeCapeMenu();
      } catch (caughtError) {
        setError(String(caughtError));
      } finally {
        setIsApplying(false);
      }
    },
    [
      activeCape?.id,
      capeMenuAsset,
      closeCapeMenu,
      currentAccount,
      isMicrosoft,
      runWithSessionRefresh,
      setError,
      setNotice,
      setProfile,
      touchAccountSkinCache,
    ]
  );

  return {
    isApplying,
    skinMenuAsset,
    skinMenuModel,
    capeMenuAsset,
    handleChooseSkin,
    handleApplySkinAsset,
    handleDeleteSkinAsset,
    handleApplyCape,
    closeSkinMenu,
    handleOpenSkinMenu,
    handleChangeSkinMenuModel,
    closeCapeMenu,
    handleOpenCapeMenu,
    setSkinMenuAsset, // expose if needed for immediate clearing
    setCapeMenuAsset,
  };
}
