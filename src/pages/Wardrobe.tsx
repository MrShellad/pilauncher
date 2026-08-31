import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { doesFocusableExist, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Info, RefreshCw, Shirt, Sparkles, User } from 'lucide-react';

import type { OnlineSkinItem, SkinCardAsset, WardrobeSkinModel, WardrobeTab } from '../features/wardrobe/types';
import {
  isMicrosoftAccount,
  resolveSkinModel,
  findActiveSkin,
  findActiveCape,
  accountSkinPreviewUrl,
  toStoredAssetUrl,
  modelLabel,
} from '../features/wardrobe/utils/wardrobe.utils';
import { downloadAndSaveOnlineSkin } from '../features/wardrobe/services/onlineSkinService';
import { useWardrobeSession } from '../features/wardrobe/hooks/useWardrobeSession';
import { useWardrobeViewerControl } from '../features/wardrobe/hooks/useWardrobeViewerControl';
import { useSkinAssetsManager } from '../features/wardrobe/hooks/useSkinAssetsManager';
import { WardrobeViewer } from '../features/wardrobe/components/WardrobeViewer';
import { WardrobeSkinPanel } from '../features/wardrobe/components/WardrobeSkinPanel';
import { WardrobeOnlinePanel } from '../features/wardrobe/components/WardrobeOnlinePanel';
import { WardrobeCapePanel } from '../features/wardrobe/components/WardrobeCapePanel';
import { WardrobeSkinMenuModal } from '../features/wardrobe/components/WardrobeSkinMenuModal';
import { WardrobeOnlineSkinModal } from '../features/wardrobe/components/WardrobeOnlineSkinModal';
import { WardrobeCapeMenuModal } from '../features/wardrobe/components/WardrobeCapeMenuModal';

import { useAccountStore } from '../store/useAccountStore';
import { useLauncherStore } from '../store/useLauncherStore';
import { ControlHint } from '../ui/components/ControlHint';
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { focusManager } from '../ui/focus/FocusManager';
import { useInputAction } from '../ui/focus/InputDriver';
import { OreBanner } from '../ui/primitives/OreBanner';
import { OreButton } from '../ui/primitives/OreButton';
import { OreOverlayScrollArea } from '../ui/primitives/OreOverlayScrollArea';
import { OreTag } from '../ui/primitives/OreTag';
import { OreToggleButton } from '../ui/primitives/OreToggleButton';

const SKIN_NOTE_STORAGE_PREFIX = 'wardrobe:skin-notes:';
const MAX_SKIN_NOTE_LENGTH = 28;

