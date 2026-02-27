// /src/pages/InstanceDetail.tsx
import React from 'react';
import { ArrowLeft, LayoutTemplate, Settings, Coffee, FolderOpen, Blocks, Package, Image as ImageIcon, Download } from 'lucide-react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';

import { useInstanceDetail, type DetailTab } from '../hooks/pages/InstanceDetail/useInstanceDetail';
import { OverviewPanel } from '../features/InstanceDetail/components/tabs/OverviewPanel';
import { BasicPanel } from '../features/InstanceDetail/components/tabs/BasicPanel'; 
import { useLauncherStore } from '../store/useLauncherStore'; 

// ✅ 引入我们刚刚封装好的通用垂直导航组件
import { VerticalNav } from '../ui/navigation/VerticalNav';

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

// ================= 子组件：支持焦点的返回按钮 =================
// 注：为了保留顶部返回按钮特殊的样式，我们没有用普通的 OreButton 替代它，
// 而是保留了这个简单的封装，让它依然支持手柄/键盘焦点。
const FocusableBackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { ref, focused } = useFocusable({
    onEnterPress: onClick,
  });

  return (
    <button 
      ref={ref}
      onClick={onClick}
      className={`
        flex items-center transition-colors font-minecraft px-3 py-1.5 rounded-sm outline-none
        ${focused ? 'text-white bg-white/10 ring-2 ring-white shadow-lg' : 'text-ore-text-muted hover:text-white hover:bg-white/5'}
      `}
    >
      <ArrowLeft size={18} className="mr-2" />
      返回实例列表
    </button>
  );
};

// ================= 主页面组件 =================
const InstanceDetail: React.FC = () => {
  const instanceId = useLauncherStore(state => state.selectedInstanceId) || "demo-id-123"; 
  const { 
    activeTab, setActiveTab, data, currentImageIndex, handlePlay,
    handleUpdateName, handleUpdateCover, handleVerifyFiles, handleDeleteInstance 
  } = useInstanceDetail(instanceId);
  const setActiveTabGlobal = useLauncherStore(state => state.setActiveTab);

  // 为整个详情页创建一个 Focus Context，限制焦点作用域，防止跑偏
  const { ref: pageFocusRef, focusKey } = useFocusable();

  if (!data) {
    return <div className="w-full h-full flex items-center justify-center text-white font-minecraft">加载中...</div>;
  }

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={pageFocusRef} className="w-full h-full flex flex-col bg-[#141415] overflow-hidden">
        
        {/* 顶部返回条 */}
        <div className="h-12 bg-[#1E1E1F] border-b-2 border-black flex items-center px-2 flex-shrink-0 z-20">
          <FocusableBackButton onClick={() => setActiveTabGlobal('instances')} />
        </div>

        {/* 左右分栏容器 */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* 左侧：导航栏 (✅ 极简接入通用组件，由 FocusManager 自动记录焦点位置) */}
          <div className="w-56 bg-[#18181B] border-r-2 border-black flex-shrink-0 flex flex-col py-2 overflow-y-auto custom-scrollbar">
            <VerticalNav 
              boundaryId="instance-detail-sidebar" 
              items={TABS} 
              activeId={activeTab} 
              onSelect={(id) => setActiveTab(id as DetailTab)} 
            />
          </div>

          {/* 右侧：内容渲染区 */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'overview' && (
              <OverviewPanel 
                data={data} 
                currentImageIndex={currentImageIndex} 
                onPlay={handlePlay} 
              />
            )}

            {activeTab === 'basic' && (
              <BasicPanel 
                data={data}
                onUpdateName={handleUpdateName}
                onUpdateCover={handleUpdateCover}
                onVerifyFiles={handleVerifyFiles}
                onDelete={handleDeleteInstance}
              />
            )}

            {activeTab !== 'overview' && activeTab !== 'basic' && (
              <div className="w-full h-full flex items-center justify-center text-ore-text-muted font-minecraft text-xl">
                {TABS.find(t => t.id === activeTab)?.label} 页面开发中...
              </div>
            )}
          </div>

        </div>
      </div>
    </FocusContext.Provider>
  );
};

export default InstanceDetail;