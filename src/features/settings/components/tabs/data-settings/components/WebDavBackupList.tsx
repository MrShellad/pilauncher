import { Clock, Download, FileArchive, Loader2, Trash2 } from 'lucide-react';

import type { WebDavRemoteSaveBackup } from '../../../../../../types/webdav';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import {
  formatWebDavBackupDate,
  formatWebDavBackupLoader,
  formatWebDavBackupSize,
} from './webDavManagePresentation';
import type { WebDavArrowHandler } from './webDavManageTypes';

interface WebDavBackupListProps {
  backups: WebDavRemoteSaveBackup[];
  isLoading: boolean;
  busyBackupId: string | null;
  onDownload: (backup: WebDavRemoteSaveBackup) => void;
  onDelete: (backup: WebDavRemoteSaveBackup) => void;
  onArrowPress: WebDavArrowHandler;
}

export const WebDavBackupList = ({
  backups,
  isLoading,
  busyBackupId,
  onDownload,
  onDelete,
  onArrowPress,
}: WebDavBackupListProps) => {
  if (isLoading && backups.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-ore-green">
        <Loader2 size={32} className="animate-spin" />
      </div>
    );
  }

  if (backups.length === 0) {
    return (
      <div className="border-2 border-[#1E1E1F] bg-[#242526] p-6 text-center text-sm text-[#B1B2B5]">
        未找到 WebDAV 存档备份。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 relative">
      {isLoading && (
        <div className="absolute inset-0 bg-[#242526]/50 flex items-center justify-center z-10">
          <Loader2 size={24} className="animate-spin text-ore-green" />
        </div>
      )}
      {backups.map((backup) => {
        const busy = busyBackupId === backup.backupId;
        return (
          <div
            key={backup.backupId}
            className="flex items-center justify-between border-2 border-[#1E1E1F] bg-[#242526] p-3 transition-colors hover:border-ore-green/30"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[#1E1E1F] bg-black/20 text-[#5DADEC]">
                <FileArchive size={20} />
              </div>
              <div className="min-w-0">
                <div className="truncate font-minecraft text-sm font-bold text-white">
                  {backup.metadata.world.name || backup.metadata.world.folderName}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#B1B2B5]">
                  <span>{backup.metadata.backupMode}</span>
                  <span>{backup.metadata.game.mcVersion}</span>
                  <span>{formatWebDavBackupLoader(backup)}</span>
                  <span>{formatWebDavBackupSize(backup.totalSize || backup.metadata.files.totalSize)}</span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatWebDavBackupDate(backup.metadata.createdAt)}
                  </span>
                </div>
                <div className="mt-1 truncate text-[11px] text-[#8E8F93]">
                  {backup.remotePrefix}
                </div>
              </div>
            </div>

            <div className="ml-4 flex shrink-0 items-center gap-2">
              <OreButton
                variant="primary"
                size="sm"
                onClick={() => onDownload(backup)}
                focusKey={`webdav-manage-download-${backup.backupId}`}
                onArrowPress={onArrowPress}
                disabled={!!busyBackupId}
              >
                {busy ? (
                  <Loader2 size={14} className="mr-1 animate-spin" />
                ) : (
                  <Download size={14} className="mr-1" />
                )}
                下载
              </OreButton>
              <OreButton
                variant="danger"
                size="sm"
                onClick={() => onDelete(backup)}
                focusKey={`webdav-manage-delete-${backup.backupId}`}
                onArrowPress={onArrowPress}
                disabled={!!busyBackupId}
              >
                <Trash2 size={14} className="mr-1" />
                删除
              </OreButton>
            </div>
          </div>
        );
      })}
    </div>
  );
};
