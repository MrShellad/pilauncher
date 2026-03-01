// /src/features/InstanceDetail/components/tabs/ModPanel.tsx
import React, { useState } from 'react';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { History, Loader2, RefreshCw, HardDriveDownload, FolderOpen, DownloadCloud, Clock, Type } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { useModManager } from '../../hooks/useModManager';
import { ModList } from './mods/ModList';
import { ModDetailModal } from './mods/ModDetailModal';
import type { ModMeta } from '../../logic/modService';

export const ModPanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const { 
    mods, isLoading, instanceConfig, isCreatingSnapshot, sortType, setSortType,
    toggleMod, deleteMod, createSnapshot, openModFolder
  } = useModManager(instanceId);
  
  const [selectedMod, setSelectedMod] = useState<ModMeta | null>(null);

  const handleCloseModal = () => {
    setSelectedMod(null);
    setTimeout(() => setFocus('instance-detail-content'), 50);
  };

  const handleToggle = (fileName: string, currentEnabled: boolean) => {
    setSelectedMod(prev => prev ? { ...prev, isEnabled: !currentEnabled, fileName: currentEnabled ? `${fileName}.disabled` : fileName.replace('.disabled', '') } : null);
    toggleMod(fileName, currentEnabled);
  };

  return (
    <SettingsPageLayout title="MOD 管理" subtitle="Modifications & Snapshot">
      
      {/* 顶部工具栏：时光机 */}
      <div className="flex justify-between items-center mb-4 bg-[#18181B] p-4 border-2 border-[#2A2A2C]">
        <div>
          <h3 className="text-white font-minecraft flex items-center"><History size={18} className="mr-2 text-ore-green" /> 模组时光机 (Snapshot)</h3>
          <p className="text-sm text-ore-text-muted mt-1">更新模组前，建议创建快照。崩溃时可在“历史快照”一键回滚整个目录。</p>
        </div>
        <div className="flex space-x-3">
          <OreButton variant="secondary"><RefreshCw size={16} className="mr-2" /> 历史快照</OreButton>
          <OreButton variant="primary" onClick={createSnapshot} disabled={isLoading || isCreatingSnapshot}>
            {isCreatingSnapshot ? <Loader2 size={16} className="animate-spin mr-2" /> : <HardDriveDownload size={16} className="mr-2" />}
            创建当前快照
          </OreButton>
        </div>
      </div>

      {/* ✅ 新增：列表操作控制栏 (排序与外部操作) */}
      <div className="flex justify-between items-center mb-4 px-2">
        {/* 左侧：分段排序控件 */}
        <div className="flex bg-[#141415] border-2 border-[#1E1E1F] p-0.5 relative z-10 shadow-inner">
          <button 
            onClick={() => setSortType('time')}
            className={`flex items-center px-3 py-1.5 font-minecraft text-sm transition-all outline-none ${sortType === 'time' ? 'bg-[#2A2A2C] text-white shadow-md' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
          >
            <Clock size={14} className="mr-1.5" /> 按下载时间
          </button>
          <button 
            onClick={() => setSortType('name')}
            className={`flex items-center px-3 py-1.5 font-minecraft text-sm transition-all outline-none ${sortType === 'name' ? 'bg-[#2A2A2C] text-white shadow-md' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
          >
            <Type size={14} className="mr-1.5" /> 按模组名称
          </button>
        </div>

        {/* 右侧：文件夹与下载按钮 */}
        <div className="flex space-x-3">
          <OreButton variant="secondary" size="sm" onClick={openModFolder}>
            <FolderOpen size={16} className="mr-2" /> 打开目录
          </OreButton>
          <OreButton variant="primary" size="sm" onClick={() => alert('Mod 下载与搜索页面开发中...')}>
            <DownloadCloud size={16} className="mr-2" /> 下载 MOD
          </OreButton>
        </div>
      </div>

      {/* 纯渲染层：列表 */}
      <ModList mods={mods} isLoading={isLoading} onSelectMod={setSelectedMod} />

      {/* 独立生命周期层：弹窗 */}
      <ModDetailModal 
        mod={selectedMod} 
        instanceConfig={instanceConfig}
        onClose={handleCloseModal}
        onToggle={handleToggle}
        onDelete={deleteMod}
      />
      
    </SettingsPageLayout>
  );
};