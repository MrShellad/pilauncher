// src/features/InstanceDetail/components/tabs/export/ExportPanel.tsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';

import { OreButton } from '../../../../../ui/primitives/OreButton';
import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../../ui/focus/FocusItem';

import { ExportBasicStep } from './ExportBasicStep';
import { ExportContentStep } from './ExportContentStep';
import { ExportOptimizationStep } from './ExportOptimizationStep';
import { ExportConfirmStep } from './ExportConfirmStep';

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
  format: 'zip' | 'curseforge' | 'mrpack';
  manifestMode: boolean;
}

interface ExportPanelProps {
  instanceId: string;
  defaultName?: string;
  defaultHeroLogo?: string;
  defaultVersion?: string;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ 
  instanceId, 
  defaultName,
  defaultHeroLogo,
  defaultVersion 
}) => {
  const [step, setStep] = useState(1);
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
    if ((defaultName || defaultVersion) && !initialized.current) {
      setData(prev => ({ 
        ...prev, 
        name: defaultName || prev.name,
        version: defaultVersion || prev.version,
        heroLogo: defaultHeroLogo || prev.heroLogo
      }));
      initialized.current = true;
    }
  }, [defaultName, defaultVersion, defaultHeroLogo]);

  const nextStep = () => setStep((s) => Math.min(s + 1, 4));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const stepLabels = ['基础信息', '导出内容', '格式优化', '最终确认'];

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-6 font-minecraft text-white overflow-hidden" style={{ backgroundColor: 'var(--ore-modal-bg, #313233)' }}>
      {/* 主体内容区 */}
      <div className="flex-1 min-h-0 relative max-w-4xl mx-auto w-full bg-[#48494A] border-2 border-[#18181B] shadow-[inset_0_4px_8px_-2px_rgba(0,0,0,0.3)] overflow-hidden rounded-sm flex flex-col mb-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8"
            >
              <FocusBoundary id={`export-step-${step}-boundary`} isActive trapFocus>
                {step === 1 && <ExportBasicStep data={data} onChange={(d: Partial<ExportData>) => setData({ ...data, ...d })} />}
                {step === 2 && <ExportContentStep instanceId={instanceId} data={data} onChange={(d: Partial<ExportData>) => setData({ ...data, ...d })} />}
                {step === 3 && <ExportOptimizationStep data={data} onChange={(d: Partial<ExportData>) => setData({ ...data, ...d })} />}
                {step === 4 && <ExportConfirmStep instanceId={instanceId} data={data} onBack={prevStep} />}
              </FocusBoundary>
            </motion.div>
          </AnimatePresence>
      </div>

      {/* 底部导航 controls & 步骤指示器 */}
      <div className="h-16 md:h-20 border-2 border-[#18181B] px-6 md:px-8 flex items-center justify-between bg-[#313233] shadow-[inset_2px_2px_rgba(255,255,255,0.05)] shrink-0 max-w-4xl mx-auto w-full rounded-sm">
        
        {/* 左侧：步骤指示器 */}
        <div className="flex items-center flex-1 max-w-sm mr-8">
          {stepLabels.map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex items-center gap-2 relative group flex-1">
                <div 
                  className={`w-6 h-6 md:w-8 md:h-8 rounded-full shadow-[inset_0_2px_0_rgba(255,255,255,0.2)] flex items-center justify-center border-2 transition-all duration-300 shrink-0 ${
                    step > i + 1 
                      ? 'bg-[#3C8527] border-[#18181B] text-white shadow-[0_0_15px_rgba(60,133,39,0.4)]' 
                      : step === i + 1 
                        ? 'bg-[#D0D1D4] text-[#000000] border-[#18181B] shadow-[0_0_20px_rgba(208,209,212,0.3)]' 
                        : 'bg-[#48494A] border-[#18181B] text-[#B1B2B5]'
                  }`}
                >
                  {step > i + 1 ? <CheckCircle2 size={14} /> : <span className="text-xs md:text-sm font-bold font-minecraft">{i + 1}</span>}
                </div>
                <span className={`text-[10px] md:text-xs tracking-widest font-bold whitespace-nowrap transition-all hidden md:block ${
                  step === i + 1 ? 'text-white' : 'text-[#B1B2B5]'
                }`}>
                  {label}
                </span>
                {i < stepLabels.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2 bg-[#1E1E1F] hidden md:block" />
                )}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex items-center space-x-4">
          <FocusItem focusKey="export-btn-prev" onEnter={prevStep}>
            {({ ref, focused }: any) => (
              <div ref={ref} className={step === 1 ? 'invisible' : ''}>
                <OreButton variant="secondary" onClick={prevStep} className={focused ? 'ring-2 ring-white ring-offset-2 ring-offset-[#313233]' : ''}>
                  <ChevronLeft size={18} className="mr-2" />
                  上一步
                </OreButton>
              </div>
            )}
          </FocusItem>

          {step < 4 && (
            <FocusItem focusKey="export-btn-next" onEnter={nextStep}>
              {({ ref, focused }: any) => (
                <div ref={ref}>
                  <OreButton variant="primary" onClick={nextStep} className={focused ? 'ring-2 ring-white ring-offset-2 ring-offset-[#313233]' : ''}>
                    下一步
                    <ChevronRight size={18} className="ml-2" />
                  </OreButton>
                </div>
              )}
            </FocusItem>
          )}
        </div>
      </div>
    </div>
  );
};
