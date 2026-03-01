// /src/features/InstanceDetail/components/tabs/SavePanel.tsx
import React, { useState } from 'react';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { OreList } from '../../../../ui/primitives/OreList';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { Globe, FolderOpen, Archive, Trash2, Loader2, HardDrive, History } from 'lucide-react';

import { useSaveManager } from '../../hooks/useSaveManager';
import { SaveRestoreModal } from './saves/SaveRestoreModal';
import { BackupListModal } from './saves/BackupListModal';
import type { SaveBackupMetadata } from '../../logic/saveService';

export const SavePanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const { saves, backups, isLoading, isBackingUp, backupSave, deleteSave, formatSize, formatDate } = useSaveManager(instanceId);
  
  // 控制两个弹窗的开关状态
  const [isBackupListOpen, setIsBackupListOpen] = useState(false);
  const [verifyingBackup, setVerifyingBackup] = useState<SaveBackupMetadata | null>(null);

  // 当用户在备份列表中点击某一个备份时触发
  const handleSelectBackup = (backup: SaveBackupMetadata) => {
    setIsBackupListOpen(false); // 关闭列表弹窗
    setVerifyingBackup(backup); // 打开安全预检弹窗
  };

  return (
    <SettingsPageLayout title="存档管理" subtitle="Worlds & Backups">
      
      {/* 顶部工具栏 */}
      <div className="flex justify-between items-center mb-6 bg-[#18181B] p-4 border-2 border-[#2A2A2C]">
        <div>
          <h3 className="text-white font-minecraft flex items-center">
            <HardDrive size={18} className="mr-2 text-ore-green" /> 存储概览
          </h3>
          <p className="text-sm text-ore-text-muted mt-1">共发现 {saves.length} 个存档，{backups.length} 个历史备份。</p>
        </div>
        <div className="flex space-x-3">
          {/* ✅ 新增：打开备份列表弹窗的按钮 */}
          <OreButton variant="secondary" size="sm" onClick={() => setIsBackupListOpen(true)}>
            <History size={16} className="mr-2" /> 恢复中心
          </OreButton>
          <OreButton variant="secondary" size="sm" onClick={() => alert('打开目录功能开发中')}>
            <FolderOpen size={16} className="mr-2" /> 打开目录
          </OreButton>
        </div>
      </div>

      {/* 存档列表渲染 */}
      {isLoading ? (
        <div className="flex justify-center py-12 text-ore-green"><Loader2 size={32} className="animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 overflow-y-auto custom-scrollbar px-2 pb-4">
          {saves.map((save, i) => (
            <OreList
              key={i}
              title={save.worldName}
              subtitle={`文件夹: ${save.folderName} | 大小: ${formatSize(save.sizeBytes)}`}
              description={`最后游玩: ${formatDate(save.lastPlayedTime)}`}
              icon={<Globe size={32} className="text-ore-text-muted/50 drop-shadow-md" />}
              actions={
                <>
                  <button 
                    onClick={() => backupSave(save.folderName)}
                    disabled={isBackingUp}
                    className="p-1.5 rounded text-ore-green hover:bg-white/10 transition-colors disabled:opacity-50"
                    title="创建安全备份"
                  >
                    {isBackingUp ? <Loader2 size={18} className="animate-spin" /> : <Archive size={18} />}
                  </button>
                  <button 
                    onClick={() => deleteSave(save.folderName)}
                    className="p-1.5 rounded text-red-400 hover:bg-red-400/10 transition-colors"
                    title="移入回收站或彻底删除"
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}

      {/* ✅ 弹窗 1：备份列表 */}
      <BackupListModal 
        isOpen={isBackupListOpen} 
        onClose={() => setIsBackupListOpen(false)} 
        backups={backups}
        formatSize={formatSize}
        formatDate={formatDate}
        onSelectBackup={handleSelectBackup}
      />

      {/* ✅ 弹窗 2：安全校验与恢复二次确认 */}
      <SaveRestoreModal 
        instanceId={instanceId}
        backupMeta={verifyingBackup} 
        onClose={() => setVerifyingBackup(null)}
        onConfirmRestore={(uuid) => {
          alert(`正在恢复快照：${uuid}\n(底层覆盖逻辑开发中...)`);
          setVerifyingBackup(null);
        }}
      />
      
    </SettingsPageLayout>
  );
};