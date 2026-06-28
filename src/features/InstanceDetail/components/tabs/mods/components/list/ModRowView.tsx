import React from 'react';
import { ArrowUpCircle, FileArchive, Loader2 } from 'lucide-react';

import type { ModIconSnapshot } from '../../../../../logic/modIconService';
import type { ModMeta } from '../../../../../logic/modService';
import {
  getModDisplayName,
  getModFormattedSize,
  getModSourceLabel,
  MOD_LIST_TABLE_GRID_CLASS,
  type ModListTheme,
  type ModListViewMode
} from '../../modListShared';

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
  listTheme: ModListTheme;
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
  placeholderLabel: string;
  placeholderSeed: string;
}

const VersionBadge: React.FC<{ version?: string; size?: 'sm' | 'md'; listTheme: ModListTheme }> = ({
  version,
  size = 'sm',
  listTheme
}) => {
  if (!version) return null;

  const isLightTheme = listTheme === 'light';
  const sizeClass = size === 'md'
    ? 'px-2 py-1 text-[1.0625rem]'
    : 'px-1.5 py-0.5 text-[1.0625rem]';
  const colorClass = isLightTheme
    ? 'border-[#1E1E1F] bg-[#F2F2F2] text-[#111214] shadow-[inset_0_-0.125rem_0_#B8BBC2]'
    : 'border-[#313A4D] bg-[#232937] text-[#C7D2E6]';

  return (
    <span className={`inline-flex shrink-0 items-center rounded-[6px] border font-semibold leading-none ${colorClass} ${sizeClass}`}>
      v{version}
    </span>
  );
};

const UpdateBadge: React.FC<{
  currentVersion?: string;
  hasUpdate?: boolean;
  updateVersionName?: string;
  size?: 'sm' | 'md';
  targetOnly?: boolean;
}> = ({
  currentVersion,
  hasUpdate,
  updateVersionName,
  size = 'sm',
  targetOnly = false
}) => {
  const sizeClass = size === 'md'
    ? 'px-2 py-1 text-[1.0625rem]'
    : 'px-1.5 py-0.5 text-[1.0625rem]';

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

const getPlaceholderInitial = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '#';

  const firstAlphaNumeric = Array.from(trimmed).find((char) => /[\p{L}\p{N}]/u.test(char));
  return (firstAlphaNumeric || trimmed[0] || '#').toUpperCase();
};

const getHashHue = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % 360;
};

