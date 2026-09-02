import React from 'react';
import { FileArchive, Lock, Package, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { CurseforgeIcon, ModrinthIcon } from '../../../../Download/components/Icons';
import { OreSwitch } from '../../../../../ui/primitives/OreSwitch';
import { OreTag } from '../../../../../ui/primitives/OreTag';
import type { ExportData } from './ExportPanel';

interface ExportOptimizationStepProps {
  data: ExportData;
  onChange: (data: Partial<ExportData>) => void;
}

export const ExportOptimizationStep: React.FC<ExportOptimizationStepProps> = ({
  data,
  onChange,
}) => {
  const { t } = useTranslation();

  const handleFormatSelect = (format: ExportData['format']) => {
    if (format === 'pipack') {
      onChange({ format, manifestMode: true });
      return;
    }

    if (format === 'zip') {
      onChange({ format, manifestMode: false });
      return;
    }

    onChange({ format });
  };

  const formats: {
    id: ExportData['format'];
    label: string;
    desc: string;
    icon: React.FC<any>;
    badge?: string;
  }[] = [
    {
      id: 'pipack',
      label: t('instanceExport.optimization.formats.pipack.label', { defaultValue: 'PiPack' }),
      desc: t('instanceExport.optimization.formats.pipack.desc', {
        defaultValue: '专属智能格式，支持混合来源 Mod 恢复与高效分发',
      }),
      icon: Package,
      badge: '推荐',
    },
    {
      id: 'zip',
      label: t('instanceExport.optimization.formats.zip.label', { defaultValue: 'Standard ZIP' }),
      desc: t('instanceExport.optimization.formats.zip.desc', {
        defaultValue: '通用标准压缩包，包含所有完整文件，兼容所有启动器',
      }),
      icon: FileArchive,
    },
    {
      id: 'curseforge',
      label: t('instanceExport.optimization.formats.curseforge.label', {
        defaultValue: 'CurseForge',
      }),
      desc: t('instanceExport.optimization.formats.curseforge.desc', {
        defaultValue: '导出带 manifest.json 的标准 CurseForge 格式整合包',
      }),
      icon: CurseforgeIcon,
    },
    {
      id: 'mrpack',
      label: t('instanceExport.optimization.formats.mrpack.label', {
        defaultValue: 'Modrinth (mrpack)',
      }),
      desc: t('instanceExport.optimization.formats.mrpack.desc', {
        defaultValue: '导出兼容 Modrinth 标准的 mrpack 格式整合包',
      }),
      icon: ModrinthIcon,
    },
  ];

  const manifestLocked = data.format === 'pipack' || data.format === 'zip';
  const manifestChecked =
    data.format === 'pipack' ? true : data.format === 'zip' ? false : data.manifestMode;
  const manifestDescriptionKey =
    data.format === 'zip'
      ? 'instanceExport.optimization.manifest.zipLocked'
      : data.format === 'pipack'
        ? 'instanceExport.optimization.manifest.pipackLocked'
        : 'instanceExport.optimization.manifest.fallback';

  return (
    <div className="w-full max-w-4xl xl:max-w-5xl mx-auto flex flex-col space-y-4 font-minecraft select-none">
      {/* 1. 导出格式 3D 磁贴单列排列 (清晰通透，单列大气) */}
      <div className="flex flex-col space-y-2.5">
        {formats.map((formatItem) => {
          const isSelected = data.format === formatItem.id;
          return (
            <FocusItem
              key={formatItem.id}
              focusKey={`export-format-${formatItem.id}`}
              onEnter={() => handleFormatSelect(formatItem.id)}
            >
              {({ ref, focused }) => (
                <button
                  ref={ref as any}
                  type="button"
                  onClick={() => handleFormatSelect(formatItem.id)}
                  className={`flex w-full cursor-pointer items-center justify-between border-[2px] border-[#1E1E1F] p-3 sm:p-3.5 text-left transition-none select-none focus:outline-none active:translate-y-[1px] ${
                    focused ? 'ring-2 ring-white z-10 brightness-110' : ''
                  } ${
                    isSelected
                      ? 'bg-[#3C8527] text-white shadow-[inset_0_-3px_0_#1D4D13,inset_0_2px_0_#6CC349]'
                      : 'bg-[#48494A] text-[#D0D1D4] shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)] hover:bg-[#525354]'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* 图标槽 */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center border-[2px] border-[#1E1E1F] ${
                        isSelected ? 'bg-[#244A1B]' : 'bg-[#222324]'
                      } shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]`}
                    >
                      <formatItem.icon
                        className={`h-5 w-5 ${
                          isSelected ? 'text-white' : 'text-[#6CC349]'
                        }`}
                      />
                    </div>

                    {/* 文本区域 */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm sm:text-base font-bold tracking-wide">
                          {formatItem.label}
                        </span>
                        {formatItem.badge && (
                          <OreTag variant="success" size="sm" weight="bold">
                            {formatItem.badge}
                          </OreTag>
                        )}
                      </div>
                      <div
                        className={`text-xs truncate sm:text-ellipsis ${
                          isSelected ? 'text-white/90' : 'text-[#8C8D90]'
                        }`}
                      >
                        {formatItem.desc}
                      </div>
                    </div>
                  </div>

                  {/* 单选指示器 */}
                  <div className="shrink-0 pl-3">
                    <div
                      className={`flex h-5 w-5 items-center justify-center border-[2px] border-[#1E1E1F] ${
                        isSelected
                          ? 'bg-[#244A1B] text-white'
                          : 'bg-[#1E1E1F] text-transparent'
                      } shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]`}
                    >
                      {isSelected && (
                        <div className="h-2 w-2 bg-[#6CC349]" />
                      )}
                    </div>
                  </div>
                </button>
              )}
            </FocusItem>
          );
        })}
      </div>

      {/* 2. Manifest 优化控制矿槽 */}
      <div className="border-[2px] border-b-[4px] border-[#1E1E1F] bg-[#3B3C3D] p-3.5 sm:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#222324] text-[#A855F7] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
              <Sparkles size={20} />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-bold uppercase tracking-wider text-white">
                  {t('instanceExport.optimization.manifest.title', {
                    defaultValue: 'Manifest 清单优化模式',
                  })}
                </span>
                {manifestLocked && (
                  <span
                    className="flex items-center gap-1 text-[11px] text-[#FFE866] bg-black/40 px-2 py-0.5 border border-[#1E1E1F]"
                    title={
                      data.format === 'zip'
                        ? t('instanceDetail.export.optimization.manifestLockedZipTooltip', {
                            defaultValue: 'Standard ZIP 格式已固定禁用 Manifest 模式。',
                          })
                        : t('instanceDetail.export.optimization.manifestLockedPipackTooltip', {
                            defaultValue: 'PiPack 格式已固定启用 Manifest 模式。',
                          })
                    }
                  >
                    <Lock size={11} />
                    <span>格式固定</span>
                  </span>
                )}
              </div>

              <div className="text-xs leading-relaxed text-[#8C8D90]">
                <p>
                  {t('instanceExport.optimization.manifest.primary', {
                    defaultValue: '优先使用来源平台链接索引代替实际 Mod 文件打包，显著缩减导出包文件体积。',
                  })}
                </p>
                {manifestLocked && (
                  <p className={data.format === 'zip' ? 'text-[#D0D1D4]' : 'text-[#6CC349]'}>
                    {t(manifestDescriptionKey, {
                      defaultValue:
                        data.format === 'zip'
                          ? 'Standard ZIP 格式将全量打包所选文件。'
                          : 'PiPack 将自动生成智能清单并在导入时自动补全模组。',
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 pl-2">
            <OreSwitch
              checked={manifestChecked}
              onChange={(checked) => onChange({ manifestMode: checked })}
              disabled={manifestLocked}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportOptimizationStep;