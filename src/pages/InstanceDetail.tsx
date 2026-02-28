// /src/pages/InstanceDetail.tsx
import React, { useState, useEffect } from 'react';
import { ArrowLeft, LayoutTemplate, Settings, Coffee, FolderOpen, Blocks, Package, Image as ImageIcon, Download } from 'lucide-react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useInstanceDetail, type DetailTab } from '../hooks/pages/InstanceDetail/useInstanceDetail';
import { OverviewPanel } from '../features/InstanceDetail/components/tabs/OverviewPanel';
import { BasicPanel } from '../features/InstanceDetail/components/tabs/BasicPanel'; 
import { useLauncherStore } from '../store/useLauncherStore'; 
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { VerticalNav } from '../ui/navigation/VerticalNav';
import { JavaPanel } from '../features/InstanceDetail/components/tabs/JavaPanel';

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
    handleUpdateName, handleUpdateCover, handleVerifyFiles, handleDeleteInstance 
  } = useInstanceDetail(instanceId);
  const setActiveTabGlobal = useLauncherStore(state => state.setActiveTab);

  const { ref: pageFocusRef, focusKey } = useFocusable();

  // ✅ 核心魔法：上帝视角的激活面板记录器，脱离空间引擎的不可控状态
  const [activePane, setActivePane] = useState<'sidebar' | 'content'>('sidebar');

  const handleTabPreview = (id: string) => {
    setActiveTab(id as DetailTab);
  };

  const handleTabSelect = (id: string) => {
    setActiveTab(id as DetailTab);
    setActivePane('content'); // 明确进入右侧
    setTimeout(() => setFocus('instance-detail-content'), 50);
  };

  // ✅ 终极 ESC 退出链条（接管一切路由与回退）
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        
        // 1. 防御机制：如果在输入框里打字，只取消焦点，绝对不越级退出
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
          activeEl.blur();
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        // 2. 完美的层级穿越逻辑
        if (activePane === 'content') {
          setActivePane('sidebar');
          setFocus(activeTab); // 从右侧退回侧边栏，并精准选中刚刚的 Tab！
        } else {
          setActiveTabGlobal('instances'); // 从侧边栏退出整个设置页
        }
      }
    };
    
    // 注意：这里用普通阶段监听。因为之前在 OreModal 里我们加了 capture: true。
    // 所以如果是“弹窗打开”状态，弹窗会最先抢走 ESC 并拦截，这里根本不会执行。简直天衣无缝！
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
          
          {/* ✅ 左侧容器：通过 Capture 捕获任何流经这里的交互 */}
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

          {/* ✅ 右侧容器：同样通过 Capture 捕获鼠标或键盘产生的任何微小动作 */}
          <div 
            className="flex-1 overflow-hidden relative flex flex-col"
            onFocusCapture={() => setActivePane('content')}
            onClickCapture={() => setActivePane('content')}
          >
            {/* 这里的 onEscape 可以删掉了，全权交由上方上帝视角的 handleEsc 处理 */}
            {/* 这里的 onEscape 可以删掉了，全权交由上方上帝视角的 handleEsc 处理 */}
            <FocusBoundary id="instance-detail-content" trapFocus={true} className="w-full h-full">
              {activeTab === 'overview' && <OverviewPanel data={data} currentImageIndex={currentImageIndex} onPlay={handlePlay} />}
              
              {/* ✅ 修改这里：传入 isInitializing，并处理删除成功后的路由回退 */}
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
                      setActiveTabGlobal('instances'); // 成功删除后，跳回全局的实例列表
                    }
                  }} 
                />
              )}
              
              {activeTab === 'java' && <JavaPanel instanceId={instanceId} />}
              {activeTab !== 'overview' && activeTab !== 'basic' && activeTab !== 'java' && (
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