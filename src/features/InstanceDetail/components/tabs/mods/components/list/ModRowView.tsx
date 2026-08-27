import React from 'react';
import { AlertTriangle, ArrowUpCircle, Loader2 } from 'lucide-react';

import type { ModIconSnapshot } from '../../../../../logic/modIconService';
import type { MissingDependencyInfo, ModMeta } from '../../../../../logic/modService';
import {
  getModDisplayName,
  getModFormattedSize,
  type ModListTheme,
  type ModListViewMode
} from '../../modListShared';
import { ModPlatformBadges } from './ModPlatformBadges';
import { OreAssetRow } from '../../../../../../../ui/primitives/OreAssetRow';

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
      className={`inline-flex max-w-full shrink-0 items-center border-[2px] font-minecraft font-bold uppercase leading-none tracking-wider ${colorClass} ${sizeClass}`}
    >
      <span className="truncate">v{displayVersion}</span>
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

const formatModifiedDate = (timestamp?: number) => {
  if (!timestamp || timestamp <= 0) return '-';
  const ms = timestamp < 1e11 ? timestamp * 1000 : timestamp;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ModIconContent: React.FC<{
  mod: ModMeta;
  iconUrl: string | null;
  isIconLoading: boolean;
  displayName: string;
}> = ({ mod, iconUrl, isIconLoading, displayName }) => {
  const hue = getHashHue(mod.cacheKey || mod.fileName);
  const initial = getPlaceholderInitial(displayName || mod.fileName);
  const placeholderStyle = {
    background: `linear-gradient(135deg, hsl(${hue} 64% 34%), hsl(${(hue + 36) % 360} 48% 18%))`
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <ModPlatformBadges mod={mod} />

      {iconUrl ? (
        <img src={iconUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div
          className={`relative flex h-full w-full items-center justify-center ${isIconLoading ? 'animate-pulse' : ''}`}
          style={placeholderStyle}
        >
          <span
            className="font-minecraft font-bold leading-none text-white/90 text-2xl"
          >
            {initial}
          </span>
          {isIconLoading && (
            <span className="absolute bottom-0.5 right-0.5 bg-[#111318]/90 p-0.5">
              <Loader2 size={13} className="animate-spin text-[#AFC4FF]" />
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
  isPrimaryRow: _isPrimaryRow,
  isSelected,
  isEnabled,
  isRowInOperationMode,
  viewMode: _viewMode,
  listTheme,
  leading,
  trailing,
  onClick
}) => {
  const isLightTheme = listTheme === 'light';
  const displayName = getModDisplayName(mod);
  const formattedSize = getModFormattedSize(mod);
  const formattedDate = formatModifiedDate(mod.modifiedAt);
  const iconUrl = iconSnapshot?.src || null;
  const isIconLoading = iconSnapshot?.status === 'loading' || (!!mod.isFetchingNetwork && !iconUrl);

  return (
    <OreAssetRow
      theme={listTheme}
      focusable={false}
      focused={focused || hasFocusedChild}
      operationActive={isRowInOperationMode}
      inactive={!isEnabled}
      selected={isEnabled}
      onClick={onClick}
      title={displayName}
      badges={
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <UpdateBadge
            hasUpdate={mod.hasUpdate}
            updateVersionName={mod.updateVersionName}
            size="md"
          />
          {missingDependencies && missingDependencies.length > 0 && (
            <MissingDependencyBadge missing={missingDependencies} size="sm" />
          )}
          {dependentsCount && dependentsCount > 0 ? (
            <DependentsBadge dependentsCount={dependentsCount} size="sm" listTheme={listTheme} />
          ) : null}
        </div>
      }
      description={
        <span
          className={`font-minecraft text-[11px] truncate max-w-sm ${
            isLightTheme ? 'text-[#4D535C]' : 'text-[#8C8D90]'
          }`}
          title={mod.fileName}
        >
          {mod.fileName}
        </span>
      }
      selectControl={leading}
      leading={
        <ModIconContent
          mod={mod}
          iconUrl={iconUrl}
          isIconLoading={isIconLoading}
          displayName={displayName}
        />
      }
      leadingClassName="!h-16 !w-16"
      extraColumns={
        <>
          {/* 版本列 */}
          <div className="w-32 lg:w-36 shrink-0 flex items-center justify-start">
            <VersionBadge version={mod.version} size="md" listTheme={listTheme} />
          </div>

          {/* 大小列 */}
          <div className={`w-20 lg:w-24 shrink-0 flex items-center justify-start font-minecraft text-xs tabular-nums ${
            isLightTheme ? 'text-[#202226]' : 'text-[#D0D1D4]'
          }`}>
            {formattedSize}
          </div>

          {/* 修改日期列 */}
          <div className={`w-24 lg:w-28 shrink-0 flex items-center justify-start font-minecraft text-xs ${
            isLightTheme ? 'text-[#60636A]' : 'text-[#8C8D90]'
          }`}>
            {formattedDate}
          </div>
        </>
      }
      trailingClassName="w-32 shrink-0 flex items-center justify-end"
      trailing={
        <div
          className="flex shrink-0 items-center justify-end"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {trailing}
        </div>
      }
      className={isSelected ? '!border-[#57D38C] ring-1 ring-[#57D38C]' : undefined}
    />
  );
};

