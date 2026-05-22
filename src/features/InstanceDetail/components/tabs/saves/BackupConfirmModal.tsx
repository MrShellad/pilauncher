import React, { useState } from 'react';
import { AlertTriangle, HardDrive, FileDiff, Loader2, CheckCircle2 } from 'lucide-react';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../../ui/primitives/OreModal';
import { OreProgressBar } from '../../../../../ui/primitives/OreProgressBar';
import { type SaveBackupProgress } from '../../../logic/saveService';

export interface BackupConfirmModalProps {
  pendingBackupSave: { folderName: string; worldName: string } | null;
  hasFullBackup?: boolean;
  onClose: () => void;
  onConfirm: (mode: 'full' | 'differential') => void;
  isBackingUp?: boolean;
  backupProgress?: SaveBackupProgress | null;
  activeBackupSave?: { folderName: string; worldName: string } | null;
}

export const BackupConfirmModal: React.FC<BackupConfirmModalProps> = ({
  pendingBackupSave,
  hasFullBackup = false,
  onClose,
  onConfirm,
  isBackingUp = false,
  backupProgress = null,
  activeBackupSave = null,
}) => {
  const [mode, setMode] = useState<'full' | 'differential'>(hasFullBackup ? 'differential' : 'full');

  const backupStage = backupProgress?.stage;
  const isDone = backupStage === 'DONE';
  const isError = backupStage === 'ERROR';

  const modalTitle = isBackingUp
    ? (isDone ? '压缩备份已完成' : isError ? '备份任务失败' : '正在压缩世界及配置...')
    : '立即备份确认';

  const activeBackupLabel = activeBackupSave?.worldName || activeBackupSave?.folderName || backupProgress?.folderName || '';
  const backupProgressPercent = backupProgress
    ? Math.round((backupProgress.current / Math.max(backupProgress.total, 1)) * 100)
    : 0;

  const backupStageLabel = (() => {
    switch (backupProgress?.stage) {
      case 'QUEUE': return '等待启动';
      case 'PREPARE': return '准备快照';
      case 'PACK_WORLD': return '压缩世界数据';
      case 'PACK_CONFIGS': return '压缩配置文件';
      case 'FINALIZE': return '写入元数据';
      case 'DONE': return '备份完成';
      case 'ERROR': return '备份失败';
      default: return '处理中';
    }
  })();

  const backupStatusMessage = isDone
    ? `${activeBackupLabel || '当前世界'} 已生成新的压缩快照。`
    : isError ? backupProgress?.message || '备份任务运行中遇到错误。' : backupProgress?.message || '正在准备文件并生成压缩包...';

  return (
    <OreModal
      isOpen={pendingBackupSave !== null || isBackingUp}
      onClose={onClose}
      title={modalTitle}
      hideCloseButton
      className="w-[43rem] max-w-[calc(100vw-2rem)]"
      actions={
        isBackingUp ? (
          <OreButton
            focusKey="save-backup-backingup-status"
            variant="primary"
            disabled
            className="flex-1"
          >
            {isDone ? '完成' : isError ? '失败' : '正在备份中...'}
          </OreButton>
        ) : (
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
        )
      }
    >
      <div className="flex flex-col items-center justify-center p-6 text-center">
        {isBackingUp ? (
          <div className="flex w-full flex-col items-center justify-center space-y-5 py-4">
            <div
              className={`flex h-14 w-14 items-center justify-center border-2 shadow-[inset_0_-4px_rgba(0,0,0,0.25)] rounded-none ${
                isDone
                  ? 'border-ore-green bg-ore-green/10 text-ore-green'
                  : isError
                  ? 'border-red-600 bg-red-600/10 text-red-500'
                  : 'border-[#48494A] bg-[#242526] text-ore-green'
              }`}
            >
              {isDone ? (
                <CheckCircle2 size={28} />
              ) : isError ? (
                <AlertTriangle size={28} />
              ) : (
                <Loader2 size={28} className="animate-spin" />
              )}
            </div>

            <div className="w-full space-y-1">
              <h3 className="font-minecraft text-lg font-bold text-white">
                {isDone ? '压缩备份已完成' : isError ? '备份任务失败' : '正在压缩世界数据'}
              </h3>
              <p className="font-minecraft text-xs text-ore-text-muted">
                目标世界：<span className="font-bold text-white">{activeBackupLabel}</span>
              </p>
            </div>

            <div className="w-full px-2">
              <OreProgressBar
                percent={backupProgressPercent}
                label={backupStageLabel}
              />
            </div>

            <div className="w-full border-2 border-[#1E1E1F] bg-[#18181B] px-4 py-3 text-left text-xs font-minecraft text-[#D0D1D4] shadow-[inset_0_4px_rgba(0,0,0,0.5)] rounded-none max-h-20 overflow-y-auto break-all custom-scrollbar">
              {backupStatusMessage}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3 flex h-14 w-14 items-center justify-center border-2 border-black bg-[#FFE866]/10 text-[#FFE866] shadow-[inset_0_-4px_rgba(255,232,102,0.25)] rounded-none">
              <AlertTriangle size={28} />
            </div>
            <h3 className="font-minecraft text-lg font-bold text-white">确认立即备份这个世界？</h3>
            <p className="max-w-xl px-4 font-minecraft text-xs text-ore-text-muted mt-2">
              目标世界：
              <span className="font-bold text-white"> {pendingBackupSave?.worldName || pendingBackupSave?.folderName}</span>
              。备份时会压缩打包当前存档内容，并一并生成配置文件快照。
            </p>

            <div className="mt-5 flex w-full flex-row space-x-4 px-2">
              <FocusItem focusKey="save-backup-mode-full" onEnter={() => setMode('full')}>
                {({ ref, focused }) => (
                  <button
                    ref={ref}
                    type="button"
                    className={[
                      'flex-1 flex flex-col items-center justify-between text-center pt-4 px-3 pb-5 border-2 transition-none select-none rounded-none outline-none h-44',
                      mode === 'full'
                        ? 'border-black bg-[#3C8527] text-white shadow-[inset_0_-4px_#1D4D13,inset_2px_2px_rgba(255,255,255,0.2),inset_-2px_-2px_rgba(0,0,0,0.2)]'
                        : 'border-black bg-[#48494A] text-[#E6E8EB] shadow-[inset_0_-4px_#313233,inset_2px_2px_rgba(255,255,255,0.1),inset_-2px_-2px_rgba(0,0,0,0.15)] hover:bg-[#525355]',
                      focused ? 'outline-none outline outline-2 outline-white outline-offset-1 z-10 drop-shadow-[0_0_6px_rgba(255,255,255,0.6)] brightness-[1.05]' : '',
                      'active:translate-y-1 active:pb-4 active:shadow-[inset_2px_2px_rgba(0,0,0,0.25)]'
                    ].filter(Boolean).join(' ')}
                    onClick={() => setMode('full')}
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <div className="p-2 border-2 border-black/30 bg-black/20 text-white rounded-none flex items-center justify-center shadow-[inset_2px_2px_rgba(0,0,0,0.3)]">
                        <HardDrive size={24} />
                      </div>
                      <div className="font-minecraft text-sm font-bold uppercase tracking-wide">全量备份</div>
                    </div>
                    <div className={`text-xs leading-relaxed ${mode === 'full' ? 'text-white/80' : 'text-[#B1B2B5]'}`}>
                      完整打包整个世界文件夹及配置文件。
                    </div>
                  </button>
                )}
              </FocusItem>

              <FocusItem focusKey="save-backup-mode-diff" onEnter={() => hasFullBackup && setMode('differential')}>
                {({ ref, focused }) => (
                  <button
                    ref={ref}
                    type="button"
                    disabled={!hasFullBackup}
                    className={[
                      'flex-1 flex flex-col items-center justify-between text-center pt-4 px-3 pb-5 border-2 transition-none select-none rounded-none outline-none h-44',
                      !hasFullBackup
                        ? 'border-[#58585A] bg-[#242526] text-[#8C8D90] opacity-50 shadow-none cursor-not-allowed'
                        : (mode === 'differential'
                            ? 'border-black bg-[#3C8527] text-white shadow-[inset_0_-4px_#1D4D13,inset_2px_2px_rgba(255,255,255,0.2),inset_-2px_-2px_rgba(0,0,0,0.2)]'
                            : 'border-black bg-[#48494A] text-[#E6E8EB] shadow-[inset_0_-4px_#313233,inset_2px_2px_rgba(255,255,255,0.1),inset_-2px_-2px_rgba(0,0,0,0.15)] hover:bg-[#525355]'),
                      focused ? 'outline-none outline outline-2 outline-white outline-offset-1 z-10 drop-shadow-[0_0_6px_rgba(255,255,255,0.6)] brightness-[1.05]' : '',
                      hasFullBackup ? 'active:translate-y-1 active:pb-4 active:shadow-[inset_2px_2px_rgba(0,0,0,0.25)]' : ''
                    ].filter(Boolean).join(' ')}
                    onClick={() => {
                      if (hasFullBackup) setMode('differential');
                    }}
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <div className={`p-2 border-2 border-black/30 bg-black/20 rounded-none flex items-center justify-center shadow-[inset_2px_2px_rgba(0,0,0,0.3)] ${!hasFullBackup ? 'text-[#8C8D90]' : 'text-white'}`}>
                        <FileDiff size={24} />
                      </div>
                      <div className="font-minecraft text-sm font-bold uppercase tracking-wide">差异备份</div>
                    </div>
                    <div className={`text-xs leading-relaxed ${!hasFullBackup ? 'text-[#8C8D90]' : (mode === 'differential' ? 'text-white/80' : 'text-[#B1B2B5]')}`}>
                      {hasFullBackup ? '仅打包上次备份以来的修改文件。' : '无可用全量备份，无法差异备份。'}
                    </div>
                  </button>
                )}
              </FocusItem>
            </div>

            <p className="text-xs text-ore-text-muted px-4 mt-3">
              为了避免拿到不完整数据，建议在游戏退出后再执行。
            </p>
          </>
        )}
      </div>
    </OreModal>
  );
};

