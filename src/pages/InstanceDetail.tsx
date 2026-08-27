// /src/pages/InstanceDetail.tsx
import React, { useEffect, useMemo, useCallback } from 'react';
import {
  Settings,
  Coffee,
  FolderOpen,
  Blocks,
  Package,
  Image as ImageIcon,
  Download,
  type LucideIcon,
} from 'lucide-react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';

import { useInstanceDetail, type DetailTab } from '../hooks/pages/InstanceDetail/useInstanceDetail';
import { useLauncherStore } from '../store/useLauncherStore';

import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { focusManager } from '../ui/focus/FocusManager';
import { useInputAction } from '../ui/focus/InputDriver';

import { InstanceHeroSidebar } from '../features/InstanceDetail/components/sidebar/InstanceHeroSidebar';

import { BasicPanel } from '../features/InstanceDetail/components/tabs/BasicPanel';
import { JavaPanel } from '../features/InstanceDetail/components/tabs/JavaPanel';
import { ModPanel } from '../features/InstanceDetail/components/tabs/ModPanel';
import { SavePanel } from '../features/InstanceDetail/components/tabs/SavePanel';
import { ResourcePackPanel } from '../features/InstanceDetail/components/tabs/ResourcePackPanel';
import { ShaderPanel } from '../features/InstanceDetail/components/tabs/ShaderPanel';
import { ExportPanel } from '../features/InstanceDetail/components/tabs/export';
import { ErrorBoundary } from '../ui/components/ErrorBoundary';

const TABS: { id: DetailTab; label: string; icon: LucideIcon }[] = [
  { id: 'basic', label: '常规与基础', icon: Settings },
  { id: 'java', label: '游戏与 Java', icon: Coffee },
  { id: 'mods', label: 'MOD 管理', icon: Blocks },
  { id: 'resourcepacks', label: '资源包', icon: Package },
  { id: 'shaders', label: '光影包', icon: ImageIcon },
  { id: 'saves', label: '世界存档', icon: FolderOpen },
  { id: 'export', label: '导出与备份', icon: Download },
];

