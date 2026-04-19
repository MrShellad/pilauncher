import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ArrowLeft } from 'lucide-react';

import type { SkinCardAsset, WardrobeSkinModel, WardrobeTab } from '../features/wardrobe/types';
import {
  isMicrosoftAccount,
  resolveSkinModel,
  findActiveSkin,
  findActiveCape,
  accountSkinPreviewUrl,
  toStoredAssetUrl,
  modelLabel,
} from '../features/wardrobe/utils/wardrobe.utils';
import { useWardrobeSession } from '../features/wardrobe/hooks/useWardrobeSession';
import { useWardrobeViewerControl } from '../features/wardrobe/hooks/useWardrobeViewerControl';
import { useSkinAssetsManager } from '../features/wardrobe/hooks/useSkinAssetsManager';
import { WardrobeViewer } from '../features/wardrobe/components/WardrobeViewer';
import { WardrobeSkinPanel } from '../features/wardrobe/components/WardrobeSkinPanel';
import { WardrobeCapePanel } from '../features/wardrobe/components/WardrobeCapePanel';
import { WardrobeSkinMenuModal } from '../features/wardrobe/components/WardrobeSkinMenuModal';
import { WardrobeCapeMenuModal } from '../features/wardrobe/components/WardrobeCapeMenuModal';

import { useAccountStore } from '../store/useAccountStore';
import { useLauncherStore } from '../store/useLauncherStore';
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { useInputAction } from '../ui/focus/InputDriver';
import { OreToggleButton } from '../ui/primitives/OreToggleButton';

import '../style/pages/Wardrobe.css';

