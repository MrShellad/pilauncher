import React from 'react';
import { AlertTriangle, ArrowUpCircle, CheckSquare, HardDrive, Square } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';

import { ModrinthIcon, CurseforgeIcon } from '../../../../../../Download/components/Icons';
import type { ModIconSnapshot } from '../../../../../logic/modIconService';
import { getModPlatformReference, type MissingDependencyInfo, type ModMeta } from '../../../../../logic/modService';
import {
  getModDisplayName,
  getModFormattedDate,
  getModFormattedSize,
  type ModListTheme,
  type ModListViewMode
} from '../../modListShared';

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
  onToggleSelection?: (fileName: string) => void;
}

const getCompactVersionLabel = (value?: string) => {
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

/* 高对比度 2px 描边版本徽章 */
const VersionBadge: React.FC<{ version?: string; isEnabled: boolean }> = ({ version, isEnabled }) => {
  if (!version) return null;
  const displayVersion = getCompactVersionLabel(version);

  return (
    <span
      className={`inline-flex max-w-[120px] shrink-0 items-center justify-center border-[2px] border-[#121418] px-2 py-0.5 font-minecraft text-xs font-bold uppercase ${
        isEnabled
          ? 'bg-[#222838] text-[#D3DEEE]'
          : 'bg-[#171920] text-[#5C667A]'
      }`}
    >
      <span className="truncate">v{displayVersion}</span>
    </span>
  );
};

/* 高对比度 2px 描边可更新徽章 */
const UpdateBadge: React.FC<{ hasUpdate?: boolean; updateVersionName?: string }> = ({
  hasUpdate,
  updateVersionName
}) => {
  if (!hasUpdate) return null;
  const displayVersion = getCompactVersionLabel(updateVersionName);
  const updateLabel = displayVersion ? `→ ${displayVersion}` : '可更新';

  return (
    <span className="inline-flex max-w-[110px] shrink-0 items-center gap-1 border-[2px] border-[#121418] bg-[#57D38C] px-1.5 py-0.5 font-minecraft text-[10px] font-bold uppercase text-[#06140B]">
      <ArrowUpCircle size={11} strokeWidth={2.5} />
      <span className="truncate">{updateLabel}</span>
    </span>
  );
};

/* 高对比度 2px 描边缺失前置徽章 */
const MissingDependencyBadge: React.FC<{ missing?: MissingDependencyInfo[] }> = ({ missing }) => {
  if (!missing || missing.length === 0) return null;
  const names = missing.map((m) => m.targetNameHint || m.targetIdentifier).join(', ');
  const label = missing.length === 1 ? `缺: ${names}` : `缺 ${missing.length} 前置`;

  return (
    <span className="inline-flex max-w-[120px] shrink-0 items-center gap-1 border-[2px] border-[#121418] bg-[#FFA940] px-1.5 py-0.5 font-minecraft text-[10px] font-bold uppercase text-[#2A1200]">
      <AlertTriangle size={11} strokeWidth={2.5} />
      <span className="truncate">{label}</span>
    </span>
  );
};

/* 高对比度 2px 描边附属依赖徽章 */
const DependentsBadge: React.FC<{ dependentsCount?: number }> = ({ dependentsCount }) => {
  if (!dependentsCount || dependentsCount <= 0) return null;

  return (
    <span className="inline-flex shrink-0 items-center gap-1 border-[2px] border-[#121418] bg-[#172E4C] px-1.5 py-0.5 font-minecraft text-[10px] font-bold uppercase text-[#91CAFF]">
      <span>🧩 {dependentsCount}</span>
    </span>
  );
};

/* 单一来源平台底部徽章栏 (纯 2px 边框，高饱和度品牌色，零阴影) */
const ModPlatformBadges: React.FC<{ mod: ModMeta; className?: string }> = ({ mod, className = '' }) => {
  const modrinth = getModPlatformReference(mod, 'modrinth');
  const curseforge = getModPlatformReference(mod, 'curseforge');
  const hasModrinth = !!modrinth?.projectId;
  const hasCurseForge = !!curseforge?.projectId;

  if (hasModrinth) {
    return (
      <div className={`flex h-[18px] w-full items-center justify-center border-t-[2px] border-[#121418] bg-[#00AF5C] text-[#06140B] ${className}`}>
        <ModrinthIcon className="h-3.5 w-3.5" />
      </div>
    );
  }

  if (hasCurseForge) {
    return (
      <div className={`flex h-[18px] w-full items-center justify-center border-t-[2px] border-[#121418] bg-[#E05022] text-white ${className}`}>
        <CurseforgeIcon className="h-3.5 w-3.5" />
      </div>
    );
  }

  return (
    <div className={`flex h-[18px] w-full items-center justify-center border-t-[2px] border-[#121418] bg-[#181B24] text-[#7A8599] ${className}`}>
      <HardDrive size={11} strokeWidth={2.5} />
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
  isSelected,
  isEnabled,
  isRowInOperationMode,
  onClick,
  onToggleSelection,
  trailing
}) => {
  const isRowActive = focused || hasFocusedChild || isRowInOperationMode;
  const displayName = getModDisplayName(mod);
  const formattedSize = getModFormattedSize(mod);
  const dateStr = getModFormattedDate(mod.modifiedAt);

  // 判定图标 URL
  const resolvedIconSrc = React.useMemo(() => {
    if (iconSnapshot?.src) {
      return iconSnapshot.src;
    }
    const rawPath = mod.iconAbsolutePath || mod.offlineJarIconAbsolutePath;
    if (rawPath) {
      return convertFileSrc(rawPath);
    }
    return mod.networkIconUrl || mod.networkInfo?.icon_url;
  }, [iconSnapshot?.src, mod.iconAbsolutePath, mod.networkIconUrl, mod.offlineJarIconAbsolutePath, mod.networkInfo?.icon_url]);

  return (
    <div
      onClick={onClick}
      className={`group relative grid h-[72px] max-h-[72px] min-h-[72px] w-full select-none items-center gap-3 border-b-[2px] border-[#121418] px-3 cursor-pointer transition-none ${
        isRowActive
          ? 'bg-[#2D3342] outline outline-2 outline-white outline-offset-[-2px] z-20'
          : isSelected
            ? 'bg-[#1A2C22] hover:bg-[#22392D]'
            : isEnabled
              ? 'bg-[#181A20] hover:bg-[#232733]'
              : 'bg-[#121316] hover:bg-[#1A1C22]'
      }`}
      style={{
        gridTemplateColumns: '32px 68px minmax(0, 1fr) 130px 80px 110px 120px'
      }}
    >
      {/* 选中时的左侧基岩绿 4px 实心指示条 */}
      {isSelected && (
        <div className="absolute inset-y-0 left-0 w-1 bg-[#57D38C]" />
      )}

      {/* 1. 复选框 (32px) */}
      <div className="flex items-center justify-center">
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelection?.(mod.fileName);
          }}
          className={`flex h-5 w-5 items-center justify-center border-[2px] border-[#121418] transition-colors ${
            isSelected
              ? 'bg-[#57D38C] text-[#06140B]'
              : 'bg-[#181C26] hover:bg-[#252C3D] text-[#C7D2E6]'
          }`}
        >
          {isSelected ? <CheckSquare size={13} /> : <Square size={13} />}
        </button>
      </div>

      {/* 2. 大尺寸图标 (56px 宽 × 62px 高) + 底部单一来源平台徽章栏 */}
      <div className="flex items-center justify-center">
        <div className="flex w-14 flex-col overflow-hidden border-[2px] border-[#121418] bg-[#0E1015]">
          {/* 上半部分：44px 高度的模组主图标 */}
          <div className="relative flex h-11 w-full items-center justify-center overflow-hidden bg-[#141720]">
            {resolvedIconSrc ? (
              <img
                src={resolvedIconSrc}
                alt={displayName}
                className={`h-full w-full object-cover pixelated ${!isEnabled ? 'grayscale opacity-60' : ''}`}
                loading="lazy"
              />
            ) : (
              <span className={`font-minecraft text-base font-bold uppercase ${isEnabled ? 'text-[#8B93A7]' : 'text-[#4A5162]'}`}>
                {displayName.charAt(0)}
              </span>
            )}
          </div>
          {/* 下半部分：18px 单一来源平台徽章栏 */}
          <ModPlatformBadges mod={mod} />
        </div>
      </div>

      {/* 3. 模组名称与文件名 (1fr，主次分明，高对比度) */}
      <div className="flex flex-col justify-center min-w-0 pr-2">
        {/* 主要信息：模组显示名称 (高亮加粗) + 状态徽章组 */}
        <div className="flex items-center gap-2 min-w-0">
          <span className={`truncate font-minecraft text-sm font-bold tracking-wide ${isEnabled ? 'text-white' : 'text-[#727B8E]'}`}>
            {displayName}
          </span>
          <UpdateBadge hasUpdate={mod.hasUpdate} updateVersionName={mod.updateVersionName} />
          <MissingDependencyBadge missing={missingDependencies} />
          <DependentsBadge dependentsCount={dependentsCount} />
        </div>

        {/* 次要信息：文件实际名称 (清晰的次级钢蓝灰字，严格单行截断) */}
        <div className={`truncate font-minecraft text-[11px] mt-1 select-text ${isEnabled ? 'text-[#828EA4] group-hover:text-[#A8B5CD]' : 'text-[#535B6D]'}`}>
          {mod.fileName}
        </div>
      </div>

      {/* 4. 版本 (130px) */}
      <div className="flex items-center min-w-0">
        <VersionBadge version={mod.version} isEnabled={isEnabled} />
      </div>

      {/* 5. 大小 (80px) */}
      <div className={`font-minecraft text-xs ${isEnabled ? 'text-[#BAC7DD]' : 'text-[#5C667A]'}`}>
        {formattedSize}
      </div>

      {/* 6. 修改时间 (110px) */}
      <div className={`font-minecraft text-xs ${isEnabled ? 'text-[#8895AC]' : 'text-[#535B6D]'}`}>
        {dateStr}
      </div>

      {/* 7. 操作列 (120px) */}
      <div className="flex items-center justify-end">
        {trailing}
      </div>
    </div>
  );
};
