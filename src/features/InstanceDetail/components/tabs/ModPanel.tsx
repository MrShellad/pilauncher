// /src/features/InstanceDetail/components/tabs/ModPanel.tsx
import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event'; // ✅ 引入全局事件监听
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { History, Loader2, RefreshCw, HardDriveDownload, FolderOpen, DownloadCloud, Clock, Type } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { useModManager } from '../../hooks/useModManager';
import { ModList } from './mods/ModList';
import { ModDetailModal } from './mods/ModDetailModal';
import { InstanceModDownloadView } from './mods/InstanceModDownloadView';
import type { ModMeta } from '../../logic/modService';

export const ModPanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const { 
    mods, isLoading, instanceConfig, isCreatingSnapshot, sortType, setSortType,
    toggleMod, deleteMod, createSnapshot, openModFolder, loadMods
  } = useModManager(instanceId);
  
  const [selectedMod, setSelectedMod] = useState<ModMeta | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'download'>('list');

  // ==============================================================
  // ✅ 核心修复：自动侦听底层下载完成事件，实现列表真正的无感热更新
  // ==============================================================
  useEffect(() => {
    const unlisten = listen('resource-download-progress', (event: any) => {
      const payload = event.payload;
      // 当底层进度抛出“满进度”信号时，说明文件写入已经完成
      if (payload && payload.current >= payload.total && payload.total > 0) {
        // 留出 500ms 让操作系统彻底释放文件句柄，然后再抓取新文件
        setTimeout(() => {
          if (loadMods) loadMods();
        }, 500); 
      }
    });
    return () => { unlisten.then(f => f()); };
  }, [loadMods]);

  const handleCloseModal = () => {
    setSelectedMod(null);
    setTimeout(() => setFocus('instance-detail-content'), 50);
  };

  const handleToggle = (fileName: string, currentEnabled: boolean) => {
    setSelectedMod(prev => prev ? { ...prev, isEnabled: !currentEnabled, fileName: currentEnabled ? `${fileName}.disabled` : fileName.replace('.disabled', '') } : null);
    toggleMod(fileName, currentEnabled);
  };

  return (
    <SettingsPageLayout 
      title={viewMode === 'download' ? "下载 MOD" : "MOD 管理"} 
      subtitle={viewMode === 'download' ? "Download & Auto Install" : "Modifications & Snapshot"}
    >
      
      {viewMode === 'list' ? (
        <>
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

          <div className="flex justify-between items-center mb-4 px-2">
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

            <div className="flex space-x-3">
              <OreButton variant="secondary" size="sm" onClick={openModFolder}>
                <FolderOpen size={16} className="mr-2" /> 打开目录
              </OreButton>
              <OreButton variant="primary" size="sm" onClick={() => setViewMode('download')}>
                <DownloadCloud size={16} className="mr-2" /> 下载 MOD
              </OreButton>
            </div>
          </div>

          <ModList mods={mods} isLoading={isLoading} onSelectMod={setSelectedMod} />

          <ModDetailModal 
            mod={selectedMod} 
            instanceConfig={instanceConfig}
            onClose={handleCloseModal}
            onToggle={handleToggle}
            onDelete={deleteMod}
          />
        </>
      ) : (
        <InstanceModDownloadView 
          instanceId={instanceId} 
          onBack={() => {
            setViewMode('list');
            // ✅ 当玩家手动点击返回时，做一次主动抓取，并设置 1000ms 的兜底抓取
            if (loadMods) {
              loadMods();
              setTimeout(loadMods, 1000);
            }
            setTimeout(() => setFocus('instance-detail-content'), 100);
          }} 
        />
      )}
      
    </SettingsPageLayout>
  );
};