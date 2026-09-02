import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import { OreOverlayScrollArea } from '../../../../../ui/primitives/OreOverlayScrollArea';
import { ExportBasicStep } from './ExportBasicStep';
import { ExportConfirmStep } from './ExportConfirmStep';
import { ExportContentStep } from './ExportContentStep';
import { ExportOptimizationStep } from './ExportOptimizationStep';

export interface ExportData {
  name: string;
  version: string;
  author: string;
  description: string;
  heroLogo?: string;
  includeMods: boolean;
  includeConfigs: boolean;
  includeResourcePacks: boolean;
  includeShaderPacks: boolean;
  includeSaves: boolean;
  additionalPaths: { path: string; type: 'file' | 'dir' }[];
  format: 'zip' | 'curseforge' | 'mrpack' | 'pipack';
  manifestMode: boolean;
}

interface ExportPanelProps {
  instanceId: string;
  defaultName?: string;
  defaultHeroLogo?: string;
  defaultVersion?: string;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 30 : direction < 0 ? -30 : 0,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -30 : direction < 0 ? 30 : 0,
    opacity: 0,
  }),
};

export const ExportPanel: React.FC<ExportPanelProps> = ({
  instanceId,
  defaultName,
  defaultHeroLogo,
  defaultVersion,
}) => {
  const { t } = useTranslation();
  const stepLabels = [
    t('instanceDetail.export.steps.basic', { defaultValue: '1. 基础信息' }),
    t('instanceDetail.export.steps.content', { defaultValue: '2. 导出内容' }),
    t('instanceDetail.export.steps.optimization', { defaultValue: '3. 格式优化' }),
    t('instanceDetail.export.steps.confirm', { defaultValue: '4. 最终确认' }),
  ];
  const [step, setStep] = useState(1);
  const [navigationDirection, setNavigationDirection] = useState(0);
  const initialized = useRef(false);

  const [data, setData] = useState<ExportData>({
    name: defaultName || 'My Modpack',
    version: defaultVersion || '1.0.0',
    author: 'Player',
    description: 'A custom modpack for PiLauncher.',
    heroLogo: defaultHeroLogo,
    includeMods: true,
    includeConfigs: true,
    includeResourcePacks: false,
    includeShaderPacks: false,
    includeSaves: false,
    additionalPaths: [],
    format: 'pipack',
    manifestMode: true,
  });

  useEffect(() => {
    if ((defaultName || defaultVersion || defaultHeroLogo) && !initialized.current) {
      setData((prev) => ({
        ...prev,
        name: defaultName || prev.name,
        version: defaultVersion || prev.version,
        heroLogo: defaultHeroLogo || prev.heroLogo,
      }));
      initialized.current = true;
    }
  }, [defaultName, defaultVersion, defaultHeroLogo]);

  const isStep1Valid = data.name.trim() !== '' && data.version.trim() !== '';
  const isStep2Valid =
    data.includeMods ||
    data.includeConfigs ||
    data.includeResourcePacks ||
    data.includeShaderPacks ||
    data.includeSaves ||
    data.additionalPaths.length > 0;

  let maxAllowedStep = 1;
  if (isStep1Valid) {
    maxAllowedStep = 2;
    if (isStep2Valid) {
      maxAllowedStep = 4;
    }
  }

  const goToStep = (targetStep: number) => {
    if (targetStep === step) return;
    if (targetStep > maxAllowedStep) return;
    setNavigationDirection(targetStep > step ? 1 : -1);
    setStep(targetStep);
  };

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-[var(--ore-modal-bg,#313233)] font-minecraft select-none"
    >
      {/* 1. 主内容滚动视口 (居中通透，充满空间) */}
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#222324]">
        <AnimatePresence initial={false} custom={navigationDirection} mode="wait">
          <motion.div
            key={step}
            custom={navigationDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex-1 overflow-hidden h-full"
          >
            <OreOverlayScrollArea
              className="h-full w-full"
              viewportClassName="p-4 sm:p-5 lg:p-6 h-full w-full overflow-x-hidden flex flex-col items-center justify-start"
              contentClassName="w-full max-w-4xl xl:max-w-5xl mx-auto flex-1 flex flex-col items-stretch justify-start"
              contentSafePaddingRight={0}
              safeInsetTop={0}
              safeInsetBottom={0}
            >
              <FocusBoundary id={`export-step-${step}-boundary`} className="w-full flex flex-col items-center justify-start" isActive trapFocus={false}>
                {step === 1 && (
                  <ExportBasicStep
                    data={data}
                    onChange={(partial) => setData((prev) => ({ ...prev, ...partial }))}
                  />
                )}
                {step === 2 && (
                  <ExportContentStep
                    instanceId={instanceId}
                    data={data}
                    onChange={(partial) => setData((prev) => ({ ...prev, ...partial }))}
                  />
                )}
                {step === 3 && (
                  <ExportOptimizationStep
                    data={data}
                    onChange={(partial) => setData((prev) => ({ ...prev, ...partial }))}
                  />
                )}
                {step === 4 && (
                  <ExportConfirmStep instanceId={instanceId} data={data} onBack={() => goToStep(3)} />
                )}
              </FocusBoundary>
            </OreOverlayScrollArea>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 2. 底部 3D 石质步进条 (宽裕大气 Stepper Bar) */}
      <div className="border-t-[3px] border-[#1E1E1F] bg-[#313233] p-4 shadow-[inset_0_2px_0_rgba(255,255,255,0.08)]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stepLabels.map((label, index) => {
            const stepNumber = index + 1;
            const isCompleted = step > stepNumber;
            const isCurrent = step === stepNumber;
            const isEnabled = stepNumber <= maxAllowedStep;

            return (
              <button
                key={label}
                type="button"
                onClick={() => goToStep(stepNumber)}
                disabled={!isEnabled}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex min-w-0 items-center gap-3 border-[2px] border-[#1E1E1F] px-4 py-2.5 sm:py-3 text-left transition-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white active:translate-y-[1px] min-h-[3rem] ${
                  isCurrent
                    ? 'bg-[#D0D1D4] text-[#1E1E1F] shadow-[inset_0_2px_0_#FFF,inset_0_-2px_0_#58585A]'
                    : isCompleted
                      ? 'bg-[#3C8527] text-white shadow-[inset_0_-2px_0_#1D4D13,inset_0_2px_0_#6CC349] hover:brightness-105'
                      : !isEnabled
                        ? 'cursor-not-allowed bg-[#222324] text-[#58585A] opacity-60'
                        : 'bg-[#48494A] text-[#D0D1D4] shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)] hover:bg-[#525354]'
                }`}
              >
                {/* 方形 3D 序号/勾选框 */}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center border-[2px] border-[#1E1E1F] text-xs font-bold ${
                    isCurrent
                      ? 'bg-white text-[#1E1E1F]'
                      : isCompleted
                        ? 'bg-[#244A1B] text-[#6CC349]'
                        : !isEnabled
                          ? 'bg-[#181819] text-[#58585A]'
                          : 'bg-[#222324] text-[#D0D1D4]'
                  }`}
                >
                  {isCompleted ? <Check size={16} strokeWidth={3} /> : stepNumber}
                </div>

                <span
                  className={`truncate text-xs sm:text-sm tracking-wide ${
                    isCurrent ? 'font-bold' : ''
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ExportPanel;