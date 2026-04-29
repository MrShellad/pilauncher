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
    ? 'px-2 py-1 text-[1.0625rem]'
    : 'px-1.5 py-0.5 text-[1.0625rem]';

  return (
    <span className={`inline-flex shrink-0 items-center rounded-[6px] border border-[#313A4D] bg-[#232937] font-semibold leading-none text-[#C7D2E6] ${sizeClass}`}>
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
    ? 'px-2 py-1 text-[1.0625rem]'
    : 'px-1.5 py-0.5 text-[1.0625rem]';

  if (isCheckingUpdate) {
    return (
      <span className={`inline-flex shrink-0 items-center gap-1 rounded-[6px] border border-[#F5A524]/50 bg-[#2B3447] font-semibold leading-none text-[#F5A524] ${sizeClass}`}>
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
      className={`inline-flex min-w-0 shrink-0 items-center gap-1 rounded-[6px] border border-[#8CFFB3]/80 bg-[#57D38C] font-semibold leading-none text-[#06140B] shadow-[0_0_12px_rgba(87,211,140,0.22)] ${sizeClass}`}
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
      className={`relative shrink-0 overflow-hidden border border-[#2A3140] bg-[#161A22] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${className} ${
        isEnabled ? '' : 'grayscale'
      }`}
    >
      {iconUrl ? (
        <img src={iconUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center ${
            isIconLoading
              ? 'animate-pulse bg-[radial-gradient(circle_at_top,rgba(122,162,255,0.22),rgba(22,26,34,0.88)_62%)]'
              : 'bg-[linear-gradient(135deg,rgba(122,162,255,0.14),rgba(17,19,24,0.72))]'
          }`}
        >
          {isIconLoading ? (
            <Loader2 size={16} className="animate-spin text-[#7AA2FF]" />
          ) : (
            <Blocks size={fallbackIconSize} className="text-[#8B93A7]" />
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
    ? 'bg-[#7AA2FF]'
    : isSelected
      ? 'bg-[#57D38C]'
      : isEnabled
        ? 'bg-[#5B8CFF]'
        : 'bg-[#8B93A7]';
  const activeClass = isActive
    ? 'z-20 bg-[#262D3D] outline outline-1 outline-[#313A4D] outline-offset-[-1px]'
    : 'hover:bg-[#222734]';
  const inactiveClass = isEnabled ? '' : 'opacity-75';
  const rowBackgroundClass = 'bg-[#1A1D24]';

  if (viewMode === 'standard') {
    return (
      <div
        onClick={onClick}
        className={`group relative grid min-h-[5.5rem] cursor-pointer select-none ${MOD_LIST_TABLE_GRID_CLASS} items-center gap-2 overflow-hidden border-b border-[#242B38] px-2 text-left transition-colors ${rowBackgroundClass} ${activeClass} ${inactiveClass}`}
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

        <div className="flex min-w-0 items-center gap-[11px] pl-2">
          <ModIconBox
            iconUrl={iconUrl}
            isIconLoading={isIconLoading}
            isEnabled={isEnabled}
            className={`h-[3.25rem] w-[3.25rem] ${isSelected ? 'border-[#57D38C]' : 'border-[#2A3140]'}`}
            fallbackIconSize={24}
          />
          <div className="min-w-0">
            <div className={`truncate text-[1.125rem] font-bold leading-tight ${isPrimaryRow ? 'text-[#F3F6FC]' : 'text-[#DCE3F1]'}`}>
              {displayName}
            </div>
            <div className="mt-0.5 truncate text-[1.0625rem] text-[#8D96A8]">
              {sourceLabel}
            </div>
          </div>
        </div>

        <div className="min-w-0 truncate text-[1.0625rem] leading-tight text-[#7C8598]">
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
      className={`group relative grid min-h-[4rem] cursor-pointer select-none grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-[15px] overflow-hidden border-b border-[#242B38] px-3 py-1 text-left transition-colors ${rowBackgroundClass} ${activeClass} ${inactiveClass}`}
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
          <span className={`truncate text-[1.0625rem] leading-tight ${isPrimaryRow ? 'text-[#F3F6FC]' : 'text-[#DCE3F1]'}`}>
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
        <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[1.0625rem] leading-none text-[#7C8598]">
          <span className="truncate">{mod.fileName}</span>
          <span className="shrink-0 text-[#313A4D]">|</span>
          <span className="shrink-0">{formattedSize}</span>
          <span className="hidden shrink-0 items-center gap-1 text-[#8D96A8] lg:inline-flex">
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
