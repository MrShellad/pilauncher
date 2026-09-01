import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AlertCircle, ArrowDownCircle, ArrowUpCircle, Check, Clock3, Download, History, RotateCcw } from 'lucide-react';

import { OreButton } from '../../../../../../../../ui/primitives/OreButton';
import { OreSegmentedControl } from '../../../../../../../../ui/primitives/OreSegmentedControl';
import { OreOverlayScrollArea } from '../../../../../../../../ui/primitives/OreOverlayScrollArea';
import { FocusItem } from '../../../../../../../../ui/focus/FocusItem';
import {
  type ModMeta,
  type ModPlatformId,
  type ModVersionInstallAction
} from '../../../../../../logic/modService';
import { type OreProjectVersion } from '../../../../../../logic/modrinthApi';
import { getPlatformFileId } from '../utils/modDetailUtils';
import { hasCurseForgeApiKey } from '../../../../../../../Download/logic/curseforgeApi';
import { formatDate } from '../../../../../../../../utils/formatters';

interface ModVersionHistoryProps {
  mod: ModMeta;
  displayMod: ModMeta | null;
  activePlatform: ModPlatformId;
  setActivePlatform: (id: ModPlatformId) => void;
  isLoadingVersions: boolean;
  modVersions: any[];
  onInstallVersion: (mod: ModMeta, version: OreProjectVersion, action: ModVersionInstallAction) => void;
}

const VersionListSkeleton = () => {
  return (
    <div className="flex flex-1 flex-col border-[2px] border-[#1E1E1F] bg-[#222324] animate-pulse">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className={`flex items-center justify-between border-b-[2px] border-[#1E1E1F] p-3.5 ${
            index === 5 ? 'border-b-0' : ''
          }`}
        >
          <div className="flex flex-col gap-2 flex-1 min-w-0 pr-4">
            <div className="h-4 bg-[#48494A] w-1/3"></div>
            <div className="h-3 bg-[#313233] w-1/4"></div>
          </div>
          <div className="h-8 w-20 bg-[#48494A]"></div>
        </div>
      ))}
    </div>
  );
};

