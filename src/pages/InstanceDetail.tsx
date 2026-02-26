// /src/pages/InstanceDetail.tsx
import React from 'react';
import { ArrowLeft, LayoutTemplate, Settings, Coffee, FolderOpen, Blocks, Package, Image as ImageIcon, Download } from 'lucide-react';
import { useInstanceDetail } from '../hooks/pages/InstanceDetail/useInstanceDetail';
import type { DetailTab } from '../hooks/pages/InstanceDetail/useInstanceDetail';
import { OverviewPanel } from '../features/InstanceDetail/components/tabs/OverviewPanel';
// 假设你有一个全局的 Store 可以返回上一页
import { useLauncherStore } from '../store/useLauncherStore'; 

// 左侧菜单配置
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

const InstanceDetail: React.FC = () => {
  // 假设从某个状态或路由参数获取当前选中的 ID
  const instanceId = useLauncherStore(state => state.selectedInstanceId) || "demo-id-123";
  const { activeTab, setActiveTab, data, currentImageIndex, handlePlay } = useInstanceDetail(instanceId);
  const setActiveTabGlobal = useLauncherStore(state => state.setActiveTab);

  if (!data) {
    return <div className="w-full h-full flex items-center justify-center text-white font-minecraft">加载中...</div>;
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#141415] overflow-hidden">
      
      {/* 顶部返回条 */}
      <div className="h-12 bg-[#1E1E1F] border-b-2 border-black flex items-center px-4 flex-shrink-0 z-20">
        <button 
          onClick={() => setActiveTabGlobal('instances')}
          className="flex items-center text-ore-text-muted hover:text-white transition-colors font-minecraft"
        >
          <ArrowLeft size={18} className="mr-2" />
          返回实例列表
        </button>
      </div>

      {/* 左右分栏容器 */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* 左侧：导航栏 */}
        <div className="w-56 bg-[#18181B] border-r-2 border-black flex-shrink-0 flex flex-col py-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center w-full px-5 py-3 text-sm font-minecraft transition-colors relative
                  ${isActive ? 'text-white bg-[#2A2A2C]' : 'text-ore-text-muted hover:text-white hover:bg-[#1E1E1F]'}
                `}
              >
                {/* 选中时的左侧绿色指示条 */}
                {isActive && (
                  <div className="absolute left-0 top-0 w-1 h-full bg-ore-green shadow-[0_0_8px_rgba(56,133,39,0.8)]" />
                )}
                <Icon size={16} className={`mr-3 ${isActive ? 'text-ore-green' : 'opacity-70'}`} />
                {tab.label}
              </button>
            );
          })}
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
          {activeTab !== 'overview' && (
            <div className="w-full h-full flex items-center justify-center text-ore-text-muted font-minecraft text-xl">
              {TABS.find(t => t.id === activeTab)?.label} 页面开发中...
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default InstanceDetail;