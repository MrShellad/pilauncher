// /src/features/InstanceDetail/components/tabs/SavePanel.tsx
import React, { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation'; // ✅ 引入 setFocus

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { OreList } from '../../../../ui/primitives/OreList';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { FocusItem } from '../../../../ui/focus/FocusItem'; // ✅ 引入 FocusItem 保险杠
import { Globe, FolderOpen, Archive, Trash2, Loader2, HardDrive, History } from 'lucide-react';

import { useSaveManager } from '../../hooks/useSaveManager';
import { saveService } from '../../logic/saveService'; 
import { OreModal } from '../../../../ui/primitives/OreModal'; // ✅ 引入 OreModal
import { SaveRestoreModal } from './saves/SaveRestoreModal';
import { BackupListModal } from './saves/BackupListModal';
import type { SaveBackupMetadata } from '../../logic/saveService';

export const SavePanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const { saves, backups, isLoading, isBackingUp, backupSave, deleteSave, formatSize, formatDate } = useSaveManager(instanceId);
  
  const [isBackupListOpen, setIsBackupListOpen] = useState(false);
  const [verifyingBackup, setVerifyingBackup] = useState<SaveBackupMetadata | null>(null);
  const [saveToDelete, setSaveToDelete] = useState<string | null>(null);

  const handleSelectBackup = (backup: SaveBackupMetadata) => {
    setIsBackupListOpen(false);
    setVerifyingBackup(backup); 
  };

  const handleOpenFolder = async () => {
    try {
      await saveService.openSavesFolder(instanceId);
    } catch (error) {
      console.error('打开存档目录失败:', error);
    }
  };

  return (
    <SettingsPageLayout title="存档管理" subtitle="Worlds & Backups">
      <div className="relative flex flex-col w-full h-full">

        {/* ======================================================== */}
        {/* ✅ 焦点保险杠 (Focus Bumpers)：物理封锁，弹回恢复中心按钮！*/}
        {/* ======================================================== */}
        <FocusItem focusKey="save-guard-top" onFocus={() => setFocus('save-btn-history')}>
          {({ ref }) => <div ref={ref as any} className="absolute top-0 left-0 w-full h-[1px] opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey="save-guard-left" onFocus={() => setFocus('save-btn-history')}>
          {({ ref }) => <div ref={ref as any} className="absolute top-0 left-0 w-[1px] h-full opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey="save-guard-right" onFocus={() => setFocus('save-btn-history')}>
          {({ ref }) => <div ref={ref as any} className="absolute top-0 right-0 w-[1px] h-full opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey="save-guard-bottom" onFocus={() => setFocus('save-btn-history')}>
          {({ ref }) => <div ref={ref as any} className="absolute bottom-0 left-0 w-full h-[1px] opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>

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
                focusable={false} 
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
                      onClick={() => setSaveToDelete(save.folderName)}
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

        {/* 删除存档确认弹窗 */}
        <OreModal
          isOpen={saveToDelete !== null}
          onClose={() => setSaveToDelete(null)}
          title="删除存档确认"
          actions={
            <>
              <OreButton
                focusKey="save-del-cancel"
                variant="secondary"
                onClick={() => setSaveToDelete(null)}
                className="flex-1"
              >
                移入回收站
              </OreButton>
              <OreButton
                focusKey="save-del-confirm"
                variant="danger"
                onClick={() => {
                  if (saveToDelete) {
                    deleteSave(saveToDelete, true);
                    setSaveToDelete(null);
                  }
                }}
                className="flex-1"
              >
                强制彻底删除
              </OreButton>
            </>
          }
        >
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2 border-2 border-red-500/20 shadow-[inset_0_0_15px_rgba(239,68,68,0.2)]">
               <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-white font-minecraft">确认删除此存档？</h3>
            <p className="text-ore-text-muted font-minecraft px-4">
              您即将操作存档 <span className="text-red-400 font-bold">"{saveToDelete}"</span>。<br />
              您可以选择将其<strong>移入回收站</strong>（保留7天），或选择<strong>强制彻底删除</strong>（无法恢复）。
            </p>
          </div>
        </OreModal>
        
      </div>
    </SettingsPageLayout>
  );
};