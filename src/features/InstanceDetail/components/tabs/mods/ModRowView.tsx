import React from 'react';
import { ArrowUpCircle, Blocks, FileArchive, Loader2 } from 'lucide-react';

import type { ModIconSnapshot } from '../../../logic/modIconService';
import type { ModMeta } from '../../../logic/modService';
import {
  getModDisplayName,
  getModFormattedSize,
  getModSourceLabel,
  MOD_LIST_TABLE_GRID_CLASS,
  type ModListViewMode
} from './modListShared';

interface ModRowViewProps {
  mod: ModMeta;
  iconSnapshot?: ModIconSnapshot;
  focused: boolean;
  hasFocusedChild: boolean;
  isPrimaryRow: boolean;
  isSelected: boolean;
  isEnabled: boolean;
  isRowInOperationMode: boolean;
  rowIndex: number;
  viewMode: ModListViewMode;
  leading?: React.ReactNode;
  trailing: React.ReactNode;
  onClick: () => void;
}

interface ModIconBoxProps {
  iconUrl: string | null;
  isIconLoading: boolean;
  isEnabled: boolean;
  className: string;
  fallbackIconSize: number;
}

const VersionBadge: React.FC<{ version?: string; size?: 'sm' | 'md' }> = ({ version, size = 'sm' }) => {
  if (!version) return null;

  const sizeClass = size === 'md'
    ? 'px-2 py-1 text-[0.8125rem]'
    : 'px-1.5 py-0.5 text-[0.625rem]';

  return (
    <span className={`inline-flex shrink-0 items-center border border-white/10 bg-white/[0.08] font-mono leading-none text-[#D0D1D4] ${sizeClass}`}>
      v{version}
    </span>
  );
};

const UpdateBadge: React.FC<{
  currentVersion?: string;
  isCheckingUpdate?: boolean;
  hasUpdate?: boolean;
  updateVersionName?: string;
  size?: 'sm' | 'md';
  targetOnly?: boolean;
}> = ({
  currentVersion,
  isCheckingUpdate,
  hasUpdate,
  updateVersionName,
  size = 'sm',
  targetOnly = false
}) => {
  const sizeClass = size === 'md'
    ? 'px-2 py-1 text-[0.75rem]'
    : 'px-1.5 py-0.5 text-[0.625rem]';

  if (isCheckingUpdate) {
    return (
      <span className={`inline-flex shrink-0 items-center gap-1 border border-[#A7832B]/40 bg-[#2D2410] leading-none text-[#F0C86B] ${sizeClass}`}>
        <Loader2 size={11} className="animate-spin" />
        检查中
      </span>
    );
  }

  if (!hasUpdate) return null;

  let updateLabel = '可更新';
  if (targetOnly && updateVersionName) {
    updateLabel = updateVersionName;
  } else if (currentVersion && updateVersionName) {
    updateLabel = `${currentVersion} -> ${updateVersionName}`;
  } else if (updateVersionName) {
    updateLabel = `可更新到 ${updateVersionName}`;
  }

  return (
    <span
      title={updateLabel}
      className={`inline-flex min-w-0 shrink-0 items-center gap-1 border border-[#3C8527]/60 bg-[#24563C] font-mono leading-none text-white ${sizeClass}`}
    >
      <ArrowUpCircle size={11} />
      <span className="truncate">{updateLabel}</span>
    </span>
  );
};

