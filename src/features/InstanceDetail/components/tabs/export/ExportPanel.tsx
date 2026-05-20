import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
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

const stepLabels = ['基础信息', '导出内容', '格式优化', '最终确认'];
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '3rem' : direction < 0 ? '-3rem' : 0,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-3rem' : direction < 0 ? '3rem' : 0,
    opacity: 0,
  }),
};

export const ExportPanel: React.FC<ExportPanelProps> = ({
  instanceId,
  defaultName,
  defaultHeroLogo,
  defaultVersion,
}) => {
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
    format: 'zip',
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

  const goToStep = (targetStep: number) => {
    if (targetStep === step) return;
    setNavigationDirection(targetStep > step ? 1 : -1);
    setStep(targetStep);
  };

  return (
    <div
      className="flex h-full w-full flex-col gap-4 overflow-hidden px-4 py-4 font-minecraft text-white md:px-6 md:py-5 xl:px-8"
      style={{ backgroundColor: 'var(--ore-modal-bg, #313233)' }}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-[72rem] flex-1 flex-col overflow-hidden rounded-sm border-2 border-[#18181B] bg-[#48494A] shadow-[inset_0_0.25rem_0.5rem_-0.125rem_rgba(0,0,0,0.3)]">
        <AnimatePresence initial={false} custom={navigationDirection} mode="wait">
          <motion.div
            key={step}
            custom={navigationDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 lg:p-6 xl:p-8"
          >
            <FocusBoundary id={`export-step-${step}-boundary`} isActive trapFocus>
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
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mx-auto w-full max-w-[72rem] rounded-sm border-2 border-[#18181B] bg-[#313233] p-4 shadow-[inset_0.125rem_0.125rem_rgba(255,255,255,0.05)] sm:p-5">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="grid min-w-[42rem] grid-cols-4 gap-3">
            {stepLabels.map((label, index) => {
              const stepNumber = index + 1;
              const isCompleted = step > stepNumber;
              const isCurrent = step === stepNumber;

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => goToStep(stepNumber)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex min-w-0 items-center gap-3 rounded-sm border-2 px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                    isCurrent
                      ? 'border-[#18181B] bg-[#D0D1D4]/90 text-black shadow-[0_0_1rem_rgba(208,209,212,0.2)]'
                      : isCompleted
                        ? 'border-[#18181B] bg-[#3C8527] text-white shadow-[0_0_1rem_rgba(60,133,39,0.18)] hover:brightness-105'
                        : 'border-[#18181B] bg-[#1E1E1F] text-[#B1B2B5] hover:bg-[#2A2A2C]'
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
                      isCurrent
                        ? 'border-[#18181B] bg-white/80 text-black'
                        : isCompleted
                          ? 'border-[#18181B] bg-black/15 text-white'
                          : 'border-[#18181B] bg-[#48494A] text-[#D0D1D4]'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={16} /> : stepNumber}
                  </div>
                  <span
                    className={`min-w-0 text-[0.75rem] leading-[1.35] tracking-[0.08em] whitespace-normal break-words sm:text-[0.8125rem] ${
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
    </div>
  );
};
