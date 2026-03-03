// /src/pages/Instances.tsx
import React, { useState, useEffect } from 'react';
import { useInstances } from '../hooks/pages/Instances/useInstances';
import { OreButton } from '../ui/primitives/OreButton';
import { Plus, Download, FolderPlus, List, LayoutGrid } from 'lucide-react';

import { InstanceListView } from '../features/Instances/components/InstanceListView';
import { InstanceCardView } from '../features/Instances/components/InstanceCardView';

// 引入空间焦点引擎
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { FocusItem } from '../ui/focus/FocusItem';
import { focusManager } from '../ui/focus/FocusManager';

const Instances: React.FC = () => {
  const {
    instances,
    handleCreate,
    handleImport,
    handleAddFolder,
    handleEdit,
    handleCardClick
  } = useInstances();

  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('ore-instance-view-mode') as 'list' | 'grid') || 'grid';
  });

  useEffect(() => {
    localStorage.setItem('ore-instance-view-mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      focusManager.focus('action-new'); 
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <FocusBoundary id="instances-page" className="flex flex-col w-full h-full p-6 sm:p-8 overflow-hidden bg-black/40">
      
      {/* 1. 顶部操作区 */}
      {/* ✅ 修复点 1：强制 flex-row 不换行，items-center 保证左右两组按钮绝对水平垂直居中对齐 */}
      <div className="flex flex-row justify-between items-center w-full mb-6 flex-shrink-0 gap-4">
        
        {/* 左侧：视图切换器 (加上 flex-shrink-0 确保在极小宽度下也不会被挤压变形) */}
        <div className="flex items-center bg-[#1E1E1F] border-2 border-ore-gray-border p-0.5 flex-shrink-0">
          <FocusItem focusKey="view-list" onEnter={() => setViewMode('list')}>
            {({ ref, focused }) => (
              <button 
                ref={ref} 
                onClick={() => setViewMode('list')} 
                className={`p-1.5 transition-colors focus:outline-none ${viewMode === 'list' ? 'bg-white/20 text-white shadow-inner' : 'text-ore-text-muted hover:text-white hover:bg-white/10'} ${focused ? 'outline outline-[3px] outline-offset-[-2px] outline-white z-10 relative' : ''}`} 
                title="列表视图"
                tabIndex={-1}
              >
                <List size={20} />
              </button>
            )}
          </FocusItem>
          
          <FocusItem focusKey="view-grid" onEnter={() => setViewMode('grid')}>
            {({ ref, focused }) => (
              <button 
                ref={ref} 
                onClick={() => setViewMode('grid')} 
                className={`p-1.5 transition-colors focus:outline-none ${viewMode === 'grid' ? 'bg-white/20 text-white shadow-inner' : 'text-ore-text-muted hover:text-white hover:bg-white/10'} ${focused ? 'outline outline-[3px] outline-offset-[-2px] outline-white z-10 relative' : ''}`} 
                title="网格视图"
                tabIndex={-1}
              >
                <LayoutGrid size={20} />
              </button>
            )}
          </FocusItem>
        </div>

        {/* 右侧：操作按钮 */}
        {/* ✅ 修复点 2：
            - 去掉 flex-wrap，换回 overflow-x-auto 防止换行，超窄屏幕下可平滑横向滚动。
            - 增加 p-2 给 outline 焦点光环留出绝对充足的绘制空间，绝不被截断。
            - 增加 -mr-2 (负 Margin) 抵消 p-2 带来的布局偏移，确保右侧依然能完美贴合屏幕边缘！
            - justify-end 确保按钮永远靠右对齐。
        */}
        <div className="flex flex-row items-center justify-end gap-3 flex-1 overflow-x-auto scrollbar-none p-2 -mr-2">
          
          {/* 给每个包裹层加上 flex-shrink-0 防止在拥挤时被压缩 */}
          <FocusItem focusKey="action-new" onEnter={handleCreate}>
            {({ ref, focused }) => (
              <div ref={ref} className={`rounded-sm transition-shadow duration-150 flex-shrink-0 ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
                <OreButton variant="primary" size="auto" onClick={handleCreate} tabIndex={-1}>
                  <span className="flex items-center justify-center whitespace-nowrap">
                    <Plus size={18} className="mr-2 flex-shrink-0" />
                    <span className="font-minecraft tracking-wider">新建实例</span>
                  </span>
                </OreButton>
              </div>
            )}
          </FocusItem>
          
          <FocusItem focusKey="action-import" onEnter={handleImport}>
            {({ ref, focused }) => (
              <div ref={ref} className={`rounded-sm transition-shadow duration-150 flex-shrink-0 ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
                <OreButton variant="secondary" size="auto" onClick={handleImport} tabIndex={-1}>
                  <span className="flex items-center justify-center whitespace-nowrap">
                    <Download size={18} className="mr-2 flex-shrink-0" />
                    <span className="font-minecraft tracking-wider">导入实例</span>
                  </span>
                </OreButton>
              </div>
            )}
          </FocusItem>

          <FocusItem focusKey="action-folder" onEnter={handleAddFolder}>
            {({ ref, focused }) => (
              <div ref={ref} className={`rounded-sm transition-shadow duration-150 flex-shrink-0 ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
                <OreButton variant="secondary" size="auto" onClick={handleAddFolder} tabIndex={-1}>
                  <span className="flex items-center justify-center whitespace-nowrap">
                    <FolderPlus size={18} className="mr-2 flex-shrink-0" />
                    <span className="font-minecraft tracking-wider">添加文件夹</span>
                  </span>
                </OreButton>
              </div>
            )}
          </FocusItem>

        </div>
      </div>

      {/* 2. 实例列表区 */}
      <div className={`
        flex-1 overflow-y-auto pr-2 pb-10
        scrollbar-thin scrollbar-thumb-ore-gray-border scrollbar-track-transparent
        ${viewMode === 'grid' 
          ? 'flex flex-wrap gap-6 content-start justify-start' 
          : 'flex flex-col space-y-3'
        }
      `}>
        {instances.map((instance) => (
          viewMode === 'list' ? (
            <InstanceListView key={instance.id} instance={instance} onClick={() => handleCardClick(instance.id)} onEdit={() => handleEdit(instance.id)} />
          ) : (
            <InstanceCardView key={instance.id} instance={instance} onClick={() => handleCardClick(instance.id)} onEdit={() => handleEdit(instance.id)} />
          )
        ))}
      </div>

    </FocusBoundary>
  );
};

export default Instances;