export const ModVersionHistory: React.FC<ModVersionHistoryProps> = ({
  mod,
  displayMod,
  activePlatform,
  setActivePlatform,
  isLoadingVersions,
  modVersions,
  onInstallVersion
}) => {
  const isCfKeyMissing = activePlatform === 'curseforge' && !hasCurseForgeApiKey();

  const currentFileId = getPlatformFileId(displayMod, activePlatform) || getPlatformFileId(mod, activePlatform);
  const currentVersionIndex = modVersions.findIndex((version) => {
    if (currentFileId && version.id === currentFileId) return true;
    if (
      activePlatform === 'curseforge' &&
      typeof mod.curseforgeFingerprint === 'number' &&
      version.fileFingerprint === mod.curseforgeFingerprint
    ) {
      return true;
    }
    if (
      version.file_name &&
      mod.fileName &&
      version.file_name.toLowerCase() === mod.fileName.toLowerCase()
    ) {
      return true;
    }
    return false;
  });

  const getVersionInstallAction = (_version: OreProjectVersion, index: number): ModVersionInstallAction => {
    if (index === currentVersionIndex) return 'reinstall';
    if (currentVersionIndex < 0) return 'install';
    return index < currentVersionIndex ? 'upgrade' : 'downgrade';
  };

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: modVersions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 62,
    overscan: 6,
  });

  const platformOptions = [
    { id: 'modrinth', label: 'Modrinth 源' },
    { id: 'curseforge', label: 'CurseForge 源' }
  ];

  return (
    <div className="flex h-full w-full flex-col font-minecraft p-4 sm:p-5 bg-[var(--ore-modal-bg)]">
      {/* 顶部操作与平台切换栏 */}
      <div
        className="flex shrink-0 items-center justify-between gap-3 border-[2px] border-[#1E1E1F] bg-[#48494A] p-2.5 mb-3"
        style={{ boxShadow: 'inset 0 2px 0 rgba(255, 255, 255, 0.12)' }}
      >
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white ore-text-shadow pl-1">
          <History size={14} />
          <span>可用版本列表</span>
          {modVersions.length > 0 && (
            <span className="border-[2px] border-[#1E1E1F] bg-[#313233] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-[inset_0_-2px_0_#1E1E1F]">
              {modVersions.length}
            </span>
          )}
        </div>

        {/* 平台切换器 */}
        <OreSegmentedControl
          tabs={platformOptions}
          activeTab={activePlatform}
          onChange={(val) => setActivePlatform(val as ModPlatformId)}
          style={{
            '--seg-height': '2.25rem',
            '--seg-min-width': '0px',
            '--seg-px': '1rem',
            '--seg-font-size': '0.75rem'
          } as any}
        />
      </div>

      {/* 缺失 API Key 警告 */}
      {isCfKeyMissing && (
        <div className="mb-3 flex items-center gap-2 border-[2px] border-[#1E1E1F] bg-[#C33636] p-2.5 text-xs font-bold text-white shadow-[inset_0_-2px_0_#AD1D1D]">
          <AlertCircle size={15} className="shrink-0" />
          <span>未配置 CurseForge API Key，无法直接从 CurseForge 获取版本列表。</span>
        </div>
      )}

      {/* 版本列表主视口 */}
      {isLoadingVersions ? (
        <VersionListSkeleton />
      ) : modVersions.length === 0 ? (
        <div
          className="flex flex-1 flex-col items-center justify-center border-[2px] border-[#1E1E1F] bg-[#2B2C2D] py-12 text-center text-[#A0A1A4]"
          style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.35)' }}
        >
          <History size={30} className="opacity-50" />
          <span className="mt-2.5 text-xs font-bold">该平台未找到匹配的版本记录</span>
        </div>
      ) : (
        <div
          className="flex-1 min-h-0 border-[2px] border-[#1E1E1F] bg-[#2B2C2D] overflow-hidden"
          style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.35)' }}
        >
          <OreOverlayScrollArea
            ref={parentRef}
            className="h-full w-full"
            safeInsetTop={0}
            safeInsetBottom={0}
            safeInsetRight={0}
            contentSafePaddingRight={0}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const index = virtualRow.index;
                const version = modVersions[index];
                if (!version) return null;

                const isCurrent = index === currentVersionIndex;
                const action = getVersionInstallAction(version, index);
                const releaseType = version.version_type || version.releaseType || 'release';
                const releaseDate = version.date_published || version.fileDate;
                const formattedDate = releaseDate ? formatDate(releaseDate) : '-';

                return (
                  <div
                    key={virtualRow.key}
                    ref={rowVirtualizer.measureElement}
                    data-index={index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={`grid h-[62px] max-h-[62px] min-h-[62px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b-[2px] border-[#1E1E1F] px-3.5 transition-none ${
                      isCurrent
                        ? 'bg-[#2E5E22] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_0_#1D4D13]'
                        : 'bg-[#48494A] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)] hover:bg-[#525354]'
                    }`}
                  >
                    {/* 左侧：版本名 + 各种标签 + 发布时间 */}
                    <div className="flex flex-col justify-center min-w-0 pr-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* 当前版本指示 */}
                        {isCurrent && (
                          <span className="flex shrink-0 items-center gap-1 border-[2px] border-[#1E1E1F] bg-[#1D4D13] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#A6F08B]">
                            <Check size={10} strokeWidth={3} />
                            <span>已安装</span>
                          </span>
                        )}

                        {/* 版本名称 */}
                        <span className="truncate text-xs sm:text-sm font-bold text-white ore-text-shadow">
                          {version.name || version.version_number || version.file_name}
                        </span>

                        {/* 发布类型标签 */}
                        <span
                          className={`shrink-0 border-[2px] border-[#1E1E1F] px-1.5 py-[1px] text-[9px] font-bold uppercase ${
                            releaseType === 'release'
                              ? 'bg-[#1D4D13] text-[#A6F08B]'
                              : releaseType === 'beta'
                                ? 'bg-[#16273C] text-[#8CB3FF]'
                                : 'bg-[#5E1E1E] text-[#FF9E9E]'
                          }`}
                        >
                          {releaseType}
                        </span>
                      </div>

                      {/* 下行：游戏版本 + Loader + 发布日期 */}
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#D0D1D4]">
                        {version.game_versions && version.game_versions.length > 0 && (
                          <span className="truncate max-w-[12rem] text-white">
                            MC {version.game_versions.slice(0, 3).join(', ')}
                          </span>
                        )}
                        <span>•</span>
                        {version.loaders && version.loaders.length > 0 && (
                          <span className="truncate uppercase text-[#D0D1D4]">
                            {version.loaders.join('/')}
                          </span>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock3 size={11} />
                          <span>{formattedDate}</span>
                        </span>
                      </div>
                    </div>

                    {/* 右侧：安装 / 升级 / 降级 / 重装 按钮 */}
                    <div className="flex items-center justify-end">
                      <FocusItem focusKey={`version-btn-${index}`} onEnter={() => onInstallVersion(mod, version, action)}>
                        {({ ref }) => (
                          <div ref={ref as any}>
                            <OreButton
                              variant={action === 'upgrade' || action === 'install' ? 'primary' : 'secondary'}
                              size="sm"
                              onClick={() => onInstallVersion(mod, version, action)}
                              className="!h-8"
                            >
                              {action === 'upgrade' ? (
                                <>
                                  <ArrowUpCircle size={13} className="mr-1" />
                                  <span>升级</span>
                                </>
                              ) : action === 'downgrade' ? (
                                <>
                                  <ArrowDownCircle size={13} className="mr-1" />
                                  <span>降级</span>
                                </>
                              ) : action === 'reinstall' ? (
                                <>
                                  <RotateCcw size={13} className="mr-1" />
                                  <span>重装</span>
                                </>
                              ) : (
                                <>
                                  <Download size={13} className="mr-1" />
                                  <span>安装</span>
                                </>
                              )}
                            </OreButton>
                          </div>
                        )}
                      </FocusItem>
                    </div>
                  </div>
                );
              })}
            </div>
          </OreOverlayScrollArea>
        </div>
      )}
    </div>
  );
};

export default ModVersionHistory;