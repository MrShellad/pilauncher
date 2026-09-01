import React from 'react';
import { Boxes, Check, Info, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FocusItem } from '../../../../../../../../ui/focus/FocusItem';
import { OreOverlayScrollArea } from '../../../../../../../../ui/primitives/OreOverlayScrollArea';
import { type ModMeta } from '../../../../../../logic/modService';
import { getModFormattedDate, getModFormattedSize } from '../../../modListShared';
import { ModRelationshipIcon } from './ModRelationshipIcon';

export interface DependencyItem {
  id: string;
  name: string;
  type: string;
  isInstalled: boolean;
  platform?: 'modrinth' | 'curseforge';
  installedMod?: ModMeta;
}

interface ModOverviewTabProps {
  mod: ModMeta;
  displayMod: ModMeta | null;
  dependencies: DependencyItem[];
  instanceDependents: string[];
  allMods: ModMeta[];
  instanceId?: string;
  isFetchingDependencyProject: boolean;
  onDependencyClick: (dep: DependencyItem) => void;
}

type RelationshipTone = 'installed' | 'missing' | 'optional' | 'dependent';

const RELATIONSHIP_TONES: Record<RelationshipTone, { card: string; badge: string }> = {
  installed: {
    card: 'bg-[#2E5E22] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_0_#1D4D13]',
    badge: 'bg-[#1D4D13] text-[#A6F08B]',
  },
  missing: {
    card: 'bg-[#6E2B2B] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_0_#4D1818]',
    badge: 'bg-[#4D1818] text-[#FFC4C4]',
  },
  optional: {
    card: 'bg-[#3E3F40] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-2px_0_rgba(0,0,0,0.3)]',
    badge: 'bg-[#2B2C2D] text-[#D0D1D4]',
  },
  dependent: {
    card: 'bg-[#243B57] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-2px_0_#16283C]',
    badge: 'bg-[#16283C] text-[#A8CEFF]',
  },
};

