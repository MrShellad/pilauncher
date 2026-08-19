import React from 'react';
import { AlertTriangle, ArrowUpCircle, Loader2 } from 'lucide-react';

import type { ModIconSnapshot } from '../../../../../logic/modIconService';
import type { MissingDependencyInfo, ModMeta } from '../../../../../logic/modService';
import {
  getModDisplayName,
  getModFormattedSize,
  MOD_LIST_COMPACT_GRID_CLASS,
  MOD_LIST_TABLE_GRID_CLASS,
  type ModListTheme,
  type ModListViewMode
} from '../../modListShared';
import { ModPlatformBadges } from './ModPlatformBadges';

interface ModRowViewProps {
  mod: ModMeta;
  iconSnapshot?: ModIconSnapshot;
  missingDependencies?: MissingDependencyInfo[];
  dependentsCount?: number;
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

export const getCompactVersionLabel = (value?: string) => {
  let label = value?.trim();
  if (!label) return '';

  label = label.replace(/\.disabled$/i, '').replace(/\.jar$/i, '');
  label = label.replace(/\[.*?\]|\(.*?\)/g, ' ').trim();

  const matches = Array.from(label.matchAll(/(?:^|[-_+v\s])(\d+(?:\.\d+)+(?:[-+._][0-9A-Za-z]+)*)/gi));
  if (matches.length > 0) {
    const candidates = matches.map((m) => m[1]);
    const nonMcCandidate = candidates.filter((c) => !c.match(/^1\.\d{1,2}(?:\.\d{1,2})?$/));
    const chosen = nonMcCandidate.length > 0 ? nonMcCandidate[nonMcCandidate.length - 1] : candidates[candidates.length - 1];
    return chosen.replace(/^v(?=\d)/i, '');
  }

  const simpleMatch = label.match(/(\d+(?:\.\d+)+)/);
  if (simpleMatch) {
    return simpleMatch[1];
  }

  return label.replace(/^v(?=\d)/i, '');
};

interface ModIconBoxProps {
  mod: ModMeta;
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
  const displayVersion = getCompactVersionLabel(version);
  const sizeClass = size === 'md'
    ? 'px-1.5 py-0.5 text-[11px]'
    : 'px-1 py-0.5 text-[10px]';
  const colorClass = isLightTheme
    ? 'border-[#1E1E1F] bg-[#F2F2F2] text-[#111214] shadow-[inset_0_-2px_0_#B8BBC2]'
    : 'border-[#1E1E1F] bg-[#232937] text-[#C7D2E6] shadow-[inset_0_-2px_0_rgba(0,0,0,0.4)]';