const InstanceDetail: React.FC = () => {
  const { t } = useTranslation();
  const instanceId = useLauncherStore((state) => state.selectedInstanceId) || 'demo-id-123';
  const setActiveTabGlobal = useLauncherStore((state) => state.setActiveTab);

  const {
    activeTab,
    setActiveTab,
    data,
    isInitializing,
    heroLogoUrl,
    handleOpenFolder,
    handleUpdateName,
    handleUpdateCover,
    handleUpdateEnvironment,
    handleUpdateCustomButtons,
    handleUpdateTags,
    handleUpdateServerBinding,
    handleUpdateAutoJoinServer,
    handleVerifyFiles,
    handleRepairRuntime,
    handleDeleteInstance,
  } = useInstanceDetail(instanceId);

  const normalizedTab: DetailTab = activeTab === 'overview' ? 'basic' : activeTab;

  const { ref: pageFocusRef, focusKey } = useFocusable();

  const tabFallbackFocusKeys = useMemo<Record<string, string | undefined>>(
    () => ({
      basic: 'basic-input-name',
      java: 'java-entry-point',
      mods: 'mod-btn-history',
      saves: 'save-btn-history',
      resourcepacks: 'btn-open-resourcepack-folder',
      shaders: 'btn-open-shader-folder',
      export: undefined,
    }),
    []
  );

  const restoreTabFocus = useCallback(
    (tab: DetailTab) => {
      const targetTab = tab === 'overview' ? 'basic' : tab;
      const boundaryId = `tab-boundary-${targetTab}`;
      const fallbackKey = tabFallbackFocusKeys[targetTab];

      const attempt = () => {
        if (!fallbackKey) {
          focusManager.restoreFocus(boundaryId);
          return;
        }
        focusManager.restoreFocus(boundaryId, fallbackKey);
      };

      const timerA = setTimeout(attempt, 0);
      const timerB = setTimeout(attempt, 120);
      return () => {
        clearTimeout(timerA);
        clearTimeout(timerB);
      };
    },
    [tabFallbackFocusKeys]
  );

  const handleTabSelect = useCallback(
    (id: DetailTab) => {
      setActiveTab(id);
    },
    [setActiveTab]
  );

  useEffect(() => {
    if (!data) return;
    return restoreTabFocus(normalizedTab);
  }, [data, normalizedTab, restoreTabFocus]);

  const isTextEntryActive = useCallback(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
  }, []);

  const isModalOpen = useCallback(() => !!document.querySelector('.fixed.inset-0'), []);

  const handleSwitchTab = useCallback(
    (direction: -1 | 1) => {
      if (isModalOpen()) return;
      if (isTextEntryActive()) return;

      const currentIndex = TABS.findIndex((t) => t.id === normalizedTab);
      const safeIndex = currentIndex === -1 ? 0 : currentIndex;
      const nextIndex = (safeIndex + direction + TABS.length) % TABS.length;
      handleTabSelect(TABS[nextIndex].id);
    },
    [normalizedTab, isModalOpen, isTextEntryActive, handleTabSelect]
  );

  useInputAction('PAGE_LEFT', () => handleSwitchTab(-1));
  useInputAction('PAGE_RIGHT', () => handleSwitchTab(1));

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      const activeEl = document.activeElement as HTMLElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        activeEl.blur();
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      setActiveTabGlobal('instances');
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [setActiveTabGlobal]);

  if (!data) {
    return (
      <FocusContext.Provider value={focusKey}>
        <div
          ref={pageFocusRef}
          className="w-full h-full flex items-center justify-center text-white font-minecraft"
        >
          {t('instanceDetail.loading', '加载中...')}
        </div>
      </FocusContext.Provider>
    );
  }

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={pageFocusRef} className="relative w-full h-full flex overflow-hidden bg-[#242425]">
        {/* =========================================================================
            主内容双栏平铺容器 (Full-Width Edge-to-Edge Tiled Viewport)
            ========================================================================= */}
        {/* 左侧常驻 Hero 控制台与导航树 (响应式宽度缩放: 280px ~ 380px) */}
        <div className="w-[280px] lg:w-[320px] xl:w-[360px] 2xl:w-[400px] h-full flex-shrink-0">
          <InstanceHeroSidebar
            data={data}
            activeTab={normalizedTab}
            onSelectTab={handleTabSelect}
            onOpenFolder={handleOpenFolder}
            tabs={TABS}
          />
        </div>

          {/* 右侧独立内容视口 (占满全屏剩余空间，无缝平铺) */}
          <main className="relative flex-1 min-w-0 h-full overflow-hidden bg-[#242425]">
            <FocusBoundary
              id="tab-boundary-basic"
              isActive={normalizedTab === 'basic'}
              trapFocus
              className={normalizedTab === 'basic' ? 'flex flex-1 h-full min-h-0 flex-col overflow-hidden' : 'hidden'}
            >
              <BasicPanel
                data={data}
                isInitializing={isInitializing}
                onUpdateName={handleUpdateName}
                onUpdateCover={handleUpdateCover}
                onUpdateCustomButtons={handleUpdateCustomButtons}
                onUpdateTags={handleUpdateTags}
                onUpdateServerBinding={handleUpdateServerBinding}
                onUpdateAutoJoinServer={handleUpdateAutoJoinServer}
                onVerifyFiles={handleVerifyFiles}
                onRepairFiles={handleRepairRuntime}
                onDelete={async (skipConfirm?: boolean) => {
                  const success = await handleDeleteInstance(skipConfirm);
                  if (success) setActiveTabGlobal('instances');
                }}
              />
            </FocusBoundary>

            <FocusBoundary
              id="tab-boundary-java"
              isActive={normalizedTab === 'java'}
              trapFocus
              className={normalizedTab === 'java' ? 'flex flex-1 h-full min-h-0 flex-col overflow-hidden' : 'hidden'}
            >
              <JavaPanel
                instanceId={instanceId}
                isActive={normalizedTab === 'java'}
                data={data}
                isInitializing={isInitializing}
                onUpdateEnvironment={handleUpdateEnvironment}
              />
            </FocusBoundary>

            <FocusBoundary
              id="tab-boundary-mods"
              isActive={normalizedTab === 'mods'}
              trapFocus
              className={normalizedTab === 'mods' ? 'flex flex-1 h-full min-h-0 flex-col overflow-hidden' : 'hidden'}
            >
              <ErrorBoundary fallbackTitle="MOD 管理面板加载失败">
                <ModPanel instanceId={instanceId} />
              </ErrorBoundary>
            </FocusBoundary>

            <FocusBoundary
              id="tab-boundary-saves"
              isActive={normalizedTab === 'saves'}
              trapFocus
              className={normalizedTab === 'saves' ? 'flex flex-1 h-full min-h-0 flex-col overflow-hidden' : 'hidden'}
            >
              <ErrorBoundary fallbackTitle="世界存档面板加载失败">
                <SavePanel instanceId={instanceId} />
              </ErrorBoundary>
            </FocusBoundary>

            <FocusBoundary
              id="tab-boundary-resourcepacks"
              isActive={normalizedTab === 'resourcepacks'}
              trapFocus
              className={normalizedTab === 'resourcepacks' ? 'flex flex-1 h-full min-h-0 flex-col overflow-hidden' : 'hidden'}
            >
              <ErrorBoundary fallbackTitle="资源包面板加载失败">
                <ResourcePackPanel instanceId={instanceId} />
              </ErrorBoundary>
            </FocusBoundary>

            <FocusBoundary
              id="tab-boundary-shaders"
              isActive={normalizedTab === 'shaders'}
              trapFocus
              className={normalizedTab === 'shaders' ? 'flex flex-1 h-full min-h-0 flex-col overflow-hidden' : 'hidden'}
            >
              <ErrorBoundary fallbackTitle="光影包面板加载失败">
                <ShaderPanel instanceId={instanceId} />
              </ErrorBoundary>
            </FocusBoundary>

            <FocusBoundary
              id="tab-boundary-export"
              isActive={normalizedTab === 'export'}
              trapFocus
              className={normalizedTab === 'export' ? 'flex flex-1 h-full min-h-0 flex-col overflow-hidden' : 'hidden'}
            >
              <ExportPanel
                instanceId={instanceId}
                defaultName={data.name}
                defaultHeroLogo={heroLogoUrl || undefined}
                defaultVersion={data.description?.match(/1\.\d+\.\d+/)?.[0] || '1.0.0'}
              />
            </FocusBoundary>
          </main>
      </div>
    </FocusContext.Provider>
  );
};

export default InstanceDetail;