interface RelationshipCardProps {
  id: string;
  name: string;
  tone: RelationshipTone;
  status: string;
  platform?: DependencyItem['platform'];
  installedMod?: ModMeta;
  instanceId?: string;
  onClick?: () => void;
  disabled?: boolean;
  focused?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

const RelationshipCard: React.FC<RelationshipCardProps> = ({
  id,
  name,
  tone,
  status,
  platform,
  installedMod,
  instanceId,
  onClick,
  disabled = false,
  focused = false,
  buttonRef,
}) => {
  const theme = RELATIONSHIP_TONES[tone];
  const className = `flex h-[52px] min-h-[52px] items-center justify-between gap-2.5 border-[2px] border-[#1E1E1F] px-2.5 py-1.5 text-left font-minecraft transition-none outline-none select-none ${theme.card} ${
    onClick ? 'cursor-pointer hover:brightness-110 active:translate-y-[1px]' : ''
  } ${focused ? 'outline outline-2 outline-white outline-offset-1 z-10' : ''}`;

  const content = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <ModRelationshipIcon
          id={id}
          name={name}
          platform={platform}
          installedMod={installedMod}
          instanceId={instanceId}
        />
        <div className="flex min-w-0 flex-col justify-center">
          <span className="truncate text-xs font-bold text-white ore-text-shadow leading-tight">{name}</span>
          <span className="truncate font-mono text-[10px] text-white/70 leading-tight">{id}</span>
        </div>
      </div>
      <span className={`shrink-0 border-[2px] border-[#1E1E1F] px-1.5 py-0.5 text-[10px] font-bold uppercase ${theme.badge}`}>
        {status}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button ref={buttonRef} type="button" onClick={onClick} disabled={disabled} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
};

export const ModOverviewTab: React.FC<ModOverviewTabProps> = ({
  mod,
  displayMod,
  dependencies,
  instanceDependents,
  allMods,
  instanceId,
  isFetchingDependencyProject,
  onDependencyClick
}) => {
  const { t } = useTranslation();
  const targetMod = displayMod || mod;

  const formattedSize = getModFormattedSize(targetMod);
  const formattedDate = getModFormattedDate(targetMod.modifiedAt);
  const sha1 = targetMod.sha1 || '-';

  const dependentsSection = instanceDependents.length > 0 && (
    <div
      className="flex flex-col border-[2px] border-[#1E1E1F] bg-[#2B2C2D] p-3.5 font-minecraft"
      style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.35)' }}
    >
      <div className="flex items-center gap-2 border-b-[2px] border-[#1E1E1F] pb-2 text-xs font-bold uppercase tracking-wider text-[#8CB3FF] ore-text-shadow">
        <Boxes size={14} className="shrink-0" />
        <span>{t('instanceDetail.mods.detail.dependents', { defaultValue: '作为以下 {{count}} 个已安装模组的前置依赖', count: instanceDependents.length })}</span>
        <span className="border-[2px] border-[#1E1E1F] bg-[#1E2024] px-1.5 py-0.5 text-[10px] font-bold text-[#8CB3FF]">
          {instanceDependents.length}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {instanceDependents.map((depFileName) => {
          const depMod = (allMods || []).find((m) => m.fileName === depFileName);
          const name = depMod?.name || depMod?.networkInfo?.title || depFileName;
          return (
            <RelationshipCard
              key={depFileName}
              id={depFileName}
              name={name}
              tone="dependent"
              status="附属"
              installedMod={depMod}
              instanceId={instanceId}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <OreOverlayScrollArea
      className="h-full w-full bg-[var(--ore-modal-bg)]"
      viewportClassName="p-4 sm:p-5 flex flex-col gap-3.5 shadow-[inset_0_10px_20px_-10px_rgba(0,0,0,0.55)]"
      contentSafePaddingRight={6}
    >
      {/* 1. 基础属性与物理文件 (扁平化清晰属性面板) */}
      <div
        className="flex flex-col border-[2px] border-[#1E1E1F] bg-[#2B2C2D] p-3.5 font-minecraft"
        style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.35)' }}
      >
        <div className="flex items-center gap-2 border-b-[2px] border-[#1E1E1F] pb-2 text-xs font-bold uppercase tracking-wider text-white ore-text-shadow">
          <Info size={14} />
          <span>基础属性与物理文件</span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {/* 文件名 */}
          <div className="flex flex-col gap-0.5 border-[2px] border-[#1E1E1F] bg-[#3B3C3D] px-3 py-2 sm:col-span-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <span className="text-[10px] font-bold uppercase text-[#A0A1A4]">文件名</span>
            <span className="truncate text-xs font-bold text-white select-text" title={targetMod.fileName}>
              {targetMod.fileName}
            </span>
          </div>

          {/* 模组 ID */}
          <div className="flex flex-col gap-0.5 border-[2px] border-[#1E1E1F] bg-[#3B3C3D] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <span className="text-[10px] font-bold uppercase text-[#A0A1A4]">模组 ID</span>
            <span className="truncate text-xs font-bold text-[#6CC349] select-text">
              {targetMod.modId || '-'}
            </span>
          </div>

          {/* 文件大小 */}
          <div className="flex flex-col gap-0.5 border-[2px] border-[#1E1E1F] bg-[#3B3C3D] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <span className="text-[10px] font-bold uppercase text-[#A0A1A4]">文件大小</span>
            <span className="text-xs font-bold text-white">
              {formattedSize}
            </span>
          </div>

          {/* 最后修改时间 */}
          <div className="flex flex-col gap-0.5 border-[2px] border-[#1E1E1F] bg-[#3B3C3D] px-3 py-2 sm:col-span-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <span className="text-[10px] font-bold uppercase text-[#A0A1A4]">最后修改时间</span>
            <span className="text-xs font-bold text-white">
              {formattedDate}
            </span>
          </div>

          {/* SHA-1 校验码 */}
          <div className="flex flex-col gap-0.5 border-[2px] border-[#1E1E1F] bg-[#3B3C3D] px-3 py-2 sm:col-span-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <span className="text-[10px] font-bold uppercase text-[#A0A1A4]">SHA-1 哈希指纹</span>
            <span className="truncate font-mono text-xs font-bold text-white select-text" title={sha1}>
              {sha1}
            </span>
          </div>
        </div>
      </div>

      {/* 2. 前置依赖声明 */}
      <div
        className="flex flex-1 flex-col border-[2px] border-[#1E1E1F] bg-[#2B2C2D] p-3.5 font-minecraft min-h-[12rem]"
        style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.35)' }}
      >
        <div className="flex items-center justify-between border-b-[2px] border-[#1E1E1F] pb-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white ore-text-shadow">
            <Link2 size={14} />
            <span>{t('instanceDetail.mods.detail.dependencies', { defaultValue: '前置依赖声明' })}</span>
            <span className="border-[2px] border-[#1E1E1F] bg-[#1E2024] px-1.5 py-0.5 text-[10px] font-bold text-[#D0D1D4]">
              {dependencies.length}
            </span>
          </div>
          {dependencies.length > 0 && (
            <span className="text-[11px] text-[#A0A1A4]">
              点击未安装前置可一键下载
            </span>
          )}
        </div>

        {dependencies.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dependencies.map((dep, idx) => {
              const tone: RelationshipTone = dep.isInstalled
                ? 'installed'
                : dep.type === 'optional'
                  ? 'optional'
                  : 'missing';
              const status = dep.isInstalled ? '已安装' : dep.type === 'optional' ? '可选' : '未安装';
              return (
                <FocusItem key={dep.id} focusKey={`mod-dep-item-${idx}`} onEnter={() => onDependencyClick(dep)}>
                  {({ ref, focused }) => (
                    <RelationshipCard
                      buttonRef={ref as React.Ref<HTMLButtonElement>}
                      id={dep.id}
                      name={dep.name}
                      tone={tone}
                      status={status}
                      platform={dep.platform}
                      installedMod={dep.installedMod}
                      instanceId={instanceId}
                      onClick={() => onDependencyClick(dep)}
                      disabled={isFetchingDependencyProject}
                      focused={focused}
                    />
                  )}
                </FocusItem>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-[#A0A1A4]">
            <Check size={26} className="opacity-80" />
            <span className="mt-2 text-xs font-bold">该模组无声明的前置依赖项</span>
          </div>
        )}
      </div>

      {/* 3. 附属 MOD */}
      {dependentsSection}
    </OreOverlayScrollArea>
  );
};

export default ModOverviewTab;
