import React, { useState, useEffect } from 'react';
import { AlertTriangle, HardDrive, FileDiff } from 'lucide-react';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../../ui/primitives/OreModal';

export interface BackupConfirmModalProps {
  pendingBackupSave: { folderName: string; worldName: string } | null;
  hasFullBackup?: boolean;
  onClose: () => void;
  onConfirm: (mode: 'full' | 'differential') => void;
}

export const BackupConfirmModal: React.FC<BackupConfirmModalProps> = ({
  pendingBackupSave,
  hasFullBackup = false,
  onClose,
  onConfirm,
}) => {
  const [mode, setMode] = useState<'full' | 'differential'>('full');

  useEffect(() => {
    if (pendingBackupSave !== null) {
      setMode(hasFullBackup ? 'differential' : 'full');
    }
  }, [pendingBackupSave, hasFullBackup]);

  return (
    <OreModal
      isOpen={pendingBackupSave !== null}
      onClose={onClose}
      title="立即备份确认"
      hideCloseButton
      actions={
        <>
          <OreButton
            focusKey="save-backup-cancel"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            取消
          </OreButton>
          <OreButton
            focusKey="save-backup-confirm"
            variant="primary"
            onClick={() => onConfirm(mode)}
            className="flex-1"
          >
            立即开始
          </OreButton>
        </>
      }
    >
      <div className="flex flex-col items-center justify-center space-y-4 p-6 text-center">
        <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#FFE866]/25 bg-[#FFE866]/10 text-[#FFE866] shadow-[inset_0_0_15px_rgba(255,232,102,0.16)]">
          <AlertTriangle size={32} />
        </div>
        <h3 className="font-minecraft text-xl font-bold text-white">确认立即备份这个世界？</h3>
        <p className="max-w-xl px-4 font-minecraft text-ore-text-muted">
          目标世界：
          <span className="font-bold text-white"> {pendingBackupSave?.worldName || pendingBackupSave?.folderName}</span>
          。备份时会压缩打包当前存档内容，并一并生成配置文件快照。
        </p>

        <div className="mt-4 flex w-full max-w-md flex-col space-y-2">
          <FocusItem focusKey="save-backup-mode-full" onEnter={() => setMode('full')}>
            {({ ref, focused }) => (
              <button
                ref={ref}
                className={[
                  'flex items-center space-x-3 rounded p-4 text-left border-2 transition-colors',
                  mode === 'full' ? 'border-ore-green bg-ore-green/10 text-white' : 'border-transparent bg-white/5 text-ore-text-muted hover:bg-white/10',
                  focused ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent outline-none' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => setMode('full')}
              >
                <HardDrive size={24} className={mode === 'full' ? 'text-ore-green' : ''} />
                <div className="flex-1">
                  <div className="font-minecraft font-bold">全量备份</div>
                  <div className="text-xs mt-1">完整打包世界文件夹和配置文件。</div>
                </div>
              </button>
            )}
          </FocusItem>
          
          <FocusItem focusKey="save-backup-mode-diff" onEnter={() => hasFullBackup && setMode('differential')}>
            {({ ref, focused }) => (
              <button
                ref={ref}
                className={[
                  'flex items-center space-x-3 rounded p-4 text-left border-2 transition-colors',
                  !hasFullBackup && 'opacity-50 cursor-not-allowed',
                  mode === 'differential' && hasFullBackup ? 'border-ore-green bg-ore-green/10 text-white' : (hasFullBackup ? 'border-transparent bg-white/5 text-ore-text-muted hover:bg-white/10' : 'border-transparent bg-transparent text-ore-text-muted'),
                  focused ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent outline-none' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => {
                  if (hasFullBackup) setMode('differential');
                }}
                disabled={!hasFullBackup}
              >
                <FileDiff size={24} className={mode === 'differential' ? 'text-ore-green' : ''} />
                <div className="flex-1">
                  <div className="font-minecraft font-bold">差异备份</div>
                  <div className="text-xs mt-1">
                    {hasFullBackup ? '仅打包自上次全量备份以来修改过的文件，节省空间。' : '暂无全量备份可用，无法进行差异备份。'}
                  </div>
                </div>
              </button>
            )}
          </FocusItem>
        </div>
        
        <p className="text-xs text-ore-text-muted px-4 mt-2 mb-2">
          为了避免拿到不完整数据，建议在游戏退出后再执行。
        </p>
      </div>
    </OreModal>
  );
};