const ModIconBox: React.FC<ModIconBoxProps> = ({
  iconUrl,
  isIconLoading,
  isEnabled,
  className,
  fallbackIconSize
}) => {
  return (
    <div
      className={`relative shrink-0 overflow-hidden border border-white/10 bg-[#202124] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${className} ${
        isEnabled ? '' : 'grayscale'
      }`}
    >
      {iconUrl ? (
        <img src={iconUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center ${
            isIconLoading
              ? 'animate-pulse bg-[radial-gradient(circle_at_top,rgba(62,180,137,0.25),rgba(0,0,0,0.18)_62%)]'
              : 'bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(0,0,0,0.08))]'
          }`}
        >
          {isIconLoading ? (
            <Loader2 size={16} className="animate-spin text-ore-green" />
          ) : (
            <Blocks size={fallbackIconSize} className="text-[#B8BBC2]" />
          )}
        </div>
      )}
    </div>
  );
};

export const ModRowView: React.FC<ModRowViewProps> = ({
  mod,
  iconSnapshot,
  focused,
  hasFocusedChild,
  isPrimaryRow,
  isSelected,
  isEnabled,
  isRowInOperationMode,
  rowIndex,
  viewMode,
  leading,
  trailing,
  onClick
}) => {
  const displayName = getModDisplayName(mod);
  const formattedSize = getModFormattedSize(mod);
  const sourceLabel = getModSourceLabel(mod);
  const iconUrl = iconSnapshot?.src || null;
  const isIconLoading = iconSnapshot?.status === 'loading' || (!!mod.isFetchingNetwork && !iconUrl);
  const isActive = focused || hasFocusedChild || isRowInOperationMode;
  const accentClass = isRowInOperationMode
    ? 'bg-ore-green'
    : isSelected
      ? 'bg-[#6CC349]'
      : isEnabled
        ? 'bg-[#61749C]'
        : 'bg-[#9A4A4A]';
  const rowBackgroundClass = rowIndex % 2 === 0 ? 'bg-[#2A2A2C]' : 'bg-[#303033]';
  const activeClass = isActive
    ? 'z-20 outline outline-2 outline-white outline-offset-[-1px] bg-[#3A3A3E]'
    : 'hover:bg-[#38383C]';
  const inactiveClass = isEnabled ? '' : 'opacity-75';

  if (viewMode === 'standard') {
    return (
      <div
        onClick={onClick}
        className={`group relative grid min-h-[4.75rem] cursor-pointer select-none ${MOD_LIST_TABLE_GRID_CLASS} items-center gap-2 overflow-hidden border-b border-white/[0.07] px-2 text-left transition-colors ${rowBackgroundClass} ${activeClass} ${inactiveClass}`}
      >
        <div className={`absolute inset-y-0 left-0 w-1 ${accentClass}`} />

        <div
          className="flex items-center justify-center"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {leading}
        </div>

        <div className="flex min-w-0 items-center gap-2 pl-2">
          <ModIconBox
            iconUrl={iconUrl}
            isIconLoading={isIconLoading}
            isEnabled={isEnabled}
            className={`h-[3.25rem] w-[3.25rem] ${isSelected ? 'border-[#5C8DBF]' : 'border-white/10'}`}
            fallbackIconSize={24}
          />
          <div className="min-w-0">
            <div className={`truncate font-minecraft text-[1.0625rem] font-bold leading-tight ${isPrimaryRow ? 'text-white' : 'text-[#F1F3F7]'}`}>
              {displayName}
            </div>
            <div className="mt-0.5 truncate text-[0.6875rem] text-[#9EA1A8]">
              {sourceLabel}
            </div>
          </div>
        </div>

        <div className="min-w-0 truncate font-mono text-[0.75rem] leading-tight text-[#C2C6CE]">
          {mod.fileName}
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 flex-col items-start gap-1">
            <VersionBadge version={mod.version} size="md" />
            <UpdateBadge
              currentVersion={mod.version}
              isCheckingUpdate={mod.isCheckingUpdate}
              hasUpdate={mod.hasUpdate}
              updateVersionName={mod.updateVersionName}
              size="md"
              targetOnly
            />
            {!mod.isCheckingUpdate && !mod.hasUpdate && (
              <span className="font-mono text-[0.6875rem] text-[#747780]">-</span>
            )}
          </div>
        </div>

        <div
          className="flex shrink-0 justify-end"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {trailing}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`group relative grid min-h-[2.75rem] cursor-pointer select-none grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden border-b border-white/[0.07] px-3 py-1 text-left transition-colors ${rowBackgroundClass} ${activeClass} ${inactiveClass}`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${accentClass}`} />

      <ModIconBox
        iconUrl={iconUrl}
        isIconLoading={isIconLoading}
        isEnabled={isEnabled}
        className="h-8 w-8"
        fallbackIconSize={16}
      />

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`truncate font-minecraft text-[0.875rem] leading-tight ${isPrimaryRow ? 'text-white' : 'text-[#F1F3F7]'}`}>
            {displayName}
          </span>
          <VersionBadge version={mod.version} />
          <UpdateBadge
            currentVersion={mod.version}
            isCheckingUpdate={mod.isCheckingUpdate}
            hasUpdate={mod.hasUpdate}
            updateVersionName={mod.updateVersionName}
          />
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[0.6875rem] leading-none text-[#C2C6CE]">
          <span className="truncate font-mono">{mod.fileName}</span>
          <span className="shrink-0 text-white/20">|</span>
          <span className="shrink-0 font-mono">{formattedSize}</span>
          <span className="hidden shrink-0 items-center gap-1 text-[#D5D8DE] lg:inline-flex">
            <FileArchive size={11} />
            {sourceLabel}
          </span>
        </div>
      </div>

      <div
        className="flex shrink-0 justify-end"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {trailing}
      </div>
    </div>
  );
};
