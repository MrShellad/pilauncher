import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download } from 'lucide-react';

import { FocusItem } from '../../../../ui/focus/FocusItem';
import { GamepadButtonIcon } from '../../../../ui/components/GamepadButtonIcon';

const RING_RADIUS = 22;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface FloatingButtonProps {
  isOpen: boolean;
  onClick: () => void;
  activeCount: number;
  failedCount: number;
  hasTasks: boolean;
  progress: number;
  pulseKey: number;
}

export const FloatingButton: React.FC<FloatingButtonProps> = ({
  isOpen,
  onClick,
  activeCount,
  failedCount,
  hasTasks,
  progress,
  pulseKey
}) => {
  const dashOffset = Math.round(RING_CIRCUMFERENCE - (progress / 100) * RING_CIRCUMFERENCE);

  return (
    <AnimatePresence>
      {!isOpen && hasTasks && (
        <FocusItem focusKey="btn-floating-download" onEnter={onClick} autoScroll={false}>
          {({ ref, focused }) => (
            <motion.button
              key={pulseKey}
              ref={ref}
              type="button"
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: pulseKey > 0 ? [0.9, 1.12, 1] : 1,
                opacity: 1
              }}
              exit={{ scale: 0, opacity: 0, transition: { duration: 0.12, ease: 'easeIn' } }}
              transition={
                pulseKey > 0
                  ? { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
                  : { type: 'spring', stiffness: 500, damping: 24 }
              }
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClick}
              aria-label={`打开下载任务管理器：${activeCount} 个进行中，${failedCount} 个失败。`}
              title="打开下载任务管理器"
              className={`group relative flex h-14 w-14 items-center justify-center border-[3px] border-[#1E1E1F] bg-[#313233] outline-none select-none font-minecraft cursor-pointer transition-none ${
                focused ? 'outline outline-2 outline-white outline-offset-1 z-50' : 'hover:bg-[#48494A]'
              }`}
              style={{
                boxShadow: focused
                  ? 'inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -3px 0 rgba(0,0,0,0.5), 0 0 16px rgba(108,195,73,0.6)'
                  : 'inset 0 2px 0 rgba(255,255,255,0.15), inset 0 -3px 0 rgba(0,0,0,0.4)'
              }}
            >
              {/* 中心下载图标 */}
              <Download className={`h-6 w-6 text-white ${activeCount > 0 ? 'animate-bounce' : ''}`} />

              {/* 进行中角标 (右上角) */}
              {activeCount > 0 && (
                <span className="absolute -right-2 -top-2 flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center border-[2px] border-[#1E1E1F] bg-[#3C8527] px-1 text-[10px] font-bold text-white shadow-[inset_0_-2px_0_#1D4D13]">
                  {activeCount}
                </span>
              )}

              {/* 失败角标 (左上角) */}
              {failedCount > 0 && (
                <span className="absolute -left-2 -top-2 flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center border-[2px] border-[#1E1E1F] bg-[#C33636] px-1 text-[10px] font-bold text-white shadow-[inset_0_-2px_0_#AD1D1D]">
                  {failedCount}
                </span>
              )}

              {/* 进度环 (方形边框内环) */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full -rotate-90 p-1" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r={RING_RADIUS} fill="transparent" stroke="rgba(0,0,0,0.3)" strokeWidth="3" />
                {activeCount > 0 && (
                  <motion.circle
                    cx="28"
                    cy="28"
                    r={RING_RADIUS}
                    fill="transparent"
                    stroke="#6CC349"
                    strokeWidth="3"
                    strokeLinecap="square"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    animate={{ strokeDashoffset: dashOffset }}
                    transition={{ ease: 'linear', duration: 0.4 }}
                  />
                )}
              </svg>

              {/* 手柄按键提示: [VIEW] 键 */}
              <div className="pointer-events-none absolute -top-7 right-0 flex items-center gap-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                <GamepadButtonIcon button="VIEW" size="sm" />
              </div>
            </motion.button>
          )}
        </FocusItem>
      )}
    </AnimatePresence>
  );
};

export default FloatingButton;