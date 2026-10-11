import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import type { MinecraftAccount } from '@/features/account';
import { downloadAndSaveOnlineSkin } from '../services/onlineSkinService';
import type { OnlineSkinItem, WardrobeSkinLibrary, WardrobeSkinModel } from '../types';
import type { ShowWardrobeBanner } from './useWardrobeBanner';
import type { useSkinAssetsManager } from './useSkinAssetsManager';
import type { useWardrobeViewerControl } from './useWardrobeViewerControl';

interface UseWardrobeOnlineSkinActionsOptions {
  currentAccount: MinecraftAccount | null;
  skinLibrary: WardrobeSkinLibrary | null;
  activeCapeUrl: string | null;
  setSkinModel: Dispatch<SetStateAction<WardrobeSkinModel>>;
  setSkinLibrary: (library: WardrobeSkinLibrary | null, accountUuid?: string) => void;
  loadViewerState: ReturnType<typeof useWardrobeViewerControl>['loadViewerState'];
  playTransientAnimation: ReturnType<typeof useWardrobeViewerControl>['playTransientAnimation'];
  applyDirectSkinAsset: ReturnType<typeof useSkinAssetsManager>['applyDirectSkinAsset'];
  handleChangeSkinNote: (assetId: string, note: string) => void;
  showBanner: ShowWardrobeBanner;
}

export function useWardrobeOnlineSkinActions({
  currentAccount,
  skinLibrary,
  activeCapeUrl,
  setSkinModel,
  setSkinLibrary,
  loadViewerState,
  playTransientAnimation,
  applyDirectSkinAsset,
  handleChangeSkinNote,
  showBanner,
}: UseWardrobeOnlineSkinActionsOptions) {
  const [onlineMenuAsset, setOnlineMenuAsset] = useState<OnlineSkinItem | null>(null);
  const [isOnlineProcessing, setIsOnlineProcessing] = useState(false);

  const handlePreviewOnlineSkin = useCallback(
    (item: OnlineSkinItem, model: WardrobeSkinModel) => {
      setSkinModel(model);
      void loadViewerState(item.skinUrl, activeCapeUrl, model, 'skin');
      playTransientAnimation('interact', 1200);
      showBanner('info', `已在 3D 展台试穿: ${item.title}`);
    },
    [activeCapeUrl, loadViewerState, playTransientAnimation, setSkinModel, showBanner]
  );

  const handleSaveOnlineSkinToLibrary = useCallback(
    async (item: OnlineSkinItem, model: WardrobeSkinModel, customTitle?: string) => {
      if (!currentAccount) return;
      setIsOnlineProcessing(true);
      try {
        const previousIds = new Set((skinLibrary?.assets ?? []).map((asset) => asset.id));
        const nextLibrary = await downloadAndSaveOnlineSkin(currentAccount.uuid, item, model);
        setSkinLibrary(nextLibrary, currentAccount.uuid);

        const newlyAddedAsset =
          nextLibrary.assets.find((asset) => !previousIds.has(asset.id)) ||
          nextLibrary.assets[0];

        const targetTitle = (customTitle && customTitle.trim()) || item.title;
        if (newlyAddedAsset && targetTitle) {
          handleChangeSkinNote(newlyAddedAsset.id, targetTitle.trim());
        }

        showBanner('important', `皮肤 “${targetTitle || item.title}” 已下载并存入本地皮肤库！`);
        setOnlineMenuAsset(null);
      } catch (error) {
        showBanner('danger', String(error instanceof Error ? error.message : error));
      } finally {
        setIsOnlineProcessing(false);
      }
    },
    [currentAccount, handleChangeSkinNote, setSkinLibrary, showBanner, skinLibrary]
  );

  const handleApplyOnlineSkin = useCallback(
    async (item: OnlineSkinItem, model: WardrobeSkinModel, customTitle?: string) => {
      if (!currentAccount) return;
      setIsOnlineProcessing(true);
      try {
        const previousIds = new Set((skinLibrary?.assets ?? []).map((asset) => asset.id));
        const nextLibrary = await downloadAndSaveOnlineSkin(currentAccount.uuid, item, model);
        setSkinLibrary(nextLibrary, currentAccount.uuid);

        const targetAsset =
          nextLibrary.assets.find((asset) => !previousIds.has(asset.id)) ||
          nextLibrary.assets[0];

        if (targetAsset) {
          const targetTitle = (customTitle && customTitle.trim()) || item.title;
          if (targetTitle) {
            handleChangeSkinNote(targetAsset.id, targetTitle.trim());
          }

          await applyDirectSkinAsset(targetAsset, model);
        }

        showBanner('important', `皮肤 “${customTitle?.trim() || item.title}” 已成功应用至当前角色！`);
        setOnlineMenuAsset(null);
      } catch (error) {
        showBanner('danger', String(error instanceof Error ? error.message : error));
      } finally {
        setIsOnlineProcessing(false);
      }
    },
    [applyDirectSkinAsset, currentAccount, handleChangeSkinNote, setSkinLibrary, showBanner, skinLibrary]
  );

  return {
    onlineMenuAsset,
    setOnlineMenuAsset,
    isOnlineProcessing,
    handlePreviewOnlineSkin,
    handleSaveOnlineSkinToLibrary,
    handleApplyOnlineSkin,
  };
}
