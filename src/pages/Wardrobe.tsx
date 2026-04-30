import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { doesFocusableExist, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
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
import { ControlHint } from '../ui/components/ControlHint';
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { focusManager } from '../ui/focus/FocusManager';
import { useInputAction } from '../ui/focus/InputDriver';
import { OreToggleButton } from '../ui/primitives/OreToggleButton';


const SKIN_NOTE_STORAGE_PREFIX = 'wardrobe:skin-notes:';
const MAX_SKIN_NOTE_LENGTH = 28;

const Wardrobe: React.FC = () => {
  const { t } = useTranslation();
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const { accounts, activeAccountId } = useAccountStore();

  const currentAccount = useMemo(
    () => accounts.find((account) => account.uuid === activeAccountId) ?? null,
    [accounts, activeAccountId]
  );

  const [activeSection, setActiveSection] = useState<WardrobeTab>('skin');
  const [skinModel, setSkinModel] = useState<WardrobeSkinModel>('classic');
  const [skinNotes, setSkinNotes] = useState<Record<string, string>>({});
  const isNotesLoadedRef = useRef(false);

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

  const skinNoteStorageKey = useMemo(
    () => (currentAccount ? `${SKIN_NOTE_STORAGE_PREFIX}${currentAccount.uuid}` : null),
    [currentAccount?.uuid]
  );

  useEffect(() => {
    isNotesLoadedRef.current = false;

    if (!skinNoteStorageKey) {
      setSkinNotes({});
      isNotesLoadedRef.current = true;
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(skinNoteStorageKey);
      if (!raw) {
        setSkinNotes({});
        isNotesLoadedRef.current = true;
        return;
      }

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const normalized = Object.entries(parsed).reduce<Record<string, string>>((acc, [assetId, noteValue]) => {
        if (typeof noteValue !== 'string') return acc;
        const note = noteValue.slice(0, MAX_SKIN_NOTE_LENGTH);
        if (!note.trim()) return acc;
        acc[assetId] = note;
        return acc;
      }, {});
      setSkinNotes(normalized);
    } catch {
      setSkinNotes({});
    } finally {
      isNotesLoadedRef.current = true;
    }
  }, [skinNoteStorageKey]);

  useEffect(() => {
    if (!skinNoteStorageKey || !isNotesLoadedRef.current || typeof window === 'undefined') {
      return;
    }

    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(skinNoteStorageKey, JSON.stringify(skinNotes));
      } catch {
        // Keep in-memory notes when local storage is unavailable.
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [skinNoteStorageKey, skinNotes]);

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
      true
    );
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
      false
    );
  }, [currentAccount, hydrateWardrobe, isApplying, setSkinMenuAsset]);

  const handleChangeSkinNote = useCallback((assetId: string, note: string) => {
    const normalizedNote = note.slice(0, MAX_SKIN_NOTE_LENGTH);
    setSkinNotes((previous) => {
      const trimmedNote = normalizedNote.trim();

      if (!trimmedNote) {
        if (!(assetId in previous)) {
          return previous;
        }
        const { [assetId]: _, ...rest } = previous;
        return rest;
      }

      if (previous[assetId] === normalizedNote) {
        return previous;
      }

      return {
        ...previous,
        [assetId]: normalizedNote,
      };
    });
  }, []);

  const skinCards = useMemo<SkinCardAsset[]>(
    () =>
      (skinLibrary?.assets ?? []).map((asset) => {
        const variant = resolveSkinModel(asset.variant ?? skinModel);
        const originalTitle = asset.fileName.replace(/\.png$/i, '');
        const note = (skinNotes[asset.id] ?? asset.note ?? '').trim();
        return {
          id: asset.id,
          kind: 'library' as const,
          title: note || originalTitle,
          originalTitle,
          note: note || undefined,
          subtitle: modelLabel(variant),
          skinUrl: toStoredAssetUrl(asset),
          variant,
          filePath: asset.filePath,
          isActive: asset.isActive,
          canDelete: !asset.isActive,
        };
      }).sort((a, b) => (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1)),
    [skinLibrary?.assets, skinModel, skinNotes]
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

  const resolveWardrobeFocusKey = useCallback(() => {
    const sectionCandidates =
      activeSection === 'cape'
        ? ['wardrobe-cape-0', 'wardrobe-section-1', 'wardrobe-section-0', 'wardrobe-upload-card', 'wardrobe-skin-0']
        : ['wardrobe-upload-card', 'wardrobe-skin-0', 'wardrobe-section-0', 'wardrobe-section-1', 'wardrobe-cape-0'];

    return sectionCandidates.find((focusKey) => doesFocusableExist(focusKey)) ?? null;
  }, [activeSection]);

  useEffect(() => {
    if (skinMenuAsset || capeMenuAsset) {
      return;
    }

    let attempts = 0;
    let timer: ReturnType<typeof window.setTimeout> | undefined;

    const ensureWardrobeFocus = () => {
      const currentFocusKey = getCurrentFocusKey();
      if (currentFocusKey && doesFocusableExist(currentFocusKey)) {
        return;
      }

      const targetKey = resolveWardrobeFocusKey();
      if (targetKey) {
        timer = window.setTimeout(() => {
          if (doesFocusableExist(targetKey)) {
            focusManager.focus(targetKey);
          }
        }, 0);
        return;
      }

      attempts += 1;
      if (attempts < 12) {
        timer = window.setTimeout(ensureWardrobeFocus, 60);
      }
    };

    timer = window.setTimeout(ensureWardrobeFocus, 30);

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [
    activeSection,
    capeMenuAsset,
    currentAccount?.uuid,
    profile?.capes.length,
    resolveWardrobeFocusKey,
    skinCards.length,
    skinMenuAsset,
  ]);

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
  useInputAction('ACTION_X', () => {
    if (skinMenuAsset || capeMenuAsset) return;
    if (!currentAccount || isApplying) return;
    void handleRefresh();
  });

  return (
    <FocusBoundary id="wardrobe-page" defaultFocusKey="wardrobe-upload-card" className="w-full h-full text-white overflow-hidden flex flex-col">
      <div className="flex flex-col h-full w-full relative z-10">
        <header className="flex items-center justify-between h-[clamp(2.5rem,6vh,4rem)] bg-[#E6E8EB] border-b-4 border-[#B1B2B5] z-10 relative px-[clamp(0.5rem,2vw,2rem)]">
          <div className="header_left flex items-center h-full">
            <div className="header_item header_item_left text-[#48494A] cursor-pointer aspect-square h-full flex items-center justify-center" onClick={handleBack}>
              <ArrowLeft className="w-[clamp(1.125rem,3vh,1.75rem)] h-[clamp(1.125rem,3vh,1.75rem)]" />
            </div>
          </div>
          <div className="header_title text-[#48494A] flex flex-1 justify-center items-center font-minecraft text-[length:clamp(1.5rem,4vh,2.5rem)] leading-none h-full">
            <span>{t('wardrobe.title')}</span>
          </div>
          <div className="header_right flex items-center h-full">
            {currentAccount && (
              <div
                className={`header_item header_item_right text-[#48494A] cursor-pointer aspect-square h-full flex items-center justify-center ${isApplying || isLoadingProfile ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => void handleRefresh()}
              >
                <RefreshCw className="w-[clamp(1.125rem,3vh,1.75rem)] h-[clamp(1.125rem,3vh,1.75rem)]" />
              </div>
            )}
            {!currentAccount && <div className="aspect-square h-full" />}
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden relative">
          <main className="w-full flex flex-col h-full m-auto">


            <div className="my-[clamp(0.75rem,2vh,2rem)] mx-[clamp(1rem,4vw,10%)] border-2 border-[#333334] border-t-[#5A5B5C] bg-[#1E1E1F]/50 flex flex-col md:flex-row flex-1 min-h-0">
              <div
                className="w-full md:w-[clamp(22.5rem,30vw,35rem)] md:flex-none flex flex-col border-b-2 md:border-b-0 md:border-r-2 border-[#333334] relative min-h-[40vh] aspect-[4/5] md:aspect-auto"

              >
                <div
                  className="w-full h-full flex flex-col p-[clamp(1rem,2vw,2rem)] absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(180deg, rgba(132, 204, 22, 0.15) 0%, transparent 40%)',
                  }}
                />
                <div className="w-full h-full flex flex-col relative">
                  <WardrobeViewer viewerContainerRef={containerRef} onBack={handleBack} />
                </div>
                <div className="wardrobe-viewer-hints pointer-events-none" aria-hidden="true">
                  <div className="wardrobe-viewer-hints__list">
                    <div className="wardrobe-viewer-hints__item">
                      <ControlHint label="A" variant="face" tone="green" className="wardrobe-viewer-hints__hint" />
                      <span>{t('wardrobe.hints.openDialog')}</span>
                    </div>
                    <div className="wardrobe-viewer-hints__item">
                      <ControlHint label="Y" variant="face" tone="yellow" className="wardrobe-viewer-hints__hint" />
                      <span>{t('wardrobe.hints.preview')}</span>
                    </div>
                    <div className="wardrobe-viewer-hints__item">
                      <span className="wardrobe-viewer-hints__combo">
                        <ControlHint label="LT" variant="trigger" tone="neutral" className="wardrobe-viewer-hints__hint" />
                        <ControlHint label="RT" variant="trigger" tone="neutral" className="wardrobe-viewer-hints__hint" />
                      </span>
                      <span>{t('wardrobe.hints.switchTab')}</span>
                    </div>
                    <div className="wardrobe-viewer-hints__item">
                      <ControlHint label="RS" variant="keyboard" tone="dark" className="wardrobe-viewer-hints__hint" />
                      <span>{t('wardrobe.hints.rotate')}</span>
                    </div>
                    <div className="wardrobe-viewer-hints__item">
                      <ControlHint label="X" variant="face" tone="blue" className="wardrobe-viewer-hints__hint" />
                      <span>{t('wardrobe.hints.refresh')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-[1.5] w-full flex flex-col p-4 bg-[#2a332c]/30 min-h-0">
                <div className="mb-3 shrink-0">
                  <OreToggleButton
                    options={[
                      { label: t('wardrobe.skinTab'), value: 'skin' },
                      { label: t('wardrobe.capeTab'), value: 'cape' },
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
                    {t('wardrobe.emptyAccount')}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
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
        skinNote={skinMenuAsset ? skinNotes[skinMenuAsset.id] ?? skinMenuAsset.note ?? '' : ''}
        isApplying={isApplying}
        onClose={closeSkinMenu}
        onChangeModel={handleChangeSkinMenuModel}
        onChangeNote={(nextNote) => {
          if (!skinMenuAsset || skinMenuAsset.kind !== 'library') return;
          handleChangeSkinNote(skinMenuAsset.id, nextNote);
        }}
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

