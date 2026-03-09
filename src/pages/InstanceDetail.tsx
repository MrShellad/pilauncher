// /src/pages/InstanceDetail.tsx
import React, { useState, useEffect, useRef } from 'react'; // ✅ 补充引入 useRef
import { ArrowLeft, LayoutTemplate, Settings, Coffee, FolderOpen, Blocks, Package, Image as ImageIcon, Download } from 'lucide-react';
import { useFocusable, FocusContext, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useInstanceDetail, type DetailTab } from '../hooks/pages/InstanceDetail/useInstanceDetail';
import { OverviewPanel } from '../features/InstanceDetail/components/tabs/OverviewPanel';
import { BasicPanel } from '../features/InstanceDetail/components/tabs/BasicPanel'; 
import { useLauncherStore } from '../store/useLauncherStore'; 
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { VerticalNav } from '../ui/navigation/VerticalNav';
import { JavaPanel } from '../features/InstanceDetail/components/tabs/JavaPanel';
import { ModPanel } from '../features/InstanceDetail/components/tabs/ModPanel';
import { SavePanel } from '../features/InstanceDetail/components/tabs/SavePanel';
import { ResourcePackPanel } from '../features/InstanceDetail/components/tabs/ResourcePackPanel';
import { ShaderPanel } from '../features/InstanceDetail/components/tabs/ShaderPanel';

const TABS: { id: DetailTab; label: string; icon: React.FC<any> }[] = [
  { id: 'overview', label: '概览', icon: LayoutTemplate },
  { id: 'basic', label: '基础', icon: Settings },
  { id: 'java', label: 'Java', icon: Coffee },
  { id: 'saves', label: '存档管理', icon: FolderOpen },
  { id: 'mods', label: 'MOD管理', icon: Blocks },
  { id: 'resourcepacks', label: '资源包', icon: Package },
  { id: 'shaders', label: '光影管理', icon: ImageIcon },
  { id: 'export', label: '整合包导出', icon: Download },
];

const FocusableBackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { ref, focused } = useFocusable({ onEnterPress: onClick });
  return (
    <button ref={ref} onClick={onClick} className={`flex items-center transition-colors font-minecraft px-3 py-1.5 rounded-sm outline-none ${focused ? 'text-white bg-white/10 ring-2 ring-white shadow-lg' : 'text-ore-text-muted hover:text-white hover:bg-white/5'}`}>
      <ArrowLeft size={18} className="mr-2" />
      返回实例列表
    </button>
  );
};

const InstanceDetail: React.FC = () => {
  const instanceId = useLauncherStore(state => state.selectedInstanceId) || "demo-id-123"; 
  const { 
    activeTab, setActiveTab, data, isInitializing, currentImageIndex, handlePlay,
    handleOpenFolder, 
    handleUpdateName, handleUpdateCover, handleVerifyFiles, handleDeleteInstance 
  } = useInstanceDetail(instanceId);
  const setActiveTabGlobal = useLauncherStore(state => state.setActiveTab);

  const { ref: pageFocusRef, focusKey } = useFocusable();

  const [activePane, setActivePane] = useState<'sidebar' | 'content'>('sidebar');
  
  // ✅ 新增：用于记录初始焦点是否已经设置过
  const initialFocusRef = useRef(false);

  // ✅ 新增：在数据加载完毕并挂载完真实 DOM 后，主动将焦点锁死在左侧导航栏
  useEffect(() => {
    if (data && !initialFocusRef.current) {
      initialFocusRef.current = true;
      // 延迟 150ms 等待 Framer Motion 页面切换动画结束，以及空间导航节点向引擎注册完毕
      const timer = setTimeout(() => {
        setFocus(activeTab); 
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [data, activeTab]);

  const handleTabPreview = (id: string) => {
    setActiveTab(id as DetailTab);
  };

  const handleTabSelect = (id: string) => {
    setActiveTab(id as DetailTab);
    setActivePane('content'); 
    setTimeout(() => setFocus('instance-detail-content'), 50);
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
          activeEl.blur();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (activePane === 'content') {
          setActivePane('sidebar');
          setFocus(activeTab); 
        } else {
          setActiveTabGlobal('instances'); 
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [activePane, activeTab, setActiveTabGlobal]);

  if (!data) return <div className="w-full h-full flex items-center justify-center text-white font-minecraft">加载中...</div>;

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={pageFocusRef} className="w-full h-full flex flex-col bg-[#141415] overflow-hidden">
        
        <div className="h-12 bg-[#1E1E1F] border-b-2 border-black flex items-center px-2 flex-shrink-0 z-20">
          <FocusableBackButton onClick={() => setActiveTabGlobal('instances')} />
        </div>

        <div className="flex flex-1 overflow-hidden">
          
          <div 
            className="w-56 bg-[#18181B] border-r-2 border-black flex-shrink-0 flex flex-col py-2 overflow-y-auto custom-scrollbar"
            onFocusCapture={() => setActivePane('sidebar')}
            onClickCapture={() => setActivePane('sidebar')}
          >
            <VerticalNav 
              boundaryId="instance-detail-sidebar" 
              items={TABS} 
              activeId={activeTab} 
              onPreview={handleTabPreview}
              onSelect={handleTabSelect} 
            />
          </div>

          <div 
            className="flex-1 overflow-hidden relative flex flex-col"
            onFocusCapture={() => setActivePane('content')}
            onClickCapture={() => setActivePane('content')}
          >
  
            <FocusBoundary id="instance-detail-content" trapFocus={true} className="w-full h-full">
              {activeTab === 'overview' && (
                <OverviewPanel 
                  data={data} 
                  currentImageIndex={currentImageIndex} 
                  onPlay={handlePlay} 
                  onOpenFolder={handleOpenFolder} 
                />
              )}
              
              {activeTab === 'basic' && (
                <BasicPanel 
                  data={data} 
                  isInitializing={isInitializing}
                  onUpdateName={handleUpdateName} 
                  onUpdateCover={handleUpdateCover} 
                  onVerifyFiles={handleVerifyFiles} 
                  onDelete={async () => {
                    const success = await handleDeleteInstance();
                    if (success) {
                      setActiveTabGlobal('instances'); 
                    }
                  }} 
                />
              )}
              
              {activeTab === 'java' && <JavaPanel instanceId={instanceId} />}
              {activeTab === 'mods' && <ModPanel instanceId={instanceId} />}
              {activeTab === 'saves' && <SavePanel instanceId={instanceId} />}
              {activeTab === 'resourcepacks' && <ResourcePackPanel instanceId={instanceId} />}
              {activeTab === 'shaders' && <ShaderPanel instanceId={instanceId} />}

              {activeTab !== 'overview' && activeTab !== 'basic' && activeTab !== 'java' && activeTab !== 'mods' && activeTab !== 'saves' && activeTab !== 'resourcepacks' && activeTab !== 'shaders' &&(
                <div className="w-full h-full flex items-center justify-center text-ore-text-muted font-minecraft text-xl">
                  {TABS.find(t => t.id === activeTab)?.label} 页面开发中...
                </div>
              )}
            </FocusBoundary>
          </div>

        </div>
      </div>
    </FocusContext.Provider>
  );
};

export default InstanceDetail;