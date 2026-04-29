import React from 'react';
import {
  DownloadCloud,
  FolderOpen,
  History,
  Loader2,
  RefreshCw,
  Wand2
} from 'lucide-react';

import { OreButton } from '../../../../../ui/primitives/OreButton';

export interface ModPanelTopBarProps {
  isCollapsed?: boolean;
  snapshotState: 'idle' | 'snapshotting' | 'rolling_back';
  snapshotProgressPhase: string | null;
  onArrowPress: (direction: string) => boolean;
  onCreateSnapshot: () => void | Promise<void>;
  onOpenHistory: () => void | Promise<void>;
  onOpenModFolder: () => void | Promise<void>;
  onAnalyzeCleanup: () => void;
  onCheckModUpdates: () => void;
  onOpenDownload: () => void;
  isCheckingModUpdates: boolean;
}

export const ModPanelTopBar: React.FC<ModPanelTopBarProps> = ({
  isCollapsed = false,
  snapshotState,
  snapshotProgressPhase,
  onArrowPress,
  onCreateSnapshot,
  onOpenHistory,
  onOpenModFolder,
  onAnalyzeCleanup,
  onCheckModUpdates,
  onOpenDownload,
  isCheckingModUpdates
}) => {
  const snapshotLabel = snapshotState === 'snapshotting'
    ? (snapshotProgressPhase || '创建中...')
    : '创建快照';

  if (isCollapsed) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center justify-between border border-[#2A3140] bg-[#161A22] p-4">
      <div>
        <h3 className="flex items-center font-minecraft text-white">
          <History size={18} className="mr-2 text-[#7AA2FF]" />
          模组快照
        </h3>
      </div>

      <div className="flex items-center gap-3">
        <OreButton
          focusKey="mod-btn-snapshot"
          variant="primary"
          size="auto"
          disabled={snapshotState !== 'idle'}
          onClick={onCreateSnapshot}
          onArrowPress={onArrowPress}
          className="!h-10 !min-h-10"
        >
          {snapshotState === 'snapshotting' ? (
            <Loader2 className="mr-2 animate-spin" size={16} />
          ) : (
            <History size={16} className="mr-2" />
          )}
          {snapshotLabel}
        </OreButton>

        <OreButton
          focusKey="mod-btn-history"
          size="auto"
          variant="secondary"
          onClick={onOpenHistory}
          onArrowPress={onArrowPress}
          className="!h-10 !min-h-10"
        >
          <RefreshCw size={16} className="mr-2" />
          历史快照
        </OreButton>

        <div className="mx-1 h-6 w-px bg-white/15" />

        <OreButton
          focusKey="mod-btn-folder"
          variant="secondary"
          size="auto"
          onClick={onOpenModFolder}
          onArrowPress={onArrowPress}
          className="!h-10 !min-h-10"
        >
          <FolderOpen size={16} className="mr-2" />
          打开文件夹
        </OreButton>

        <div className="mx-1 h-6 w-px bg-white/15" />

        <OreButton
          focusKey="mod-btn-cleanup"
          variant="secondary"
          size="auto"
          onClick={onAnalyzeCleanup}
          onArrowPress={onArrowPress}
          className="!h-10 !min-h-10"
        >
          <Wand2 size={16} className="mr-2" />
          清理名称
        </OreButton>

        <OreButton
          focusKey="mod-btn-check-updates"
          variant="secondary"
          size="auto"
          disabled={isCheckingModUpdates}
          onClick={onCheckModUpdates}
          onArrowPress={onArrowPress}
          className="!h-10 !min-h-10"
        >
          <RefreshCw size={16} className={`mr-2 ${isCheckingModUpdates ? 'animate-spin' : ''}`} />
          {isCheckingModUpdates ? '检查中...' : '检查更新'}
        </OreButton>

        <OreButton
          focusKey="mod-btn-download"
          variant="primary"
          size="auto"
          onClick={onOpenDownload}
          onArrowPress={onArrowPress}
          className="!h-10 !min-h-10"
        >
          <DownloadCloud size={16} className="mr-2" />
          下载 MOD
        </OreButton>
      </div>
    </div>
  );
};
