// /src/features/InstanceDetail/components/tabs/SavePanel.tsx
import React, { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { OreList } from '../../../../ui/primitives/OreList';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { Globe, FolderOpen, Archive, Trash2, Loader2, HardDrive, History } from 'lucide-react';

import { useSaveManager } from '../../hooks/useSaveManager';
import { saveService } from '../../logic/saveService'; // ✅ 引入服务
import { SaveRestoreModal } from './saves/SaveRestoreModal';
import { BackupListModal } from './saves/BackupListModal';
import type { SaveBackupMetadata } from '../../logic/saveService';

export const SavePanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const { saves, backups, isLoading, isBackingUp, backupSave, deleteSave, formatSize, formatDate } = useSaveManager(instanceId);
  
  const [isBackupListOpen, setIsBackupListOpen] = useState(false);
  const [verifyingBackup, setVerifyingBackup] = useState<SaveBackupMetadata | null>(null);

  const handleSelectBackup = (backup: SaveBackupMetadata) => {
    setIsBackupListOpen(false);
    setVerifyingBackup(backup); 
  };

  // ✅ 调用刚才写好的专属打开目录服务
  const handleOpenFolder = async () => {
    try {
      await saveService.openSavesFolder(instanceId);
    } catch (error) {
      console.error('打开存档目录失败:', error);
    }
  };

  return (
    <SettingsPageLayout title="存档管理" subtitle="Worlds & Backups">
      
      <div className="flex justify-between items-center mb-6 bg-[#18181B] p-4 border-2 border-[#2A2A2C]">
        <div>
          <h3 className="text-white font-minecraft flex items-center">
            <HardDrive size={18} className="mr-2 text-ore-green" /> 存储概览
          </h3>
          <p className="text-sm text-ore-text-muted mt-1">共发现 {saves.length} 个存档，{backups.length} 个历史备份。</p>
        </div>
        <div className="flex space-x-3">
          <OreButton focusKey="save-btn-history" variant="secondary" size="sm" onClick={() => setIsBackupListOpen(true)}>
            <History size={16} className="mr-2" /> 恢复中心
          </OreButton>
          <OreButton focusKey="save-btn-folder" variant="secondary" size="sm" onClick={handleOpenFolder}>
            <FolderOpen size={16} className="mr-2" /> 打开目录
          </OreButton>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12 text-ore-green"><Loader2 size={32} className="animate-spin" /></div>
      ) : (
        <div className="flex flex-col space-y-2 overflow-y-auto custom-scrollbar px-2 pb-4">
          {saves.map((save, i) => (
            <OreList
              key={i}
              focusable={false} // ✅ 核心魔法：让出该行的整行焦点，使得引擎能够长驱直入内部按钮！
              title={save.worldName}
              subtitle={`文件夹: ${save.folderName} | 大小: ${formatSize(save.sizeBytes)}`}
              content={`最后游玩: ${formatDate(save.lastPlayedTime)}`}
              leading={
                save.iconPath ? (
                  <img 
                    src={`${convertFileSrc(save.iconPath)}?t=${save.lastPlayedTime}`} 
                    alt="Save Icon" 
                    className="w-12 h-12 object-cover rounded-sm border-[2px] border-[#18181B] shadow-md" 
                  />
                ) : (
                  <Globe size={32} className="text-ore-text-muted/50 drop-shadow-md" />
                )
              }
              trailing={
                <div className="flex items-center space-x-3">
                  {/* 按钮将完美接管焦点：方向键左右可以在它们之间切换 */}
                  <OreButton 
                    focusKey={`save-btn-backup-${i}`}
                    variant="secondary" 
                    size="sm"
                    onClick={() => backupSave(save.folderName)}
                    disabled={isBackingUp}
                  >
                    {isBackingUp ? <Loader2 size={16} className="animate-spin mr-2" /> : <Archive size={16} className="mr-2" />}
                    备份
                  </OreButton>
                  
                  <OreButton 
                    focusKey={`save-btn-delete-${i}`}
                    variant="danger" 
                    size="sm"
                    onClick={() => deleteSave(save.folderName)}
                  >
                    <Trash2 size={16} className="mr-2" />
                    删除
                  </OreButton>
                </div>
              }
            />
          ))}
        </div>
      )}

      {/* 弹窗部分 */}
      <BackupListModal 
        isOpen={isBackupListOpen} 
        onClose={() => setIsBackupListOpen(false)} 
        backups={backups}
        formatSize={formatSize}
        formatDate={formatDate}
        onSelectBackup={handleSelectBackup}
      />

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