const Wardrobe: React.FC = () => {
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const { accounts, activeAccountId } = useAccountStore();

  const currentAccount = useMemo(
    () => accounts.find((account) => account.uuid === activeAccountId) ?? null,
    [accounts, activeAccountId]
  );

  const [activeSection, setActiveSection] = useState<WardrobeTab>('skin');
  const [skinModel, setSkinModel] = useState<WardrobeSkinModel>('classic');

  const {
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
    runWithSessionRefresh,
    touchAccountSkinCache,
    hydrateWardrobe,
  } = useWardrobeSession();

  const isMicrosoft = isMicrosoftAccount(currentAccount);
  const activeSkin = findActiveSkin(profile);
  const activeCape = findActiveCape(profile);
  const currentSkinUrl = activeSkin?.url || accountSkinPreviewUrl(currentAccount);

  const {
    containerRef,
    loadViewerState,
    syncViewerToCurrentState,
    previewSkinAsset,
  } = useWardrobeViewerControl();

  const restoreViewer = useCallback(() => {
    if (!currentAccount) {
      return;
    }

    void syncViewerToCurrentState(
      currentSkinUrl,
      activeCape?.url ?? null,
      skinModel,
      activeSection,
      currentAccount
    );
  }, [activeCape?.url, activeSection, currentAccount, currentSkinUrl, skinModel, syncViewerToCurrentState]);

  const {
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
    setSkinMenuAsset,
  } = useSkinAssetsManager({
    currentAccount,
    isMicrosoft,
    activeCape,
    pageSkinModel: skinModel,
    setPageSkinModel: setSkinModel,
    setSkinLibrary,
    setProfile,
    setError,
    setNotice,
    fetchSkinLibrary,
    runWithSessionRefresh,
    touchAccountSkinCache,
    syncViewerToCurrentState: restoreViewer,
  });

  useEffect(() => {
    setError(null);

    if (!currentAccount) {
      return;
    }

    void hydrateWardrobe(
      currentAccount,
      (resolvedModel) => setSkinModel(resolvedModel),
      () => setSkinMenuAsset(null),
      true
    );
    // 仅响应 UUID 变化，确保初始化流程的纯净性
  }, [currentAccount?.uuid]);

  useEffect(() => {
    if (!currentAccount || skinMenuAsset) return;
    void syncViewerToCurrentState(
      currentSkinUrl,
      activeCape?.url ?? null,
      skinModel,
      activeSection,
      currentAccount
    );
  }, [
    activeCape?.url,
    activeSection,
    currentAccount,
    currentSkinUrl,
    skinMenuAsset,
    skinModel,
    syncViewerToCurrentState,
  ]);

  useEffect(() => {
    if (!skinMenuAsset) return;
    void previewSkinAsset(skinMenuAsset, skinMenuModel, activeCape?.url ?? null);
  }, [previewSkinAsset, skinMenuAsset, skinMenuModel, activeCape?.url]);

  const handleBack = useCallback(() => {
    setActiveTab('home');
  }, [setActiveTab]);

  const handleRefresh = useCallback(async () => {
    if (!currentAccount || isApplying) return;
    await hydrateWardrobe(
      currentAccount,
      (resolvedModel) => setSkinModel(resolvedModel),
      () => setSkinMenuAsset(null),
      false
    );
  }, [currentAccount, hydrateWardrobe, isApplying, setSkinMenuAsset]);

  const skinCards = useMemo<SkinCardAsset[]>(
    () =>
      (skinLibrary?.assets ?? []).map((asset) => {
        const variant = resolveSkinModel(asset.variant ?? skinModel);
        return {
          id: asset.id,
          kind: 'library',
          title: asset.fileName.replace(/\.png$/i, ''),
          subtitle: asset.isActive ? `正在使用 / ${modelLabel(variant)}` : modelLabel(variant),
          skinUrl: toStoredAssetUrl(asset),
          variant,
          filePath: asset.filePath,
          isActive: asset.isActive,
          canDelete: !asset.isActive,
        };
      }),
    [skinLibrary?.assets, skinModel]
  );

  const handlePreviewSkin = useCallback(
    (asset: SkinCardAsset) => {
      void previewSkinAsset(asset, asset.variant ?? skinModel, activeCape?.url ?? null);
    },
    [activeCape?.url, previewSkinAsset, skinModel]
  );

  const handlePreviewCape = useCallback(
    (cape: any) => {
      void loadViewerState(currentSkinUrl, cape.url, skinModel, 'cape');
    },
    [currentSkinUrl, loadViewerState, skinModel]
  );

  useInputAction('CANCEL', () => {
    if (skinMenuAsset) {
      closeSkinMenu();
      return;
    }
    if (capeMenuAsset) {
      closeCapeMenu();
      return;
    }
    handleBack();
  });

  useInputAction('TAB_LEFT', () => {
    if (!skinMenuAsset) setActiveSection('skin');
  });
  useInputAction('PAGE_LEFT', () => {
    if (!skinMenuAsset) setActiveSection('skin');
  });
  useInputAction('TAB_RIGHT', () => {
    if (!skinMenuAsset) setActiveSection('cape');
  });
  useInputAction('PAGE_RIGHT', () => {
    if (!skinMenuAsset) setActiveSection('cape');
  });

  return (
    <FocusBoundary id="wardrobe-page" defaultFocusKey="wardrobe-upload-card" className="w-full h-full text-white overflow-hidden flex flex-col">
      <div className="flex flex-col h-full w-full relative z-10">
        <header className="flex items-center justify-between h-[40px] bg-[#E6E8EB] border-b-[4px] border-[#B1B2B5] z-10 relative px-2">
          <div className="header_left flex items-center h-full">
            <div className="header_item header_item_left text-[#48494A] cursor-pointer w-[42px] h-full flex items-center justify-center" onClick={handleBack}>
              <ArrowLeft size={18} />
            </div>
          </div>
          <div className="header_title text-[#48494A] flex flex-1 justify-center items-center font-minecraft text-[26px] leading-none h-full">
            <span>衣柜</span>
          </div>
          <div className="header_right flex items-center h-full">
            {currentAccount && (
              <div
                className={`header_item header_item_right text-[#48494A] cursor-pointer w-[42px] h-full flex items-center justify-center ${isApplying || isLoadingProfile ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => void handleRefresh()}
              >
                <RefreshCw size={18} />
              </div>
            )}
            {!currentAccount && <div className="header_item_blank w-[42px]" />}
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden relative">
          <main className="w-full flex flex-col h-full m-auto">


            <div className=" mt-[20px] mx-[20px] lg:mx-[5%] border-l-[2px] border-r-[2px] border-b-[2px] border-[#333334] border-t-[2px] border-t-[#5A5B5C] bg-[#1E1E1F]/50 flex flex-col md:flex-row mb-[20px] flex-1 min-h-0">
              <div
                className="w-full md:w-[360px] lg:w-[400px] md:flex-none flex flex-col border-b-[2px] md:border-b-0 md:border-r-[2px] border-[#333334] relative min-h-[300px] aspect-[4/5] md:aspect-auto"

              >
                <div
                  className="w-full h-full flex flex-col p-4 absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(180deg, rgba(132, 204, 22, 0.15) 0%, transparent 40%)',
                  }}
                />
                <div className="w-full h-full flex flex-col relative">
                  <WardrobeViewer viewerContainerRef={containerRef} onBack={handleBack} />
                </div>
              </div>

              <div className="flex-[1.5] w-full flex flex-col p-6 bg-[#2a332c]/30 min-h-0">
                <div className="mb-4 shrink-0">
                  <OreToggleButton
                    options={[
                      { label: '皮肤', value: 'skin' },
                      { label: '披风', value: 'cape' },
                    ]}
                    value={activeSection}
                    onChange={(value) => setActiveSection(value as WardrobeTab)}
                    size="lg"
                    focusKeyPrefix="wardrobe-section"
                    className="w-full"
                  />
                </div>

                {!currentAccount && (
                  <div className="wardrobe-empty-state shrink-0">
                    请先在设置中添加一个游戏账户。
                  </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar primary_custom_scrollbar pr-2 min-h-0">
                  {currentAccount && activeSection === 'skin' && (
                    <WardrobeSkinPanel
                      skinCards={skinCards}
                      onChooseSkin={() => void handleChooseSkin()}
                      onOpenSkinMenu={handleOpenSkinMenu}
                      onPreview={handlePreviewSkin}
                    />
                  )}

                  {currentAccount && activeSection === 'cape' && (
                    <WardrobeCapePanel
                      isMicrosoft={isMicrosoft}
                      isLoadingProfile={isLoadingProfile}
                      profile={profile}
                      activeCape={activeCape}
                      onOpenCapeMenu={handleOpenCapeMenu}
                      onPreview={handlePreviewCape}
                    />
                  )}
                </div>

                {(notice || error) && (
                  <div className={`mt-4 shrink-0 p-3 border border-white/10 text-sm ${error ? 'bg-red-500/20 text-red-200 border-red-500/40' : 'bg-black/20 text-gray-200'}`}>
                    {error || notice}
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      <WardrobeSkinMenuModal
        skinMenuAsset={skinMenuAsset}
        skinMenuModel={skinMenuModel}
        isApplying={isApplying}
        onClose={closeSkinMenu}
        onChangeModel={handleChangeSkinMenuModel}
        onApply={handleApplySkinAsset}
        onDelete={handleDeleteSkinAsset}
      />

      <WardrobeCapeMenuModal
        capeMenuAsset={capeMenuAsset}
        activeCape={activeCape}
        isApplying={isApplying}
        onClose={closeCapeMenu}
        onApply={handleApplyCape}
      />
    </FocusBoundary>
  );
};

export default Wardrobe;
