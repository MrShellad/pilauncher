import React from 'react';
import { AlertTriangle, Boxes, Check, Info, Layers, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FocusItem } from '../../../../../../../../ui/focus/FocusItem';
import { OreOverlayScrollArea } from '../../../../../../../../ui/primitives/OreOverlayScrollArea';
import { type ModMeta } from '../../../../../../logic/modService';
import { getModFormattedDate, getModFormattedSize } from '../../../modListShared';

export interface DependencyItem {
  id: string;
  name: string;
  type: string;
  isInstalled: boolean;
}

interface ModOverviewTabProps {
  mod: ModMeta;
  displayMod: ModMeta | null;
  dependencies: DependencyItem[];
  instanceDependents: string[];
  allMods: ModMeta[];
  isFetchingDependencyProject: boolean;
  onDependencyClick: (dep: DependencyItem) => void;
}

export const ModOverviewTab: React.FC<ModOverviewTabProps> = ({
  mod,
  displayMod,
  dependencies,
  instanceDependents,
  allMods,
  isFetchingDependencyProject,
  onDependencyClick
}) => {
  const { t } = useTranslation();
  const targetMod = displayMod || mod;

  const formattedSize = getModFormattedSize(targetMod);
  const formattedDate = getModFormattedDate(targetMod.modifiedAt);
  const sha1 = targetMod.sha1 || '-';

  return (
    <OreOverlayScrollArea
      className="h-full w-full bg-[var(--ore-modal-bg)]"
      viewportClassName="p-4 sm:p-5 flex flex-col gap-4 shadow-[inset_0_10px_20px_-10px_rgba(0,0,0,0.55)]"
      contentSafePaddingRight={6}
    >
      {/* 1. 被依赖反向拓扑提示条 (如有已安装模组依赖此模组) */}
      {instanceDependents.length > 0 && (
        <div
          className="flex flex-col border-[2px] border-[#1E1E1F] bg-[#222324] p-3.5 font-minecraft"
          style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)' }}
        >
          <div className="flex items-center gap-2 text-xs font-bold text-[#8CB3FF] ore-text-shadow">
            <Boxes size={15} className="shrink-0 text-[#8CB3FF]" />
            <span>{t('instanceDetail.mods.detail.dependents', { defaultValue: '作为以下 {{count}} 个已安装模组的前置依赖', count: instanceDependents.length })}</span>
            <span className="border-[2px] border-[#1E1E1F] bg-[#1E2024] px-1.5 py-0.5 text-[10px] font-bold text-[#8CB3FF]">
              {instanceDependents.length}
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {instanceDependents.map((depFileName) => {
              const depMod = (allMods || []).find((m) => m.fileName === depFileName);
              const name = depMod?.name || depMod?.networkInfo?.title || depFileName;
              return (
                <span
                  key={depFileName}
                  className="inline-flex items-center gap-1.5 border-[2px] border-[#1E1E1F] bg-[#48494A] px-2 py-1 font-minecraft text-xs font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_0_rgba(0,0,0,0.3)]"
                >
                  <Layers size={11} className="text-[#8CB3FF]" />
                  <span>{name}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. 物理与基本属性卡片 */}
      <div
        className="flex flex-col border-[2px] border-[#1E1E1F] bg-[#222324] p-4 font-minecraft"
        style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)' }}
      >
        <div className="flex items-center gap-2 border-b-[2px] border-[#1E1E1F] pb-2 text-xs font-bold uppercase tracking-wider text-white ore-text-shadow">
          <Info size={14} className="text-[#6CC349]" />
          <span>基础属性与物理文件</span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {/* 文件名 */}
          <div className="flex flex-col gap-1 border-[2px] border-[#1E1E1F] bg-[#48494A] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_0_rgba(0,0,0,0.3)]">
            <span className="text-[10px] font-bold uppercase text-[#D0D1D4]">文件名</span>
            <span className="truncate text-xs font-bold text-white select-text" title={targetMod.fileName}>
              {targetMod.fileName}
            </span>
          </div>

          {/* 模组 ID */}
          <div className="flex flex-col gap-1 border-[2px] border-[#1E1E1F] bg-[#48494A] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_0_rgba(0,0,0,0.3)]">
            <span className="text-[10px] font-bold uppercase text-[#D0D1D4]">模组 ID</span>
            <span className="truncate text-xs font-bold text-[#6CC349] select-text">
              {targetMod.modId || '-'}
            </span>
          </div>

          {/* 文件大小 */}
          <div className="flex flex-col gap-1 border-[2px] border-[#1E1E1F] bg-[#48494A] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_0_rgba(0,0,0,0.3)]">
            <span className="text-[10px] font-bold uppercase text-[#D0D1D4]">文件大小</span>
            <span className="text-xs font-bold text-white">
              {formattedSize}
            </span>
          </div>

          {/* 修改时间 */}
          <div className="flex flex-col gap-1 border-[2px] border-[#1E1E1F] bg-[#48494A] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_0_rgba(0,0,0,0.3)]">
            <span className="text-[10px] font-bold uppercase text-[#D0D1D4]">最后修改时间</span>
            <span className="text-xs font-bold text-white">
              {formattedDate}
            </span>
          </div>

          {/* SHA-1 校验码 */}
          <div className="flex flex-col gap-1 border-[2px] border-[#1E1E1F] bg-[#48494A] p-2.5 sm:col-span-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_0_rgba(0,0,0,0.3)]">
            <span className="text-[10px] font-bold uppercase text-[#D0D1D4]">SHA-1 哈希指纹</span>
            <span className="truncate font-mono text-xs font-bold text-white select-text" title={sha1}>
              {sha1}
            </span>
          </div>
        </div>
      </div>

      {/* 3. 前置依赖关系矩阵 */}
      <div
        className="flex flex-1 flex-col border-[2px] border-[#1E1E1F] bg-[#222324] p-4 font-minecraft min-h-[14rem]"
        style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)' }}
      >
        <div className="flex items-center justify-between border-b-[2px] border-[#1E1E1F] pb-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white ore-text-shadow">
            <Link2 size={14} className="text-[#FFB84D]" />
            <span>{t('instanceDetail.mods.detail.dependencies', { defaultValue: '前置依赖声明' })}</span>
            <span className="border-[2px] border-[#1E1E1F] bg-[#1E2024] px-1.5 py-0.5 text-[10px] font-bold text-[#D0D1D4]">
              {dependencies.length}
            </span>
          </div>
          {dependencies.length > 0 && (
            <span className="text-[11px] text-[#B1B2B5]">
              点击未安装前置可一键下载
            </span>
          )}
        </div>

        {dependencies.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {dependencies.map((dep, idx) => (
              <FocusItem key={dep.id} focusKey={`mod-dep-item-${idx}`} onEnter={() => onDependencyClick(dep)}>
                {({ ref, focused }) => (
                  <button
                    ref={ref}
                    type="button"
                    onClick={() => onDependencyClick(dep)}
                    disabled={isFetchingDependencyProject}
                    className={`flex items-center justify-between gap-2.5 border-[2px] border-[#1E1E1F] p-2.5 text-left transition-none select-none outline-none cursor-pointer ${
                      dep.isInstalled
                        ? 'bg-[#3C8527] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.25),inset_0_-3px_0_#1D4D13] hover:bg-[#489930]'
                        : dep.type === 'optional'
                          ? 'bg-[#48494A] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.3)] hover:bg-[#58595B]'
                          : 'bg-[#8C3636] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.2),inset_0_-3px_0_#5E1E1E] hover:bg-[#A34040]'
                    } ${focused ? 'outline outline-2 outline-white outline-offset-1 z-10' : ''}`}
                  >
                    {/* 左侧：图标 + 依赖名称 */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {dep.isInstalled ? (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#1D4D13] text-[#6CC349]">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      ) : dep.type === 'optional' ? (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#313233] text-[#B1B2B5]">
                          <Info size={12} />
                        </div>
                      ) : (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#5E1E1E] text-[#FF9E9E]">
                          <AlertTriangle size={12} strokeWidth={3} />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-xs font-bold text-white ore-text-shadow">
                          {dep.name}
                        </span>
                        <span className="truncate font-mono text-[10px] text-[#D0D1D4]/80">
                          {dep.id}
                        </span>
                      </div>
                    </div>

                    {/* 右侧：状态药丸 */}
                    <span
                      className={`shrink-0 border-[2px] border-[#1E1E1F] px-1.5 py-0.5 font-minecraft text-[10px] font-bold uppercase ${
                        dep.isInstalled
                          ? 'bg-[#1D4D13] text-[#6CC349]'
                          : dep.type === 'optional'
                            ? 'bg-[#313233] text-[#D0D1D4]'
                            : 'bg-[#5E1E1E] text-[#FF9E9E]'
                      }`}
                    >
                      {dep.isInstalled ? '已安装' : dep.type === 'optional' ? '可选' : '未安装'}
                    </span>
                  </button>
                )}
              </FocusItem>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-[#B1B2B5]">
            <Check size={28} className="text-[#6CC349] opacity-80" />
            <span className="mt-2 text-xs font-bold">该模组无声明的前置依赖项</span>
          </div>
        )}
      </div>
    </OreOverlayScrollArea>
  );
};

export default ModOverviewTab;