const ModIconBox: React.FC<ModIconBoxProps> = ({
  iconUrl,
  isIconLoading,
  isEnabled,
  className,
  fallbackIconSize,
  placeholderLabel,
  placeholderSeed
}) => {
  const hue = getHashHue(placeholderSeed);
  const initial = getPlaceholderInitial(placeholderLabel);
  const placeholderStyle = {
    background: `linear-gradient(135deg, hsl(${hue} 64% 34%), hsl(${(hue + 36) % 360} 48% 18%))`
  };

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
          className={`relative flex h-full w-full items-center justify-center ${isIconLoading ? 'animate-pulse' : ''}`}
          style={placeholderStyle}
        >
          <span
            className="font-minecraft font-bold leading-none text-white/90"
            style={{ fontSize: Math.max(13, fallbackIconSize - 4) }}
          >
            {initial}
          </span>
          {isIconLoading && (
            <span className="absolute bottom-0.5 right-0.5 rounded-sm bg-[#111318]/80 p-0.5">
              <Loader2 size={Math.max(10, fallbackIconSize - 10)} className="animate-spin text-[#AFC4FF]" />
            </span>
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
  listTheme,
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
  const isLightTheme = listTheme === 'light';
  const accentClass = isRowInOperationMode
    ? 'bg-[#7AA2FF]'
    : isSelected
      ? 'bg-[#57D38C]'
      : isEnabled
        ? 'bg-[#5B8CFF]'
        : 'bg-[#8B93A7]';
  const activeClass = isLightTheme
    ? isActive
      ? 'z-20 bg-[#EEF0F2] outline outline-2 outline-[#1D4D13] outline-offset-[-2px] shadow-[inset_0_-0.25rem_0_#B8BBC2,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.78)]'
      : 'hover:bg-[#DDE0E3]'
    : isActive
      ? 'z-20 bg-[#2B3346] outline outline-2 outline-[#7AA2FF] outline-offset-[-2px] shadow-[inset_0_0_0_1px_rgba(122,162,255,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]'
      : 'hover:bg-[#222734]';
  const rowBackgroundClass = isLightTheme
    ? isEnabled ? 'bg-[#C6C8CB]' : 'bg-[#B8BBC2]'
    : isEnabled ? 'bg-[#1A1D24]' : 'bg-[#171A21]';
  const borderClass = isLightTheme ? 'border-[#A9ABAE]' : 'border-[#242B38]';
  const titleTextClass = isLightTheme
    ? isEnabled ? 'text-[#111214]' : 'text-[#313233]'
    : isPrimaryRow
      ? 'text-[#F3F6FC]'
      : isEnabled
        ? 'text-[#DCE3F1]'
        : 'text-[#C8D2E6]';
  const secondaryTextClass = isLightTheme
    ? 'text-[#4A4C50]'
    : isActive
      ? 'text-[#B8C2D9]'
      : isEnabled
        ? 'text-[#8D96A8]'
        : 'text-[#AAB4C8]';
  const fileNameTextClass = isLightTheme
    ? isActive ? 'text-[#1E1E1F]' : 'text-[#313233]'
    : isActive
      ? 'text-[#B8C2D9]'
      : isEnabled
        ? 'text-[#9AA6BA]'
        : 'text-[#AAB4C8]';
  const mutedDividerClass = isLightTheme ? 'text-[#8C8D90]' : 'text-[#313A4D]';

  if (viewMode === 'standard') {
    return (
      <div
        onClick={onClick}
        className={`group relative grid min-h-[5.5rem] cursor-pointer select-none ${MOD_LIST_TABLE_GRID_CLASS} items-center gap-2 overflow-hidden border-b px-2 text-left ${borderClass} ${rowBackgroundClass} ${activeClass}`}
      >
        <div className={`absolute inset-y-0 left-0 ${isActive ? 'w-1.5' : 'w-1'} ${accentClass}`} />

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
            className={`h-[3.5rem] w-[3.5rem] ${isSelected ? 'border-[#57D38C]' : isLightTheme ? 'border-[#1E1E1F]' : 'border-[#2A3140]'}`}
            fallbackIconSize={26}
            placeholderLabel={displayName || mod.fileName}
            placeholderSeed={mod.cacheKey || mod.fileName}
          />
          <div className={`min-w-0 ${isEnabled ? '' : 'opacity-55'}`}>
            <div className={`truncate text-[1.125rem] font-bold leading-tight ${titleTextClass}`}>
              {displayName}
            </div>
            <div className={`mt-0.5 truncate text-[1.0625rem] ${secondaryTextClass}`}>
              {sourceLabel}
            </div>
          </div>
        </div>

        <div className={`min-w-0 truncate text-[1.0625rem] leading-tight ${fileNameTextClass} ${isEnabled ? '' : 'opacity-55'}`}>
          {mod.fileName}
        </div>

        <div className="min-w-0">
          <div className={`flex min-w-0 flex-col items-start gap-1 ${isEnabled ? '' : 'opacity-55'}`}>
            <VersionBadge version={mod.version} size="md" listTheme={listTheme} />
            <UpdateBadge
              currentVersion={mod.version}
              hasUpdate={mod.hasUpdate}
              updateVersionName={mod.updateVersionName}
              size="md"
              targetOnly
            />
          </div>
        </div>

        <div
          className="flex shrink-0 justify-end pr-5"
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
      className={`group relative grid min-h-[4rem] cursor-pointer select-none grid-cols-[2.875rem_36px_minmax(0,1fr)_auto] items-center gap-[15px] overflow-hidden border-b px-3 py-1 text-left ${borderClass} ${rowBackgroundClass} ${activeClass}`}
    >
      <div className={`absolute inset-y-0 left-0 ${isActive ? 'w-1.5' : 'w-1'} ${accentClass}`} />

      <div
        className="flex items-center justify-center"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {leading}
      </div>

      <ModIconBox
        iconUrl={iconUrl}
        isIconLoading={isIconLoading}
        isEnabled={isEnabled}
        className="h-9 w-9"
        fallbackIconSize={20}
        placeholderLabel={displayName || mod.fileName}
        placeholderSeed={mod.cacheKey || mod.fileName}
      />

      <div className={`min-w-0 ${isEnabled ? '' : 'opacity-55'}`}>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`truncate text-[1.0625rem] leading-tight ${titleTextClass}`}>
            {displayName}
          </span>
          <VersionBadge version={mod.version} listTheme={listTheme} />
          <UpdateBadge
            currentVersion={mod.version}
            hasUpdate={mod.hasUpdate}
            updateVersionName={mod.updateVersionName}
          />
        </div>
        <div className={`mt-0.5 flex min-w-0 items-center gap-2 text-[1.0625rem] leading-none ${fileNameTextClass}`}>
          <span className="truncate">{mod.fileName}</span>
          <span className={`shrink-0 ${mutedDividerClass}`}>|</span>
          <span className="shrink-0">{formattedSize}</span>
          <span className={`hidden shrink-0 items-center gap-1 lg:inline-flex ${secondaryTextClass}`}>
            <FileArchive size={11} />
            {sourceLabel}
          </span>
        </div>
      </div>

      <div
        className="flex shrink-0 justify-end pr-5"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {trailing}
      </div>
    </div>
  );
};
