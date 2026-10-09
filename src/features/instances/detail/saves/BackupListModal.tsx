import React, { useMemo } from 'react';
import {
  Archive,
  Clock3,
  Cloud,
  CloudOff,
  FolderArchive,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
  HardDrive,
  FileDiff,
} from 'lucide-react';

import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';

import type { SaveBackupMetadata } from '../logic/saveService';

import { getBackupActionFocusKey } from './useSavePanel';

interface BackupListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  backups: SaveBackupMetadata[];
  formatSize: (bytes: number) => string;
  formatDate: (timestamp: number) => string;
  deletingBackupId?: string | null;
  isBusy?: boolean;
  webDavBackupEnabled?: boolean;
  onToggleWebDavBackup?: () => void;
  onSelectBackup: (backup: SaveBackupMetadata) => void;
  onDeleteBackup: (backup: SaveBackupMetadata, focusKey: string) => void;
  isUploadingWebDav?: boolean;
  onUploadWebDav?: () => void;
  exitBackupEnabled?: boolean;
  onToggleExitBackup?: (enabled: boolean) => void;
  backupAllWorldsOnExit?: boolean;
  onToggleBackupAllWorlds?: (enabled: boolean) => void;
  isGlobal?: boolean;
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
  webDavBackupEnabled,
  onToggleWebDavBackup,
  onSelectBackup,
  onDeleteBackup,
  isUploadingWebDav = false,
  onUploadWebDav,
  exitBackupEnabled,
  onToggleExitBackup,
  backupAllWorldsOnExit,
  onToggleBackupAllWorlds,
  isGlobal = false,
}) => {
  const focusOrder = useMemo(
    () => {
      const headerActions: string[] = [];
      if (!isGlobal && onToggleExitBackup) {
        headerActions.push('backup-list-exit-backup-switch');
      }
      if (isGlobal && onToggleBackupAllWorlds && exitBackupEnabled) {
        headerActions.push('backup-list-all-worlds-switch');
      }
      if (onToggleWebDavBackup) {
        headerActions.push('backup-list-webdav-toggle');
      }
      if (onUploadWebDav) {
        headerActions.push('backup-list-webdav-upload');
      }
      return backups.length > 0
        ? [
            ...headerActions,
            ...backups.flatMap((backup) => [
            getBackupActionFocusKey(backup.backupId, 'restore'),
            getBackupActionFocusKey(backup.backupId, 'delete'),
          ]),
          ]
        : [...headerActions, 'backup-list-empty-close'];
    },
    [backups, isGlobal, onToggleExitBackup, onToggleBackupAllWorlds, exitBackupEnabled, onToggleWebDavBackup, onUploadWebDav]
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
          {backups.length > 0 && (
            <p className="ore-backup-list-modal__hero-text">
              共找到 {backups.length} 个压缩快照，可直接恢复或移除不再需要的备份。
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3 shrink-0 ml-auto justify-end">
          {!isGlobal && onToggleExitBackup && (
            <OreSwitch
              focusKey="backup-list-exit-backup-switch"
              checked={!!exitBackupEnabled}
              onChange={onToggleExitBackup}
              label="退出游戏自动备份"
              disabled={isBusy}
              onArrowPress={handleLinearArrow}
            />
          )}

          {isGlobal && onToggleBackupAllWorlds && (
            <OreSwitch
              focusKey="backup-list-all-worlds-switch"
              checked={!!backupAllWorldsOnExit}
              onChange={onToggleBackupAllWorlds}
              label="备份所有世界 (全局)"
              disabled={isBusy || !exitBackupEnabled}
              onArrowPress={handleLinearArrow}
            />
          )}

          {onToggleWebDavBackup && (
            <OreButton
              focusKey="backup-list-webdav-toggle"
              variant={webDavBackupEnabled ? 'secondary' : 'danger'}
              size="auto"
              onArrowPress={handleLinearArrow}
              onClick={onToggleWebDavBackup}
              disabled={isBusy}
              className="!h-10 !min-h-10 shrink-0"
            >
              {webDavBackupEnabled ? (
                <Cloud size={16} className="mr-2" />
              ) : (
                <CloudOff size={16} className="mr-2" />
              )}
              {webDavBackupEnabled ? '已纳入 WebDAV' : '纳入 WebDAV'}
            </OreButton>
          )}

          {onUploadWebDav && (
            <OreButton
              focusKey="backup-list-webdav-upload"
              variant="secondary"
              size="auto"
              onArrowPress={handleLinearArrow}
              onClick={onUploadWebDav}
              disabled={isBusy || isUploadingWebDav}
              className="!h-10 !min-h-10 shrink-0"
            >
              {isUploadingWebDav ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <Cloud size={16} className="mr-2" />
              )}
              手动上传备份
            </OreButton>
          )}
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
              const hasDependents =
                backup.backupMode === 'full' &&
                backups.some(
                  (b) => b.backupMode === 'differential' && b.baseBackupId === backup.backupId
                );

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
                        
                        {backup.backupMode === 'differential' ? (
                          <span className="ore-backup-list-modal__tag" style={{ borderColor: '#74c0fc', color: '#74c0fc', backgroundColor: 'rgba(116, 192, 252, 0.1)' }}>
                            <FileDiff size={12} className="mr-1 inline-block" />
                            差异备份
                          </span>
                        ) : (
                          <span className="ore-backup-list-modal__tag" style={{ borderColor: 'var(--ore-green)', color: 'var(--ore-green)', backgroundColor: 'rgba(85,255,100,0.1)' }}>
                            <HardDrive size={12} className="mr-1 inline-block" />
                            完整备份
                          </span>
                        )}

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
                        {hasDependents && (
                          <span className="ore-backup-list-modal__tag font-semibold" style={{ borderColor: 'var(--ore-danger, #ff6b6b)', color: 'var(--ore-danger, #ff6b6b)', backgroundColor: 'rgba(255, 107, 107, 0.1)' }}>
                            有差异备份依赖此备份 (无法直接删除)
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
                      disabled={isBusy || isDeleting || hasDependents}
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