  return (
    <span
      title={version}
      className={`inline-flex shrink-0 items-center border-[2px] font-minecraft font-bold uppercase leading-none tracking-wider ${colorClass} ${sizeClass}`}
    >
      v{displayVersion}
    </span>
  );
};

const UpdateBadge: React.FC<{
  hasUpdate?: boolean;
  updateVersionName?: string;
  size?: 'sm' | 'md';
}> = ({
  hasUpdate,
  updateVersionName,
  size = 'sm'
}) => {
  const sizeClass = size === 'md'
    ? 'max-w-[10rem] px-1.5 py-0.5 text-[11px]'
    : 'max-w-[8rem] px-1 py-0.5 text-[10px]';

  if (!hasUpdate) return null;

  const displayVersion = getCompactVersionLabel(updateVersionName);
  const updateLabel = displayVersion ? `→ ${displayVersion}` : '可更新';

  return (
    <span
      title={updateVersionName ? `可更新到 ${updateVersionName}` : updateLabel}
      className={`inline-flex min-w-0 shrink-0 items-center gap-1 border-[2px] border-[#1E1E1F] bg-[#57D38C] font-minecraft font-bold uppercase leading-none text-[#06140B] shadow-[inset_0_-2px_0_#38985B] ${sizeClass}`}
    >
      <ArrowUpCircle size={11} strokeWidth={2.5} />
      <span className="truncate">{updateLabel}</span>
    </span>
  );
};

const MissingDependencyBadge: React.FC<{
  missing?: MissingDependencyInfo[];
  size?: 'sm' | 'md';
}> = ({ missing, size = 'sm' }) => {
  if (!missing || missing.length === 0) return null;

  const names = missing.map((m) => m.targetNameHint || m.targetIdentifier).join(', ');
  const label = missing.length === 1 ? `缺前置: ${names}` : `缺 ${missing.length} 个前置`;
  const sizeClass = size === 'md'
    ? 'max-w-[14rem] px-1.5 py-0.5 text-[11px]'
    : 'max-w-[10rem] px-1 py-0.5 text-[10px]';

  return (
    <span
      title={`缺失前置依赖: ${names}`}
      className={`inline-flex min-w-0 shrink-0 items-center gap-1 border-[2px] border-[#1E1E1F] bg-[#FFA940] font-minecraft font-bold uppercase leading-none text-[#2A1200] shadow-[inset_0_-2px_0_#D46B08] ${sizeClass}`}
    >
      <AlertTriangle size={11} strokeWidth={2.5} />
      <span className="truncate">{label}</span>
    </span>
  );
};

const DependentsBadge: React.FC<{
  dependentsCount?: number;
  size?: 'sm' | 'md';
  listTheme: ModListTheme;
}> = ({ dependentsCount, size = 'sm', listTheme }) => {
  if (!dependentsCount || dependentsCount <= 0) return null;

  const isLightTheme = listTheme === 'light';
  const sizeClass = size === 'md'
    ? 'px-1.5 py-0.5 text-[11px]'
    : 'px-1 py-0.5 text-[10px]';
  const colorClass = isLightTheme
    ? 'border-[#1E1E1F] bg-[#E6F4FF] text-[#003A8C] shadow-[inset_0_-2px_0_#91CAFF]'
    : 'border-[#1E1E1F] bg-[#112A45] text-[#91CAFF] shadow-[inset_0_-2px_0_rgba(0,0,0,0.5)]';

  return (
    <span
      title={`被 ${dependentsCount} 个模组作为前置依赖`}
      className={`inline-flex shrink-0 items-center gap-1 border-[2px] font-minecraft font-bold uppercase leading-none tracking-wider ${colorClass} ${sizeClass}`}
    >
      <span>🧩 {dependentsCount} 附属</span>
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
  mod,
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
      className={`relative shrink-0 overflow-hidden border-[2px] border-[#1E1E1F] bg-[#14171E] shadow-[inset_0_-2px_0_rgba(0,0,0,0.6),inset_1px_1px_0_rgba(255,255,255,0.06)] ${className} ${
        isEnabled ? '' : 'grayscale opacity-75'
      }`}
    >
      <ModPlatformBadges mod={mod} />

      {iconUrl ? (
        <img src={iconUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div
          className={`relative flex h-full w-full items-center justify-center ${isIconLoading ? 'animate-pulse' : ''}`}
          style={placeholderStyle}
        >
          <span
            className="font-minecraft font-bold leading-none text-white/90"
            style={{ fontSize: Math.max(16, fallbackIconSize) }}
          >
            {initial}
          </span>
          {isIconLoading && (
            <span className="absolute bottom-0.5 right-0.5 bg-[#111318]/90 p-0.5">
              <Loader2 size={Math.max(9, fallbackIconSize - 10)} className="animate-spin text-[#AFC4FF]" />
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
  missingDependencies,
  dependentsCount,
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
        : 'bg-[#5A6375]';

  const activeClass = isLightTheme
    ? isActive
      ? 'z-20 bg-[#DDE0E3] outline outline-[2px] outline-[#1D4D13] outline-offset-[-2px] shadow-[inset_0_-2px_0_#B8BBC2,inset_1px_1px_0_rgba(255,255,255,0.78)]'
      : 'hover:bg-[#D4D7DB]'
    : isActive
      ? 'z-20 bg-[#2B3447] outline outline-[2px] outline-[#7AA2FF] outline-offset-[-2px] shadow-[inset_0_-2px_0_rgba(0,0,0,0.5),inset_1px_1px_0_rgba(255,255,255,0.08)]'
      : 'hover:bg-[#202532]';

  const rowBackgroundClass = isLightTheme
    ? isEnabled ? 'bg-[#C6C8CB]' : 'bg-[#B8BBC2]'
    : isEnabled ? 'bg-[#181C25]' : 'bg-[#14171E]';

  const borderClass = isLightTheme ? 'border-b-[#A9ABAE]' : 'border-b-[#1E2430]';

  const titleTextClass = isLightTheme
    ? isEnabled ? 'text-[#111214]' : 'text-[#5A5C60]'
    : isPrimaryRow || isEnabled
      ? 'text-[#FFFFFF]'
      : 'text-[#8A93A6]';

  const secondaryTextClass = isLightTheme
    ? 'text-[#4A4C50]'
    : isEnabled
      ? 'text-[#8D96A8]'
      : 'text-[#616B7E]';

  const fileNameTextClass = isLightTheme
    ? 'text-[#4A4C50]'
    : isEnabled
      ? 'text-[#8D96A8]'
      : 'text-[#616B7E]';

  const mutedDividerClass = isLightTheme ? 'text-[#8C8D90]' : 'text-[#313A4D]';

  if (viewMode === 'standard') {
    return (
      <div
        onClick={onClick}
        className={`group relative grid min-h-[4.5rem] cursor-pointer select-none ${MOD_LIST_TABLE_GRID_CLASS} items-center gap-2.5 border-b-[2px] px-2 py-2.5 text-left transition-colors ${borderClass} ${rowBackgroundClass} ${activeClass}`}
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

        <div className="flex items-center justify-center shrink-0">
          <ModIconBox
            mod={mod}
            iconUrl={iconUrl}
            isIconLoading={isIconLoading}
            isEnabled={isEnabled}
            className={`h-12 w-12 ${isSelected ? 'border-[#57D38C]' : 'border-[#1E1E1F]'}`}
            fallbackIconSize={22}
            placeholderLabel={displayName || mod.fileName}
            placeholderSeed={mod.cacheKey || mod.fileName}
          />
        </div>

        <div className={`min-w-0 pr-2 ${isEnabled ? '' : 'opacity-65'}`}>
          <div className={`truncate font-minecraft text-[15px] font-bold leading-snug tracking-wide ${titleTextClass}`}>
            {displayName}
          </div>
          <div className={`mt-1 truncate font-minecraft text-[12px] leading-tight ${fileNameTextClass}`}>
            {mod.fileName}
          </div>
        </div>

        <div className="min-w-0 flex flex-col justify-center gap-1.5">
          <div className={`flex min-w-0 flex-wrap items-center gap-1.5 ${isEnabled ? '' : 'opacity-65'}`}>
            <VersionBadge version={mod.version} size="md" listTheme={listTheme} />
            <UpdateBadge
              hasUpdate={mod.hasUpdate}
              updateVersionName={mod.updateVersionName}
              size="md"
            />
          </div>
          {((missingDependencies && missingDependencies.length > 0) || (dependentsCount && dependentsCount > 0)) ? (
            <div className={`flex min-w-0 flex-wrap items-center gap-1.5 ${isEnabled ? '' : 'opacity-65'}`}>
              <MissingDependencyBadge missing={missingDependencies} size="sm" />
              <DependentsBadge dependentsCount={dependentsCount} size="sm" listTheme={listTheme} />
            </div>
          ) : null}
        </div>

        <div className={`min-w-0 truncate font-minecraft text-[12px] tabular-nums ${secondaryTextClass} ${isEnabled ? '' : 'opacity-65'}`}>
          {formattedSize}
        </div>

        <div
          className="flex shrink-0 justify-end pr-1"
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
      className={`group relative grid min-h-[3.125rem] cursor-pointer select-none ${MOD_LIST_COMPACT_GRID_CLASS} items-center gap-2.5 border-b-[2px] px-2 py-1 text-left transition-colors ${borderClass} ${rowBackgroundClass} ${activeClass}`}
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

      <div className="flex items-center justify-center shrink-0">
        <ModIconBox
          mod={mod}
          iconUrl={iconUrl}
          isIconLoading={isIconLoading}
          isEnabled={isEnabled}
          className="h-9 w-9"
          fallbackIconSize={16}
          placeholderLabel={displayName || mod.fileName}
          placeholderSeed={mod.cacheKey || mod.fileName}
        />
      </div>

      <div className={`min-w-0 pr-2 ${isEnabled ? '' : 'opacity-65'}`}>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={`truncate font-minecraft text-[15px] font-bold leading-tight tracking-wide ${titleTextClass}`}>
            {displayName}
          </span>
          <VersionBadge version={mod.version} listTheme={listTheme} />
          <MissingDependencyBadge missing={missingDependencies} size="sm" />
          <DependentsBadge dependentsCount={dependentsCount} size="sm" listTheme={listTheme} />
          <UpdateBadge
            hasUpdate={mod.hasUpdate}
            updateVersionName={mod.updateVersionName}
          />
        </div>
        <div className={`mt-0.5 flex min-w-0 items-center gap-2 font-minecraft text-[11px] leading-none ${fileNameTextClass}`}>
          <span className="truncate">{mod.fileName}</span>
          <span className={`shrink-0 ${mutedDividerClass}`}>|</span>
          <span className="shrink-0">{formattedSize}</span>
        </div>
      </div>

      <div
        className="flex shrink-0 justify-end pr-1"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {trailing}
      </div>
    </div>
  );
};
