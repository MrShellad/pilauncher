import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Package,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

import { OreButton } from '@/ui/primitives/OreButton';
import { OreProgressBar } from '@/ui/primitives/OreProgressBar';
import { OreTag } from '@/ui/primitives/OreTag';
import type { ExportStatus } from './exportConfirmationTypes';

interface ExportExecutionStatusProps {
  status: ExportStatus;
  percent: number;
  stageLabel: string;
  progressMessage: string;
  outputDir: string;
  warnings: string[];
  errorMessage: string;
  onCancel: () => void;
  onOpenOutputDirectory: () => void;
  onBack: () => void;
  onRetry: () => void;
}

export const ExportExecutionStatus: React.FC<ExportExecutionStatusProps> = ({
  status,
  percent,
  stageLabel,
  progressMessage,
  outputDir,
  warnings,
  errorMessage,
  onCancel,
  onOpenOutputDirectory,
  onBack,
  onRetry,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {status === 'exporting' && (
        <div className="flex flex-col items-center justify-center space-y-7 border-[3px] border-[#1E1E1F] bg-[#48494A] p-8 shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)] sm:p-12">
          <div className="relative flex h-28 w-28 items-center justify-center border-[3px] border-[#1E1E1F] bg-[#222324] shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),0_0_28px_rgba(60,133,39,0.3)]">
            <div className="absolute inset-1.5 animate-pulse border border-[#3C8527]/50 bg-[#244A1B]/30" />

            <motion.div
              animate={{ y: [-3, 3, -3], rotate: [-1.5, 1.5, -1.5] }}
              transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
              className="relative z-10 flex items-center justify-center"
            >
              <Package
                size={52}
                className="text-[#6CC349] drop-shadow-[0_4px_12px_rgba(108,195,73,0.6)]"
              />
            </motion.div>

            <Sparkles
              size={16}
              className="absolute -right-2 -top-2 z-20 animate-bounce text-[#FFE866]"
            />
          </div>

          <div className="max-w-lg space-y-2 text-center">
            <div className="flex items-center justify-center gap-2">
              <OreTag variant="success" size="sm" weight="bold">
                {stageLabel}
              </OreTag>
              <span className="text-xs font-bold text-[#8C8D90]">阶段进行中</span>
            </div>
            <h4 className="ore-text-shadow text-lg font-bold uppercase tracking-wider text-white sm:text-xl">
              {t('instanceDetail.export.confirm.exporting', {
                defaultValue: '正在打包导出整合包...',
              })}
            </h4>
          </div>

          <div
            className="w-full max-w-lg truncate border-[2px] border-[#1E1E1F] bg-[#141517] px-4 py-2.5 text-center font-['JetBrains_Mono',monospace] text-xs text-[#D0D1D4] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
            title={progressMessage}
          >
            {progressMessage}
          </div>

          <div className="w-full max-w-lg space-y-2.5">
            <OreProgressBar percent={percent} showPercentage={false} size="md" className="w-full" />
            <div
              className="flex items-center justify-between font-['JetBrains_Mono',monospace] text-xs text-[#D0D1D4] sm:text-sm"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              <span className="text-[#8C8D90]">
                {t('instanceDetail.export.confirm.currentStageLabel', {
                  defaultValue: '当前进度',
                })}
              </span>
              <span className="text-base font-bold text-[#6CC349]">{percent}%</span>
            </div>
          </div>

          <OreButton variant="danger" size="md" onClick={onCancel} className="min-w-[8rem]">
            <X size={16} className="mr-1.5" />
            <span>{t('common.cancel', { defaultValue: '取消打包' })}</span>
          </OreButton>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center justify-center space-y-7 border-[3px] border-[#1E1E1F] bg-[#48494A] p-8 text-center shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)] sm:p-12">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center border-[3px] border-[#1E1E1F] bg-[#3C8527] shadow-[inset_0_2px_0_#6CC349,inset_0_-2px_0_#1D4D13]">
            <CheckCircle2 size={44} className="text-white" />
          </div>

          <div className="max-w-lg space-y-2">
            <h4 className="ore-text-shadow text-2xl font-bold uppercase tracking-wider text-white">
              {t('instanceDetail.export.confirm.exportSuccess', {
                defaultValue: '整合包导出完成',
              })}
            </h4>
            <div
              className="break-all border-[2px] border-[#1E1E1F] bg-[#141517] p-3 font-['JetBrains_Mono',monospace] text-xs text-[#6CC349] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] sm:text-sm"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              {outputDir}
            </div>
            {warnings.length > 0 && (
              <p className="mx-auto mt-2 text-xs text-[#FFE866]">{warnings[0]}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
            <OreButton
              focusKey="export-success-dir-btn"
              variant="secondary"
              size="md"
              onClick={onOpenOutputDirectory}
            >
              <ExternalLink size={18} className="mr-2" />
              <span>
                {t('instanceDetail.export.confirm.openDir', {
                  defaultValue: '打开输出目录',
                })}
              </span>
            </OreButton>
            <OreButton
              focusKey="export-success-back-btn"
              variant="primary"
              size="md"
              onClick={onBack}
            >
              <RotateCcw size={18} className="mr-2" />
              <span>
                {t('instanceDetail.export.confirm.backToSettings', {
                  defaultValue: '返回导出设置',
                })}
              </span>
            </OreButton>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center justify-center space-y-6 border-[3px] border-[#1E1E1F] bg-[#48494A] p-8 text-center shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)]">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center border-[3px] border-[#1E1E1F] bg-[#C33636] text-white">
            <AlertTriangle size={36} />
          </div>

          <div className="space-y-1.5">
            <h4 className="ore-text-shadow text-xl font-bold uppercase tracking-wider text-white">
              {t('instanceDetail.export.confirm.exportError', {
                defaultValue: '打包任务异常终止',
              })}
            </h4>
          </div>

          <div
            className="max-h-40 max-w-xl overflow-y-auto border-[2px] border-[#1E1E1F] bg-[#141517] p-4 text-left font-['JetBrains_Mono',monospace] text-xs text-[#FF9E9E] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {errorMessage}
          </div>

          <OreButton
            focusKey="export-error-retry-btn"
            variant="secondary"
            size="md"
            onClick={onRetry}
          >
            <RotateCcw size={18} className="mr-2" />
            <span>
              {t('instanceDetail.export.confirm.backAndRetry', {
                defaultValue: '返回并重试',
              })}
            </span>
          </OreButton>
        </div>
      )}
    </>
  );
};
