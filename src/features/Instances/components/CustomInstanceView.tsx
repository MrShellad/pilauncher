// /src/features/Instances/components/CustomInstanceView.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCustomInstance } from '../../../hooks/pages/Instances/useCustomInstance';
import { OreMotionTokens } from '../../../style/tokens/motion'; 
import { VersionSelectStep } from './steps/VersionSelectStep';
import { LoaderSelectStep } from './steps/LoaderSelectStep';
import { FinalConfigStep } from './steps/FinalConfigStep';

export const CustomInstanceView: React.FC = () => {
  // ✅ 1. 整个流程只在这里调用一次 Hook
  const instanceState = useCustomInstance();
  const { step, direction } = instanceState;

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden">
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          initial={OreMotionTokens.stepInitial(direction)}
          animate={OreMotionTokens.stepAnimate}
          exit={OreMotionTokens.stepExit(direction)}
          className="flex-1 flex flex-col w-full min-h-0 no-scrollbar"
        >
          {/* ✅ 2. 把所有状态和方法通过 props 传给子组件 */}
          {step === 1 && <VersionSelectStep {...instanceState} />}
          {step === 2 && <LoaderSelectStep {...instanceState} />}
          {step === 3 && <FinalConfigStep {...instanceState} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};