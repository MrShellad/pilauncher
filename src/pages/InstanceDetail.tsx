// /src/pages/InstanceDetail.tsx
import React, { useEffect, useMemo, useCallback } from 'react';
import {
  LayoutTemplate,
  Settings,
  Coffee,
  FolderOpen,
  Blocks,
  Package,
  Image as ImageIcon,
  Download,
} from 'lucide-react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';

import { useInstanceDetail, type DetailTab } from '../hooks/pages/InstanceDetail/useInstanceDetail';
import { useLauncherStore } from '../store/useLauncherStore';

import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { focusManager } from '../ui/focus/FocusManager';
import { useInputAction } from '../ui/focus/InputDriver';
import { OreToggleButton, type ToggleOption } from '../ui/primitives/OreToggleButton';

import { OverviewPanel } from '../features/InstanceDetail/components/tabs/OverviewPanel';
import { BasicPanel } from '../features/InstanceDetail/components/tabs/BasicPanel';
import { JavaPanel } from '../features/InstanceDetail/components/tabs/JavaPanel';
import { ModPanel } from '../features/InstanceDetail/components/tabs/ModPanel';
import { SavePanel } from '../features/InstanceDetail/components/tabs/SavePanel';
import { ResourcePackPanel } from '../features/InstanceDetail/components/tabs/ResourcePackPanel';
import { ShaderPanel } from '../features/InstanceDetail/components/tabs/ShaderPanel';
import { ExportPanel } from '../features/InstanceDetail/components/tabs/export';

const TABS: { id: DetailTab; label: string; icon: React.FC<any> }[] = [
  { id: 'overview', label: '概览', icon: LayoutTemplate },
  { id: 'basic', label: '基础', icon: Settings },
  { id: 'java', label: 'Java', icon: Coffee },
  { id: 'saves', label: '存档', icon: FolderOpen },
  { id: 'mods', label: 'MOD', icon: Blocks },
  { id: 'resourcepacks', label: '资源包', icon: Package },
  { id: 'shaders', label: '光影', icon: ImageIcon },
  { id: 'export', label: '导出', icon: Download },
];

