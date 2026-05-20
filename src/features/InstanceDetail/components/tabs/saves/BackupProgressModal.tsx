import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { OreModal } from '../../../../../ui/primitives/OreModal';
import { type SaveBackupProgress } from '../../../logic/saveService';

export interface BackupProgressModalProps {
  isBackupProgressOpen: boolean;
  activeBackupSave: { folderName: string; worldName: string } | null;
  backupProgress: SaveBackupProgress | null;
}

export const BackupProgressModal: React.FC<BackupProgressModalProps> = ({
  isBackupProgressOpen,
  activeBackupSave,
  backupProgress,
}) => {
  const backupProgressPercent = backupProgress
    ? Math.round((backupProgress.current / Math.max(backupProgress.total, 1)) * 100)
    : 0;
  const activeBackupLabel = activeBackupSave?.worldName || activeBackupSave?.folderName || backupProgress?.folderName || '';

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

  const backupStatusTitle = backupProgress?.stage === 'DONE'
    ? '压缩备份已完成'
    : backupProgress?.stage === 'ERROR' ? '备份任务失败' : '正在压缩存档备份';

  const backupStatusMessage = backupProgress?.stage === 'DONE'
    ? `${activeBackupLabel || '当前世界'} 已生成新的压缩快照。`
    : backupProgress?.stage === 'ERROR' ? backupProgress.message : backupProgress?.message || '正在准备文件并生成压缩包...';

  return (
    <OreModal
      isOpen={isBackupProgressOpen}
      onClose={() => {}}
      title={backupStatusTitle}
      hideCloseButton={true}
      closeOnOutsideClick={false}
      className="w-[42rem] max-w-[calc(100vw-2rem)]"
    >
      <div className="flex min-h-[21rem] flex-col items-center justify-center space-y-7 p-8 text-center">
        <div
          className={`flex h-20 w-20 items-center justify-center rounded-full border-[3px] shadow-[inset_0_0_18px_rgba(255,255,255,0.08)] ${
            backupProgress?.stage === 'DONE'
              ? 'border-ore-green/40 bg-ore-green/10 text-ore-green'
              : 'border-[#2A2A2C] bg-[#18181B] text-ore-green'
          }`}
        >
          {backupProgress?.stage === 'DONE' ? (
            <CheckCircle2 size={40} />
          ) : (
            <Loader2 size={40} className="animate-spin" />
          )}
        </div>

        <div className="w-full max-w-xl space-y-2">
          <h3 className="font-minecraft text-2xl font-bold tracking-widest text-white">{backupStatusTitle}</h3>
          <p className="text-sm text-ore-text-muted">
            {activeBackupLabel ? `${activeBackupLabel} · ${backupStageLabel}` : backupStageLabel}
          </p>
        </div>

        <div className="w-full max-w-xl space-y-4">
          <div className="overflow-hidden rounded-full border-2 border-[#2A2A2C] bg-[#141415] shadow-inner">
            <div
              className="h-4 bg-[length:20px_20px] bg-[linear-gradient(45deg,rgba(255,255,255,.14)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.14)_50%,rgba(255,255,255,.14)_75%,transparent_75%,transparent)] bg-[#3C8527] shadow-[inset_0_2px_rgba(255,255,255,0.3),inset_0_-2px_rgba(0,0,0,0.2)] transition-[width] duration-200"
              style={{ width: `${backupProgressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.18em] text-[#A1A3A5]">
            <span>{backupStageLabel}</span>
            <span className="text-ore-green">{backupProgressPercent}%</span>
          </div>

          <div className="rounded-sm border border-[#2A2A2C] bg-[#18181B] px-4 py-3 text-left text-sm text-[#D0D1D4] shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
            {backupStatusMessage}
          </div>
        </div>
      </div>
    </OreModal>
  );
};
