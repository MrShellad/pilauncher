import React from 'react';
import { Download, Folder, Layers, List, Package, Tag, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { OreButton } from '@/ui/primitives/OreButton';
import { OreTag } from '@/ui/primitives/OreTag';
import type { ExportData } from './ExportPanel';

interface ExportConfirmationSummaryProps {
  data: ExportData;
  formatLabel: string;
  effectiveManifestMode: boolean;
  contentList: string[];
  outputDir: string;
  outputFileName: string;
  onChangeOutputDir: () => void;
  onStartExport: () => void;
}

export const ExportConfirmationSummary: React.FC<ExportConfirmationSummaryProps> = ({
  data,
  formatLabel,
  effectiveManifestMode,
  contentList,
  outputDir,
  outputFileName,
  onChangeOutputDir,
  onStartExport,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col space-y-4">
      <div className="space-y-4 border-[3px] border-[#1E1E1F] bg-[#48494A] p-5 shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#1E1E1F] pb-3.5">
          <div className="flex items-center gap-2">
            <List size={16} className="text-[#6CC349]" />
            <span className="text-sm font-bold uppercase tracking-wider text-white">
              {t('instanceDetail.export.confirm.summaryTitle', {
                defaultValue: '导出信息平铺摘要',
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <OreTag variant="success" size="sm" weight="bold">
              {formatLabel}
            </OreTag>
            {effectiveManifestMode && (
              <OreTag variant="neutral" size="sm" weight="bold">
                Manifest 索引模式
              </OreTag>
            )}
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-[2px] border-[#1E1E1F] bg-[#222324] p-4 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-4 sm:flex-row sm:items-center">
            {data.heroLogo ? (
              <div className="flex h-14 w-36 shrink-0 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#141517] p-1.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] sm:w-44">
                <img
                  src={data.heroLogo}
                  alt="Hero Logo"
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#141517] text-[#6CC349] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
                <Package size={24} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-[#8C8D90]">
                {t('instanceDetail.export.confirm.packName', {
                  defaultValue: '整合包名称',
                })}
              </div>
              <h3 className="break-words text-base font-bold leading-tight text-white sm:text-lg">
                {data.name || '未命名整合包'}
              </h3>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-wrap items-center gap-3 border-t border-[#1E1E1F] pt-2 sm:w-auto sm:border-t-0 sm:pt-0">
            <div className="flex items-center gap-1.5 border border-[#1E1E1F] bg-[#141517] px-3 py-1.5">
              <Tag size={13} className="text-[#6CC349]" />
              <span className="text-xs text-[#8C8D90]">版本:</span>
              <span
                className="font-['JetBrains_Mono',monospace] text-xs font-bold text-white"
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
              >
                {data.version || '1.0.0'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 border border-[#1E1E1F] bg-[#141517] px-3 py-1.5">
              <User size={13} className="text-[#6CC349]" />
              <span className="text-xs text-[#8C8D90]">作者:</span>
              <span className="text-xs font-bold text-[#E6E8EB]">
                {data.author || 'Player'}
              </span>
            </div>
          </div>
        </div>

        <div className="border-[2px] border-[#1E1E1F] bg-[#313233] p-3.5 shadow-[inset_0_2px_0_rgba(255,255,255,0.08)]">
          <div className="mb-2 flex items-center gap-2">
            <Layers size={14} className="text-[#6CC349]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#D0D1D4]">
              {t('instanceDetail.export.confirm.includeContent', {
                defaultValue: '包含的导出模块与附件',
              })}
            </span>
            <span className="text-xs text-[#8C8D90]">({contentList.length} 项)</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {contentList.length > 0 ? (
              contentList.map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="border border-[#1E1E1F] bg-[#222324] px-3 py-1 text-xs font-bold text-[#E6E8EB] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
                >
                  {item}
                </div>
              ))
            ) : (
              <span className="text-xs text-[#FF9E9E]">未勾选任何导出内容</span>
            )}
          </div>

          {data.description && (
            <div className="mt-3 border-t border-[#1E1E1F] pt-2.5 text-xs leading-relaxed text-[#8C8D90]">
              <span className="mr-1 font-bold text-[#D0D1D4]">描述说明:</span>
              {data.description}
            </div>
          )}
        </div>
      </div>

      <div className="border-[3px] border-[#1E1E1F] bg-[#313233] p-5 shadow-[inset_0_2px_0_rgba(255,255,255,0.08)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 space-y-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-[#1E1E1F] pb-2">
              <div className="flex items-center text-xs font-bold uppercase tracking-wider text-[#D0D1D4]">
                <Folder size={15} className="mr-1.5 text-[#6CC349]" />
                <span>
                  {t('instanceDetail.export.confirm.exportPath', {
                    defaultValue: '导出目标路径',
                  })}
                </span>
              </div>
              <OreButton size="sm" variant="secondary" onClick={onChangeOutputDir}>
                <span>
                  {t('instanceDetail.export.confirm.changePath', {
                    defaultValue: '更改目标目录',
                  })}
                </span>
              </OreButton>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="border-[2px] border-[#1E1E1F] bg-[#141517] p-2.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
                <div className="mb-0.5 text-[10px] uppercase text-[#8C8D90]">目标目录</div>
                <div
                  className="break-all font-['JetBrains_Mono',monospace] text-xs text-[#D0D1D4]"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  title={outputDir}
                >
                  {outputDir || '正在获取默认路径...'}
                </div>
              </div>

              <div className="border-[2px] border-[#1E1E1F] bg-[#141517] p-2.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
                <div className="mb-0.5 text-[10px] uppercase text-[#8C8D90]">生成文件名</div>
                <div
                  className="break-all font-['JetBrains_Mono',monospace] text-xs font-bold text-[#6CC349]"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  {outputFileName}
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end md:pl-4">
            <OreButton
              disabled={!outputDir || contentList.length === 0}
              variant="primary"
              size="md"
              onClick={onStartExport}
              className="h-[3.25rem] w-full min-w-[14rem] md:w-auto"
            >
              <Download size={20} className="mr-2" />
              <span className="text-base font-bold">
                {t('instanceDetail.export.confirm.startExport', {
                  defaultValue: '立即执行打包',
                })}
              </span>
            </OreButton>
          </div>
        </div>
      </div>
    </div>
  );
};