const InstanceDetail: React.FC = () => {
  const instanceId = useLauncherStore((state) => state.selectedInstanceId) || 'demo-id-123';
  const setActiveTabGlobal = useLauncherStore((state) => state.setActiveTab);

  const {
    activeTab,
    setActiveTab,
    data,
    isInitializing,
    currentImageIndex,
    heroLogoUrl,
    handlePlay,
    handleOpenFolder,
    handleUpdateName,
    handleUpdateCover,
    handleUpdateHeroLogo,
    handleVerifyFiles,
    handleDeleteInstance,
  } = useInstanceDetail(instanceId);

  const { ref: pageFocusRef, focusKey } = useFocusable();

  const tabFallbackFocusKeys = useMemo<Record<DetailTab, string | undefined>>(
    () => ({
      overview: 'overview-btn-play',
      basic: 'basic-input-name',
      java: 'java-entry-point', // ✅ 核心修复 1：将旧的 java-loading-anchor 修正为现在的 java-entry-point
      saves: 'save-btn-history',
      mods: 'mod-btn-history',
      resourcepacks: 'btn-open-resourcepack-folder',
      shaders: 'btn-open-shader-folder',
      export: undefined,
    }),
    []
  );

  const restoreTabFocus = useCallback(
    (tab: DetailTab) => {
      const boundaryId = `tab-boundary-${tab}`;
      const fallbackKey = tabFallbackFocusKeys[tab];

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

  const toggleOptions: ToggleOption[] = useMemo(
    () =>
      TABS.map((tab) => ({
        value: tab.id,
        label: (
          <div className="flex items-center justify-center whitespace-nowrap gap-2 px-1 pointer-events-none">
            <tab.icon size={16} className={activeTab === tab.id ? 'text-ore-black' : 'text-inherit'} />
            <span>{tab.label}</span>
          </div>
        ),
      })),
    [activeTab]
  );

  const handleTabSelect = useCallback(
    (id: string) => {
      setActiveTab(id as DetailTab);
    },
    [setActiveTab]
  );

  useEffect(() => {
    if (!data) return;
    return restoreTabFocus(activeTab);
  }, [data, activeTab, restoreTabFocus]);

  const isTextEntryActive = useCallback(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
  }, []);

  useInputAction('PAGE_LEFT', () => {
    if (isTextEntryActive()) return;
    const currentIndex = TABS.findIndex((t) => t.id === activeTab);
    const prevIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    handleTabSelect(TABS[prevIndex].id);
  });

  useInputAction('PAGE_RIGHT', () => {
    if (isTextEntryActive()) return;
    const currentIndex = TABS.findIndex((t) => t.id === activeTab);
    const nextIndex = (currentIndex + 1) % TABS.length;
    handleTabSelect(TABS[nextIndex].id);
  });

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
      <div className="w-full h-full flex items-center justify-center text-white font-minecraft">
        加载中...
      </div>
    );
  }

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={pageFocusRef} className="w-full h-full flex flex-col overflow-hidden">
        <div className="flex flex-col flex-shrink-0 z-20 bg-[#1E1E1F] border-b-[3px] border-[#18181B] shadow-md">
          <div className="w-full pt-4 pb-4 px-4 md:px-8 bg-[#18181B]">
            <div className="max-w-6xl mx-auto w-full flex items-center">
              <div className="hidden md:flex flex-shrink-0 text-gray-500 font-minecraft text-xs items-center mr-4 bg-black/30 px-2.5 py-1.5 rounded-sm border-b-2 border-white/5 shadow-inner">
                <span className="text-gray-300 font-bold mx-1">LT</span> / <span className="text-gray-300 font-bold mx-1">;</span>
              </div>

              <div className="flex-1 overflow-x-auto custom-scrollbar pb-2">
                <div className="min-w-max h-[44px]">
                  <OreToggleButton
                    options={toggleOptions}
                    value={activeTab}
                    onChange={handleTabSelect}
                    size="md"
                    focusable={false}
                  />
                </div>
              </div>

              <div className="hidden md:flex flex-shrink-0 text-gray-500 font-minecraft text-xs items-center ml-4 bg-black/30 px-2.5 py-1.5 rounded-sm border-b-2 border-white/5 shadow-inner">
                <span className="text-gray-300 font-bold mx-1">RT</span> / <span className="text-gray-300 font-bold mx-1">'</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative flex flex-col bg-[#141415]">
          <div className={activeTab === 'overview' ? 'w-full h-full flex flex-col min-h-0' : 'hidden'}>
            <FocusBoundary id="tab-boundary-overview" isActive={activeTab === 'overview'} trapFocus className="w-full h-full">
              <OverviewPanel
                data={data}
                currentImageIndex={currentImageIndex}
                heroLogoUrl={heroLogoUrl}
                onPlay={handlePlay}
                onOpenFolder={handleOpenFolder}
                onUpdateHeroLogo={handleUpdateHeroLogo}
              />
            </FocusBoundary>
          </div>

          <div className={activeTab === 'basic' ? 'w-full h-full flex flex-col min-h-0' : 'hidden'}>
            <FocusBoundary id="tab-boundary-basic" isActive={activeTab === 'basic'} trapFocus className="w-full h-full">
              <BasicPanel
                data={data}
                isInitializing={isInitializing}
                onUpdateName={handleUpdateName}
                onUpdateCover={handleUpdateCover}
                onVerifyFiles={handleVerifyFiles}
                onDelete={async (skipConfirm?: boolean) => {
                  const success = await handleDeleteInstance(skipConfirm);
                  if (success) setActiveTabGlobal('instances');
                }}
              />
            </FocusBoundary>
          </div>

          <div className={activeTab === 'java' ? 'w-full h-full flex flex-col min-h-0' : 'hidden'}>
            <FocusBoundary id="tab-boundary-java" isActive={activeTab === 'java'} trapFocus className="w-full h-full">
              <JavaPanel instanceId={instanceId} isActive={activeTab === 'java'} />
            </FocusBoundary>
          </div>

          <div className={activeTab === 'mods' ? 'w-full h-full flex flex-col min-h-0' : 'hidden'}>
            <FocusBoundary id="tab-boundary-mods" isActive={activeTab === 'mods'} trapFocus className="w-full h-full">
              <ModPanel instanceId={instanceId} />
            </FocusBoundary>
          </div>

          <div className={activeTab === 'saves' ? 'w-full h-full flex flex-col min-h-0' : 'hidden'}>
            <FocusBoundary id="tab-boundary-saves" isActive={activeTab === 'saves'} trapFocus className="w-full h-full">
              <SavePanel instanceId={instanceId} />
            </FocusBoundary>
          </div>

          <div className={activeTab === 'resourcepacks' ? 'w-full h-full flex flex-col min-h-0' : 'hidden'}>
            <FocusBoundary id="tab-boundary-resourcepacks" isActive={activeTab === 'resourcepacks'} trapFocus className="w-full h-full">
              <ResourcePackPanel instanceId={instanceId} />
            </FocusBoundary>
          </div>

          <div className={activeTab === 'shaders' ? 'w-full h-full flex flex-col min-h-0' : 'hidden'}>
            <FocusBoundary id="tab-boundary-shaders" isActive={activeTab === 'shaders'} trapFocus className="w-full h-full">
              <ShaderPanel instanceId={instanceId} />
            </FocusBoundary>
          </div>

          {activeTab === 'export' && (
            <div className="w-full h-full flex flex-col min-h-0">
              <FocusBoundary id="tab-boundary-export" isActive={activeTab === 'export'} trapFocus className="w-full h-full">
                <ExportPanel 
                  instanceId={instanceId} 
                  defaultName={data.name} 
                  defaultHeroLogo={heroLogoUrl || undefined} 
                  defaultVersion={data.description?.match(/1\.\d+\.\d+/)?.[0] || '1.0.0'} 
                />
              </FocusBoundary>
            </div>
          )}
        </div>
      </div>
    </FocusContext.Provider>
  );
};

export default InstanceDetail;