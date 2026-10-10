import type React from 'react';
import { CheckCircle2, Download, HardDrive, Loader2, RotateCcw } from 'lucide-react';

import type { WebDavRemoteSaveBackup } from '../../../../../../types/webdav';
import { FocusItem } from '../../../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../../../ui/primitives/OreDropdown';
import { OreToggleButton } from '../../../../../../ui/primitives/OreToggleButton';
import type { DownloadMode, WebDavArrowHandler } from './webDavManageTypes';

interface WebDavDownloadPanelProps {
  backup: WebDavRemoteSaveBackup;
  instanceOptions: Array<{ label: string; value: string }>;
  targetInstanceId: string;
  downloadMode: DownloadMode;
  restoreConfigs: boolean;
  busyBackupId: string | null;
  onTargetInstanceChange: (instanceId: string) => void;
  onDownloadModeChange: (mode: DownloadMode) => void;
  onRestoreConfigsChange: (restoreConfigs: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onArrowPress: WebDavArrowHandler;
}

export const WebDavDownloadPanel = ({
  backup,
  instanceOptions,
  targetInstanceId,
  downloadMode,
  restoreConfigs,
  busyBackupId,
  onTargetInstanceChange,
  onDownloadModeChange,
  onRestoreConfigsChange,
  onConfirm,
  onCancel,
  onArrowPress,
}: WebDavDownloadPanelProps) => (
  <div className="border-2 border-[#1E1E1F] bg-[#18181B] p-3">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-minecraft text-sm text-white">下载目标</div>
        <div className="truncate text-xs text-[#B1B2B5]">
          {backup.metadata.world.name || backup.metadata.world.folderName}
        </div>
      </div>
    </div>

    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <div className="mb-1 text-xs text-[#B1B2B5]">目标实例</div>
        <OreDropdown
          options={instanceOptions}
          value={targetInstanceId}
          onChange={onTargetInstanceChange}
          placeholder="选择实例"
          focusKey="webdav-manage-target-instance"
          onArrowPress={onArrowPress}
          disabled={instanceOptions.length === 0 || !!busyBackupId}
          portal
          panelWidth="trigger"
        />
      </div>

      <div>
        <div className="mb-1 text-xs text-[#B1B2B5]">下载模式</div>
        <OreToggleButton
          options={[
            {
              value: 'local',
              label: (
                <div className="flex items-center gap-2 justify-center">
                  <HardDrive size={14} />
                  <span>仅下载</span>
                </div>
              ),
            },
            {
              value: 'restore',
              label: (
                <div className="flex items-center gap-2 justify-center">
                  <RotateCcw size={14} />
                  <span>立即恢复</span>
                </div>
              ),
            },
          ]}
          value={downloadMode}
          onChange={(value) => onDownloadModeChange(value as DownloadMode)}
          focusKeyPrefix="webdav-manage-mode"
          onArrowPress={onArrowPress}
          size="sm"
          disabled={!!busyBackupId}
        />
      </div>
    </div>

    {downloadMode === 'restore' && (
      <div className="mt-3">
        <RadioButton
          focusKey="webdav-manage-restore-configs"
          checked={restoreConfigs}
          label="同时恢复配置"
          icon={<CheckCircle2 size={14} />}
          onClick={() => onRestoreConfigsChange(!restoreConfigs)}
          onArrowPress={onArrowPress}
        />
      </div>
    )}

    <div className="mt-3 flex justify-end gap-2">
      <OreButton
        variant="primary"
        size="sm"
        focusKey="webdav-manage-confirm-download"
        onArrowPress={onArrowPress}
        onClick={onConfirm}
        disabled={!targetInstanceId || !!busyBackupId}
      >
        {busyBackupId === backup.backupId ? (
          <Loader2 size={14} className="mr-1 animate-spin" />
        ) : (
          <Download size={14} className="mr-1" />
        )}
        确认
      </OreButton>
      <OreButton
        variant="secondary"
        size="sm"
        focusKey="webdav-manage-cancel-download"
        onArrowPress={onArrowPress}
        onClick={onCancel}
        disabled={!!busyBackupId}
      >
        取消
      </OreButton>
    </div>
  </div>
);

interface RadioButtonProps {
  focusKey: string;
  checked: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  onArrowPress: WebDavArrowHandler;
}

const RadioButton = ({
  focusKey,
  checked,
  label,
  icon,
  onClick,
  onArrowPress,
}: RadioButtonProps) => (
  <FocusItem focusKey={focusKey} onEnter={onClick} onArrowPress={onArrowPress}>
    {({ ref, focused }) => (
      <button
        ref={ref as React.RefObject<HTMLButtonElement>}
        type="button"
        onClick={onClick}
        className={`flex h-10 items-center gap-2 border-2 px-3 text-left text-xs transition-colors outline-none focus:outline-none ${
          checked
            ? 'border-ore-green bg-ore-green/15 text-white active:bg-ore-green/15'
            : 'border-[#2A2A2C] bg-[#242526] text-[#B1B2B5] active:bg-[#242526]'
        } ${focused ? 'ring-2 ring-white' : ''}`}
      >
        <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${checked ? 'border-ore-green' : 'border-[#777]'}`}>
          {checked && <span className="h-2 w-2 rounded-full bg-ore-green" />}
        </span>
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </button>
    )}
  </FocusItem>
);