interface WardrobeBannerState {
  variant: 'important' | 'info' | 'warning' | 'danger';
  message: string;
}

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
  const [onlineMenuAsset, setOnlineMenuAsset] = useState<OnlineSkinItem | null>(null);
  const [isOnlineProcessing, setIsOnlineProcessing] = useState<boolean>(false);
  const [activeBanner, setActiveBanner] = useState<WardrobeBannerState | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNotesLoadedRef = useRef(false);

  const showBanner = useCallback((variant: 'important' | 'info' | 'warning' | 'danger', message: string) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setActiveBanner({ variant, message });
    bannerTimerRef.current = setTimeout(() => {
      setActiveBanner(null);
    }, 4000);
  }, []);

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

  useEffect(() => {
    if (!error) return;
    showBanner('danger', error);
    setError(null);
  }, [error, setError, showBanner]);

  useEffect(() => {
    if (!notice) return;
    showBanner(notice.includes('已') ? 'important' : 'info', notice);
    setNotice(null);
  }, [notice, setNotice, showBanner]);

  const isMicrosoft = isMicrosoftAccount(currentAccount);
  const activeSkin = findActiveSkin(profile);
  const activeCape = findActiveCape(profile);
  const activeLocalSkinAsset = skinLibrary?.assets.find((asset) => asset.isActive) ?? null;
  const currentSkinUrl = activeLocalSkinAsset
    ? toStoredAssetUrl(activeLocalSkinAsset)
    : activeSkin?.url || accountSkinPreviewUrl(currentAccount);

  const {
    containerRef,
    loadViewerState,
    syncViewerToCurrentState,
    previewSkinAsset,
    playTransientAnimation,
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
    applyDirectSkinAsset,
    handleDeleteSkinAsset,
    handleApplyCape,
    closeSkinMenu,
    handleOpenSkinMenu,
    handleChangeSkinMenuModel,
    closeCapeMenu,
    handleOpenCapeMenu,
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

  const hasBlockingOverlay = Boolean(skinMenuAsset || capeMenuAsset || onlineMenuAsset);
  const lastFocusKeyBeforeOverlayRef = useRef<string | null>(null);

  useEffect(() => {
    if (hasBlockingOverlay) {
      const currentFocus = getCurrentFocusKey();
      if (currentFocus && currentFocus !== 'SN:ROOT') {
        lastFocusKeyBeforeOverlayRef.current = currentFocus;
      }
    }
  }, [hasBlockingOverlay]);

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
    if (!currentAccount || skinMenuAsset || onlineMenuAsset) return;
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
    currentAccount?.uuid,
    currentSkinUrl,
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
  }, [currentAccount, hydrateWardrobe, isApplying]);

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
      const targetModel = asset.variant ?? skinModel;
      setSkinModel(targetModel);
      void previewSkinAsset(asset, targetModel, activeCape?.url ?? null);
      playTransientAnimation('interact', 1200);
      showBanner('info', `已在 3D 展台试穿: ${asset.title}`);
    },
    [activeCape?.url, playTransientAnimation, previewSkinAsset, showBanner, skinModel]
  );

  const handlePreviewOnlineSkin = useCallback(
    (item: OnlineSkinItem, model: WardrobeSkinModel) => {
      setSkinModel(model);
      void loadViewerState(item.skinUrl, activeCape?.url ?? null, model, 'skin');
      playTransientAnimation('interact', 1200);
      showBanner('info', `已在 3D 展台试穿: ${item.title}`);
    },
    [activeCape?.url, loadViewerState, playTransientAnimation, showBanner]
  );

  const handleSaveOnlineSkinToLibrary = useCallback(
    async (item: OnlineSkinItem, model: WardrobeSkinModel, customTitle?: string) => {
      if (!currentAccount) return;
      setIsOnlineProcessing(true);
      try {
        const prevIds = new Set((skinLibrary?.assets ?? []).map((a) => a.id));
        const nextLibrary = await downloadAndSaveOnlineSkin(currentAccount.uuid, item, model);
        setSkinLibrary(nextLibrary, currentAccount.uuid);

        // 精准定位新下载入库的资产 ID（避免误覆盖已有皮肤的备注名）
        const newlyAddedAsset =
          nextLibrary.assets.find((a) => !prevIds.has(a.id)) ||
          nextLibrary.assets[0];

        const targetTitle = (customTitle && customTitle.trim()) || item.title;
        if (newlyAddedAsset && targetTitle) {
          handleChangeSkinNote(newlyAddedAsset.id, targetTitle.trim());
        }

        showBanner('important', `皮肤 “${targetTitle || item.title}” 已下载并存入本地皮肤库！`);
        setOnlineMenuAsset(null);
      } catch (err) {
        showBanner('danger', String(err instanceof Error ? err.message : err));
      } finally {
        setIsOnlineProcessing(false);
      }
    },
    [currentAccount, handleChangeSkinNote, setSkinLibrary, showBanner, skinLibrary?.assets]
  );

  const handleApplyOnlineSkin = useCallback(
    async (item: OnlineSkinItem, model: WardrobeSkinModel, customTitle?: string) => {
      if (!currentAccount) return;
      setIsOnlineProcessing(true);
      try {
        const prevIds = new Set((skinLibrary?.assets ?? []).map((a) => a.id));
        const nextLibrary = await downloadAndSaveOnlineSkin(currentAccount.uuid, item, model);
        setSkinLibrary(nextLibrary, currentAccount.uuid);

        // 精准定位新下载的资产并立即应用
        const targetAsset =
          nextLibrary.assets.find((a) => !prevIds.has(a.id)) ||
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
      } catch (err) {
        showBanner('danger', String(err instanceof Error ? err.message : err));
      } finally {
        setIsOnlineProcessing(false);
      }
    },
    [applyDirectSkinAsset, currentAccount, handleChangeSkinNote, setSkinLibrary, showBanner, skinLibrary?.assets]
  );

  const handlePreviewCape = useCallback(
    (cape: any) => {
      void loadViewerState(currentSkinUrl, cape.url, skinModel, 'cape');
      playTransientAnimation('interact', 1200);
      showBanner('info', `已在 3D 展台试戴披风`);
    },
    [currentSkinUrl, loadViewerState, playTransientAnimation, showBanner, skinModel]
  );

  const resolveWardrobeFocusKey = useCallback(() => {
    const sectionCandidates =
      activeSection === 'online'
        ? ['wardrobe-online-search', 'wardrobe-section-1', 'wardrobe-upload-card']
        : activeSection === 'cape'
        ? ['wardrobe-cape-0', 'wardrobe-section-2', 'wardrobe-section-0', 'wardrobe-upload-card']
        : ['wardrobe-upload-card', 'wardrobe-skin-0', 'wardrobe-section-0', 'wardrobe-section-1'];

    return sectionCandidates.find((focusKey) => doesFocusableExist(focusKey)) ?? null;
  }, [activeSection]);

  useEffect(() => {
    if (skinMenuAsset || capeMenuAsset || onlineMenuAsset) {
      return;
    }

    let attempts = 0;
    let timer: ReturnType<typeof window.setTimeout> | undefined;

    const ensureWardrobeFocus = () => {
      const currentFocusKey = getCurrentFocusKey();
      if (currentFocusKey && doesFocusableExist(currentFocusKey)) {
        return;
      }

      const restoredTarget = lastFocusKeyBeforeOverlayRef.current;
      const targetKey = (restoredTarget && doesFocusableExist(restoredTarget))
        ? restoredTarget
        : resolveWardrobeFocusKey();

      lastFocusKeyBeforeOverlayRef.current = null;

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
    onlineMenuAsset,
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
    if (onlineMenuAsset) {
      setOnlineMenuAsset(null);
      return;
    }
    if (capeMenuAsset) {
      closeCapeMenu();
      return;
    }
    handleBack();
  });

  useInputAction('TAB_LEFT', () => {
    if (!skinMenuAsset && !capeMenuAsset && !onlineMenuAsset) {
      setActiveSection((prev) => (prev === 'cape' ? 'online' : prev === 'online' ? 'skin' : 'skin'));
    }
  });
  useInputAction('PAGE_LEFT', () => {
    if (!skinMenuAsset && !capeMenuAsset && !onlineMenuAsset) {
      setActiveSection((prev) => (prev === 'cape' ? 'online' : prev === 'online' ? 'skin' : 'skin'));
    }
  });
  useInputAction('TAB_RIGHT', () => {
    if (!skinMenuAsset && !capeMenuAsset && !onlineMenuAsset) {
      setActiveSection((prev) => (prev === 'skin' ? 'online' : prev === 'online' ? 'cape' : 'cape'));
    }
  });
  useInputAction('PAGE_RIGHT', () => {
    if (!skinMenuAsset && !capeMenuAsset && !onlineMenuAsset) {
      setActiveSection((prev) => (prev === 'skin' ? 'online' : prev === 'online' ? 'cape' : 'cape'));
    }
  });
  useInputAction('ACTION_X', () => {
    if (skinMenuAsset || capeMenuAsset || onlineMenuAsset) return;
    if (!currentAccount || isApplying) return;
    void handleRefresh();
  });

  return (
    <FocusBoundary
      id="wardrobe-page"
      defaultFocusKey="wardrobe-upload-card"
      className="flex h-full w-full flex-col overflow-hidden bg-[#222324] font-minecraft text-white select-none"
    >
      {/* 1. 规范 OreUI 顶栏 (Top Navigation Bar) */}
      <header className="flex h-14 sm:h-16 shrink-0 items-center justify-between border-b-[3px] border-[#1E1E1F] bg-[#313233] px-4 sm:px-6 shadow-[inset_0_2px_0_rgba(255,255,255,0.08)] z-20">
        <div className="flex items-center gap-3">
          <OreButton
            focusKey="wardrobe-back-btn"
            variant="secondary"
            size="sm"
            onClick={handleBack}
          >
            <ArrowLeft size={16} className="mr-1" />
            <span>{t('common.back', { defaultValue: '返回' })}</span>
          </OreButton>
        </div>

        <div className="flex items-center gap-2">
          <Shirt size={20} className="text-[#6CC349]" />
          <h1 className="text-lg sm:text-xl font-bold uppercase tracking-wider text-white">
            {t('wardrobe.title', { defaultValue: '更衣室' })}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {currentAccount ? (
            <div className="hidden sm:flex items-center gap-2 border border-[#1E1E1F] bg-[#141517] px-3 py-1 text-xs">
              <User size={13} className="text-[#6CC349]" />
              <span className="text-[#D0D1D4] font-bold">{currentAccount.name}</span>
              <OreTag variant={isMicrosoft ? 'success' : 'neutral'} size="sm" weight="bold">
                {isMicrosoft ? '微软' : '离线'}
              </OreTag>
            </div>
          ) : (
            <span className="text-xs text-[#FF9E9E]">未选择账号</span>
          )}

          {currentAccount && (
            <OreButton
              focusKey="wardrobe-refresh-btn"
              variant="secondary"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={isApplying || isLoadingProfile}
            >
              <RefreshCw
                size={14}
                className={isLoadingProfile ? 'animate-spin' : ''}
              />
            </OreButton>
          )}
        </div>
      </header>

      {/* 2. 双栏 3D 基岩展厅核心工作区 (Stage + Vault) */}
      <main className="flex flex-1 min-h-0 w-full flex-col lg:flex-row gap-4 sm:gap-5 p-4 sm:p-5 overflow-hidden">
        {/* 左栏：3D 角色试衣镜交互展台 (Live 3D Stage) */}
        <section className="relative flex w-full lg:w-[25rem] xl:w-[28rem] shrink-0 flex-col justify-between border-[3px] border-[#1E1E1F] bg-[#222324] p-3 shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)] min-h-[18rem] lg:min-h-0">
          {/* 展台顶栏状态角标 */}
          <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <OreTag variant="neutral" size="sm" weight="bold">
                {skinModel === 'slim' ? '纤细 (3px)' : '经典 (4px)'}
              </OreTag>
              {activeCape && (
                <OreTag variant="success" size="sm" weight="bold">
                  {t('wardrobe.capeBadge', { defaultValue: '已装备披风' })}
                </OreTag>
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#8C8D90] bg-[#141517]/80 px-2 py-0.5 border border-[#1E1E1F]">
              <Sparkles size={11} className="text-[#6CC349]" />
              <span>3D 实时试衣</span>
            </div>
          </div>

          {/* 3D 角色画布交互区 */}
          <div className="relative flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center">
            <WardrobeViewer viewerContainerRef={containerRef} onBack={handleBack} />
          </div>

          {/* 展台底部操作底座 (Gamepad & Keyboard Control Dock) */}
          <div className="mt-2 -mx-3 -mb-3 border-t-[2px] border-[#1E1E1F] bg-[#141517] p-2.5">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-[#D0D1D4]">
              <div className="inline-flex items-center gap-1.5">
                <ControlHint label="A" variant="face" tone="green" />
                <span>{t('wardrobe.hints.openDialog', { defaultValue: '选择/管理' })}</span>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <ControlHint label="Y" variant="face" tone="yellow" />
                <span>{t('wardrobe.hints.preview', { defaultValue: '试穿' })}</span>
              </div>
              <div className="inline-flex items-center gap-1">
                <ControlHint label="LT" variant="trigger" tone="neutral" />
                <ControlHint label="RT" variant="trigger" tone="neutral" />
                <span>{t('wardrobe.hints.switchTab', { defaultValue: '切页' })}</span>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <ControlHint label="RS" variant="keyboard" tone="dark" />
                <span>{t('wardrobe.hints.rotate', { defaultValue: '旋转' })}</span>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <ControlHint label="X" variant="face" tone="blue" />
                <span>{t('wardrobe.hints.refresh', { defaultValue: '刷新' })}</span>
              </div>
            </div>
          </div>
        </section>

        {/* 右栏：3D 皮肤与披风仓库展板 (Asset Vault) */}
        <section className="relative flex flex-1 min-h-0 w-full flex-col border-[3px] border-[#1E1E1F] bg-[#313233] p-4 sm:p-5 shadow-[inset_0_2px_0_rgba(255,255,255,0.08)]">
          {/* 顶栏 3 标签页选项卡切换器 (100% 宽度填充) */}
          <div className="mb-3 shrink-0 w-full">
            <OreToggleButton
              options={[
                { label: t('wardrobe.skinTab', { defaultValue: '本地皮肤' }), value: 'skin' },
                { label: t('wardrobe.onlineTab', { defaultValue: '在线图库' }), value: 'online' },
                { label: t('wardrobe.capeTab', { defaultValue: '披风收藏' }), value: 'cape' },
              ]}
              value={activeSection}
              onChange={(value) => setActiveSection(value as WardrobeTab)}
              size="md"
              focusKeyPrefix="wardrobe-section"
              className="w-full"
            />
          </div>

          {/* 无账号提示 */}
          {!currentAccount && (
            <div className="flex flex-1 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#222324] p-8 text-center text-xs text-[#8C8D90] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
              {t('wardrobe.emptyAccount', { defaultValue: '请先在启动器主界面选择或添加一个游戏账号。' })}
            </div>
          )}

          {/* 列表滚动视口 */}
          {currentAccount && (
            <div className="flex-1 min-h-0 overflow-hidden">
              {activeSection === 'online' ? (
                <WardrobeOnlinePanel
                  onSelectSkin={(item) => setOnlineMenuAsset(item)}
                  onPreviewSkin={handlePreviewOnlineSkin}
                />
              ) : (
                <OreOverlayScrollArea
                  className="h-full w-full"
                  contentClassName="pr-1"
                  safeInsetTop={0}
                  safeInsetBottom={0}
                  contentSafePaddingRight={10}
                >
                  {activeSection === 'skin' && (
                    <WardrobeSkinPanel
                      skinCards={skinCards}
                      isLoadingProfile={isLoadingProfile}
                      onChooseSkin={() => void handleChooseSkin()}
                      onOpenSkinMenu={handleOpenSkinMenu}
                      onPreview={handlePreviewSkin}
                    />
                  )}

                  {activeSection === 'cape' && (
                    <WardrobeCapePanel
                      isMicrosoft={isMicrosoft}
                      isLoadingProfile={isLoadingProfile}
                      profile={profile}
                      activeCape={activeCape}
                      currentSkinUrl={currentSkinUrl}
                      currentSkinModel={skinModel}
                      onOpenCapeMenu={handleOpenCapeMenu}
                      onPreview={handlePreviewCape}
                    />
                  )}
                </OreOverlayScrollArea>
              )}
            </div>
          )}

          {/* 底部浮动状态横幅 (绝对定位在底部，完全避免推动其他组件) */}
          {activeBanner && (
            <div className="absolute bottom-4 left-4 right-4 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150 shadow-2xl pointer-events-auto">
              <OreBanner
                variant={activeBanner.variant}
                onClose={() => setActiveBanner(null)}
                icon={
                  activeBanner.variant === 'danger' ? (
                    <AlertCircle size={15} />
                  ) : activeBanner.variant === 'important' ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <Info size={15} />
                  )
                }
                className="text-xs py-1.5 px-3 border border-[#1E1E1F]"
              >
                <span>{activeBanner.message}</span>
              </OreBanner>
            </div>
          )}
        </section>
      </main>

      {/* 3. 本地皮肤管理弹窗 */}
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

      {/* 4. 在线皮肤详情/收藏/应用弹窗 */}
      <WardrobeOnlineSkinModal
        skinItem={onlineMenuAsset}
        isProcessing={isOnlineProcessing}
        onClose={() => setOnlineMenuAsset(null)}
        onPreview={handlePreviewOnlineSkin}
        onSaveToLibrary={handleSaveOnlineSkinToLibrary}
        onApplyAndSave={handleApplyOnlineSkin}
      />

      {/* 5. 披风管理弹窗 */}
      <WardrobeCapeMenuModal
        capeMenuAsset={capeMenuAsset}
        activeCape={activeCape}
        currentSkinUrl={currentSkinUrl}
        currentSkinModel={skinModel}
        isApplying={isApplying}
        onClose={closeCapeMenu}
        onApply={handleApplyCape}
      />
    </FocusBoundary>
  );
};

export default Wardrobe;