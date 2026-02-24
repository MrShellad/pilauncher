// /src/pages/Instances.tsx
import React, { useState } from 'react';
import { useInstances } from '../hooks/pages/Instances/useInstances';
import { OreButton } from '../ui/primitives/OreButton';
import { Plus, Download, FolderPlus, List, LayoutGrid } from 'lucide-react';

// 引入解耦后的两个视图组件
import { InstanceListView } from '../features/Instances/components/InstanceListView';
import { InstanceCardView } from '../features/Instances/components/InstanceCardView';

const Instances: React.FC = () => {
  const {
    instances,
    handleCreate,
    handleImport,
    handleAddFolder,
    handleEdit,
    handleCardClick
  } = useInstances();

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  return (
    <div className="flex flex-col w-full h-full p-6 sm:p-8 overflow-hidden bg-black/40">
      
      {/* 1. 顶部操作区 (保持不变) */}
      <div className="flex justify-between items-center w-full mb-6 flex-shrink-0">
        {/* 左侧：视图切换器 */}
        <div className="flex items-center bg-[#1E1E1F] border-2 border-ore-gray-border p-0.5">
          <button onClick={() => setViewMode('list')} className={`p-1.5 transition-colors focus:outline-none ${viewMode === 'list' ? 'bg-white/20 text-white shadow-inner' : 'text-ore-text-muted hover:text-white hover:bg-white/10'}`} title="列表视图">
            <List size={20} />
          </button>
          <button onClick={() => setViewMode('grid')} className={`p-1.5 transition-colors focus:outline-none ${viewMode === 'grid' ? 'bg-white/20 text-white shadow-inner' : 'text-ore-text-muted hover:text-white hover:bg-white/10'}`} title="网格视图">
            <LayoutGrid size={20} />
          </button>
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex space-x-4 overflow-x-auto pb-2 scrollbar-none items-center">
          <OreButton variant="primary" size="auto" onClick={handleCreate}>
            <span className="flex items-center justify-center whitespace-nowrap">
              <Plus size={18} className="mr-2 flex-shrink-0" />
              <span className="font-minecraft tracking-wider">新建实例</span>
            </span>
          </OreButton>
          <OreButton variant="secondary" size="auto" onClick={handleImport}>
            <span className="flex items-center justify-center whitespace-nowrap">
              <Download size={18} className="mr-2 flex-shrink-0" />
              <span className="font-minecraft tracking-wider">导入实例</span>
            </span>
          </OreButton>
          <OreButton variant="secondary" size="auto" onClick={handleAddFolder}>
            <span className="flex items-center justify-center whitespace-nowrap">
              <FolderPlus size={18} className="mr-2 flex-shrink-0" />
              <span className="font-minecraft tracking-wider">添加文件夹</span>
            </span>
          </OreButton>
        </div>
      </div>

      {/* 2. 实例列表区 (极度精简版) */}
      <div className={`
        flex-1 overflow-y-auto pr-2 
        scrollbar-thin scrollbar-thumb-ore-gray-border scrollbar-track-transparent
        ${viewMode === 'grid' ? 'grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 content-start' : 'space-y-3'}
      `}>
        {instances.map((instance) => (
          viewMode === 'list' ? (
            <InstanceListView 
              key={instance.id} 
              instance={instance} 
              onClick={() => handleCardClick(instance.id)} 
              onEdit={() => handleEdit(instance.id)} 
            />
          ) : (
            <InstanceCardView 
              key={instance.id} 
              instance={instance} 
              onClick={() => handleCardClick(instance.id)} 
              onEdit={() => handleEdit(instance.id)} 
            />
          )
        ))}
      </div>

    </div>
  );
};

export default Instances;