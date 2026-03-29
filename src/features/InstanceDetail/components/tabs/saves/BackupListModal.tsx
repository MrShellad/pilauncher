import React, { useMemo } from 'react';
import {
  Archive,
  Clock3,
  FolderArchive,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import '../../../../../style/ui/primitives/BackupListModal.css';
import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import { useLinearNavigation } from '../../../../../ui/focus/useLinearNavigation';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../../ui/primitives/OreModal';

import type { SaveBackupMetadata } from '../../../logic/saveService';

type BackupRowAction = 'restore' | 'delete';

export const getBackupActionFocusKey = (backupId: string, action: BackupRowAction) =>
  `backup-list-${action}-${backupId}`;

interface BackupListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  backups: SaveBackupMetadata[];
  formatSize: (bytes: number) => string;
  formatDate: (timestamp: number) => string;
  deletingBackupId?: string | null;
  isBusy?: boolean;
  onSelectBackup: (backup: SaveBackupMetadata) => void;
  onDeleteBackup: (backup: SaveBackupMetadata, focusKey: string) => void;
}

const formatTrigger = (trigger: string) => {
  switch (trigger) {
    case 'manual':
      return '手动备份';
    case 'auto_exit':
      return '退出备份';
    case 'auto_interval':
      return '定时备份';
    case 'restore_guard':
      return '恢复前保护';
    default:
      return trigger || '未知来源';
  }
};

export const BackupListModal: React.FC<BackupListModalProps> = ({
  isOpen,
  onClose,
  title,
  backups,
  formatSize,
  formatDate,
  deletingBackupId,
  isBusy = false,
  onSelectBackup,
  onDeleteBackup,
}) => {
  const focusOrder = useMemo(
    () =>
      backups.length > 0
        ? backups.flatMap((backup) => [
            getBackupActionFocusKey(backup.backupId, 'restore'),
            getBackupActionFocusKey(backup.backupId, 'delete'),
          ])
        : ['backup-list-empty-close'],
    [backups]
  );
  const defaultFocusKey = focusOrder[0];
  const { handleLinearArrow } = useLinearNavigation(
    focusOrder,
    defaultFocusKey,
    false,
    isOpen
  );

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      className="ore-backup-list-modal"
      contentClassName="ore-backup-list-modal__content"
      defaultFocusKey={defaultFocusKey}
    >
      <div className="ore-backup-list-modal__hero">
        <div className="ore-backup-list-modal__hero-icon">
          <Archive size={28} />
        </div>
        <div className="min-w-0">
          <h3 className="ore-backup-list-modal__hero-title font-minecraft">{title}</h3>
          <p className="ore-backup-list-modal__hero-text">
            {backups.length > 0
              ? `共找到 ${backups.length} 个压缩快照，可直接恢复或移除不再需要的备份。`
              : '这里会展示当前实例的压缩备份记录，包括世界快照、配置快照和环境信息。'}
          </p>
        </div>
      </div>

      <FocusBoundary
        id="backup-list-boundary"
        className="flex min-h-0 flex-1 flex-col"
        defaultFocusKey={defaultFocusKey}
      >
        {backups.length === 0 ? (
          <div className="ore-backup-list-modal__empty">
            <Archive size={56} className="ore-backup-list-modal__empty-icon" />
            <p className="ore-backup-list-modal__empty-title font-minecraft">还没有备份记录</p>
            <p className="ore-backup-list-modal__empty-text">
              在存档页执行一次备份后，这里就会出现可恢复的压缩快照。
            </p>
            <OreButton
              focusKey="backup-list-empty-close"
              variant="secondary"
              size="auto"
              onArrowPress={handleLinearArrow}
              onClick={onClose}
              className="ore-backup-list-modal__empty-button"
            >
              关闭
            </OreButton>
          </div>
        ) : (
          <div className="ore-backup-list-modal__body custom-scrollbar">
            {backups.map((backup) => {
              const loaderLabel =
                [backup.game.loader, backup.game.loaderVersion].filter(Boolean).join(' ').trim() ||
                '未知 Loader';
              const isDeleting = deletingBackupId === backup.backupId;

              return (
                <article key={backup.backupId} className="ore-backup-list-modal__card">
                  <div className="ore-backup-list-modal__card-main">
                    <div className="ore-backup-list-modal__card-icon">
                      <FolderArchive size={24} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="ore-backup-list-modal__card-header">
                        <span className="ore-backup-list-modal__card-title font-minecraft">
                          {backup.world.name}
                        </span>
                        <span className="ore-backup-list-modal__tag">
                          {formatTrigger(backup.trigger)}
                        </span>
                        {backup.hasConfigs && (
                          <span className="ore-backup-list-modal__tag ore-backup-list-modal__tag--accent">
                            含配置快照
                          </span>
                        )}
                        {backup.state.safeBackup && (
                          <span className="ore-backup-list-modal__tag ore-backup-list-modal__tag--safe">
                            <ShieldCheck size={13} />
                            安全快照
                          </span>
                        )}
                      </div>

                      <div className="ore-backup-list-modal__meta-row">
                        <span className="ore-backup-list-modal__time">
                          <Clock3 size={14} />
                          {formatDate(backup.createdAt)}
                        </span>
                        <span>{formatSize(backup.files.totalSize)}</span>
                        <span>{backup.environment.modCount} 个 Mod</span>
                        <span>{backup.game.mcVersion}</span>
                        <span>{loaderLabel}</span>
                      </div>

                      <div className="ore-backup-list-modal__pill-row">
                        <span className="ore-backup-list-modal__pill">
                          世界数据 {formatSize(backup.files.worldSize)}
                        </span>
                        <span className="ore-backup-list-modal__pill">
                          配置数据 {formatSize(backup.files.configSize)}
                        </span>
                        <span className="ore-backup-list-modal__pill">
                          目录 {backup.world.folderName}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="ore-backup-list-modal__card-actions">
                    <OreButton
                      focusKey={getBackupActionFocusKey(backup.backupId, 'restore')}
                      variant="primary"
                      size="auto"
                      className="ore-backup-list-modal__action-button"
                      onArrowPress={handleLinearArrow}
                      onClick={() => onSelectBackup(backup)}
                      disabled={isBusy}
                    >
                      <RotateCcw size={16} className="mr-2" />
                      恢复
                    </OreButton>

                    <OreButton
                      focusKey={getBackupActionFocusKey(backup.backupId, 'delete')}
                      variant="danger"
                      size="auto"
                      className="ore-backup-list-modal__action-button"
                      onArrowPress={handleLinearArrow}
                      onClick={() =>
                        onDeleteBackup(
                          backup,
                          getBackupActionFocusKey(backup.backupId, 'delete')
                        )
                      }
                      disabled={isBusy || isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 size={16} className="mr-2 animate-spin" />
                      ) : (
                        <Trash2 size={16} className="mr-2" />
                      )}
                      删除备份
                    </OreButton>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </FocusBoundary>
    </OreModal>
  );
};
