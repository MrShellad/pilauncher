import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';

import type { MinecraftAccount } from '../../../store/useAccountStore';
import type {
  WardrobeProfile,
  WardrobeSkinLibrary,
  SkinCardAsset,
  WardrobeSkinModel,
  WardrobeCape,
} from '../types';
import {
  determineModelType,
  findActiveCape,
  findActiveSkin,
  resolveSkinModel,
  validateSkinImage,
} from '../utils/wardrobe.utils';

interface UseSkinAssetsManagerProps {
  currentAccount: MinecraftAccount | null;
  isMicrosoft: boolean;
  activeCape: WardrobeCape | null;
  pageSkinModel: WardrobeSkinModel;
  setPageSkinModel: (model: WardrobeSkinModel) => void;
  setSkinLibrary: (library: WardrobeSkinLibrary | null, accountUuid?: string) => void;
  setProfile: (profile: WardrobeProfile, accountUuid: string) => void;
  setError: (err: string | null) => void;
  setNotice: (msg: string | null) => void;
  fetchSkinLibrary: (accountUuid: string) => Promise<WardrobeSkinLibrary>;
  runWithSessionRefresh: <T>(account: MinecraftAccount, action: (account: MinecraftAccount) => Promise<T>) => Promise<T>;
  touchAccountSkinCache: (account: MinecraftAccount, skinUrl?: string | null, capeUrl?: string | null, model?: WardrobeSkinModel) => void;
  syncViewerToCurrentState: () => void;
}

export function useSkinAssetsManager({
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
}: UseSkinAssetsManagerProps) {
  const [isApplying, setIsApplying] = useState(false);
  const [skinMenuAsset, setSkinMenuAsset] = useState<SkinCardAsset | null>(null);
  const [skinMenuModel, setSkinMenuModel] = useState<WardrobeSkinModel>('classic');
  const [capeMenuAsset, setCapeMenuAsset] = useState<WardrobeCape | null>(null);

  const closeSkinMenu = useCallback(() => {
    setSkinMenuAsset(null);
  }, []);

  const handleOpenSkinMenu = useCallback((asset: SkinCardAsset) => {
    setSkinMenuAsset(asset);
    setSkinMenuModel(asset.variant);
  }, []);

  const handleChooseSkin = useCallback(async () => {
    if (!currentAccount) return;

    const selected = await open({
      multiple: false,
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    });

    if (!selected || typeof selected !== 'string') return;

    const previewUrl = convertFileSrc(selected);
    setError(null);

    try {
      await validateSkinImage(previewUrl);
      const autoDetectedVariant = (await determineModelType(previewUrl)) || pageSkinModel;
      const nextLibrary = await invoke<WardrobeSkinLibrary>('save_wardrobe_skin_asset', {
        accountUuid: currentAccount.uuid,
        sourcePath: selected,
        variant: autoDetectedVariant,
      });

      setSkinLibrary(nextLibrary);
      setNotice(`皮肤已加入资产库 (${autoDetectedVariant === 'slim' ? 'Slim 3px 纤细模型' : 'Classic 4px 经典模型'})`);
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
    },
    [currentAccount, setError, setSkinLibrary, skinMenuAsset]
  );

  const applyDirectSkinAsset = useCallback(
    async (asset: { id: string; filePath?: string }, variant: WardrobeSkinModel) => {
      if (!currentAccount || !asset.filePath) return;
      setIsApplying(true);
      setError(null);

      try {
        if (isMicrosoft) {
          const nextProfile = await runWithSessionRefresh(currentAccount, (accountForAction) =>
            invoke<WardrobeProfile>('apply_wardrobe_skin', {
              accessToken: accountForAction.accessToken,
              accountUuid: accountForAction.uuid,
              sourcePath: asset.filePath!,
              variant,
            })
          );

          const nextLibrary = await fetchSkinLibrary(currentAccount.uuid);
          setProfile(nextProfile, currentAccount.uuid);
          setSkinLibrary(nextLibrary);
          touchAccountSkinCache(
            currentAccount,
            asset.filePath,
            findActiveCape(nextProfile)?.url,
            resolveSkinModel(findActiveSkin(nextProfile)?.variant)
          );
        } else {
          const nextLibrary = await invoke<WardrobeSkinLibrary>('set_active_wardrobe_skin_offline', {
            accountUuid: currentAccount.uuid,
            assetId: asset.id,
          });

          setSkinLibrary(nextLibrary);
          touchAccountSkinCache(currentAccount, asset.filePath, null, variant);
        }

        setPageSkinModel(variant);
        setNotice('皮肤已成功应用');
      } catch (caughtError) {
        setError(String(caughtError));
      } finally {
        setIsApplying(false);
      }
    },
    [
      currentAccount,
      fetchSkinLibrary,
      isMicrosoft,
      runWithSessionRefresh,
      setError,
      setNotice,
      setPageSkinModel,
      setProfile,
      setSkinLibrary,
      touchAccountSkinCache,
    ]
  );

  const handleApplySkinAsset = useCallback(async () => {
    if (!skinMenuAsset) return;
    await applyDirectSkinAsset(skinMenuAsset, skinMenuModel);
    closeSkinMenu();
  }, [applyDirectSkinAsset, closeSkinMenu, skinMenuAsset, skinMenuModel]);

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
      closeSkinMenu();
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
        touchAccountSkinCache(
          currentAccount,
          findActiveSkin(nextProfile)?.url,
          findActiveCape(nextProfile)?.url,
          resolveSkinModel(findActiveSkin(nextProfile)?.variant)
        );
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
    applyDirectSkinAsset,
    handleDeleteSkinAsset,
    handleApplyCape,
    closeSkinMenu,
    handleOpenSkinMenu,
    handleChangeSkinMenuModel,
    closeCapeMenu,
    handleOpenCapeMenu,
    setSkinMenuAsset,
    setCapeMenuAsset,
  };
}