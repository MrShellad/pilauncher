import { motion, AnimatePresence } from 'motion/react';
import { Download } from 'lucide-react';

import { FocusItem } from '../../../../ui/focus/FocusItem';

const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const FloatingButton = ({ isOpen, onClick, activeCount, hasTasks, progress, pulseKey }: {
  isOpen: boolean;
  onClick: () => void;
  activeCount: number;
  hasTasks: boolean;
  progress: number;
  pulseKey: number;
}) => {
  const dashOffset = RING_CIRCUMFERENCE - (progress / 100) * RING_CIRCUMFERENCE;

  return (
    <AnimatePresence>
      {!isOpen && hasTasks && (
        <FocusItem focusKey="btn-floating-download" onEnter={onClick} autoScroll={false}>
          {({ ref, focused }) => (
            <motion.button
              key={pulseKey}
              ref={ref as any}
              initial={{ scale: 0, opacity: 0, boxShadow: '0 0 0 rgba(108,195,73,0)' }}
              animate={{
                scale: pulseKey > 0 ? [0.82, 1.16, 1] : 1,
                opacity: 1,
                boxShadow: pulseKey > 0
                  ? [
                      '0 0 0 rgba(108,195,73,0)',
                      '0 0 2rem rgba(108,195,73,0.78)',
                      '0 0 0.85rem rgba(108,195,73,0.32)'
                    ]
                  : '0 0 0 rgba(108,195,73,0)'
              }}
              exit={{ scale: 0, opacity: 0, transition: { duration: 0.12, ease: 'easeIn' } }}
              transition={
                pulseKey > 0
                  ? { duration: 0.58, ease: [0.16, 1, 0.3, 1] }
                  : { type: 'spring', stiffness: 500, damping: 24 }
              }
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClick}
              className={`group relative flex h-[clamp(3.5rem,4vw,4.5rem)] w-[clamp(3.5rem,4vw,4.5rem)] items-center justify-center rounded-none border-[0.1875rem] border-[#1E1E1F] bg-[#313233] outline-none transition-all
                ${focused ? 'z-50 scale-105 outline outline-[0.125rem] outline-white outline-offset-[0.125rem]' : 'hover:border-[#6CC349]'}
              `}
              style={{
                boxShadow: focused
                  ? 'inset -0.25rem -0.25rem 0 rgba(0,0,0,0.45), inset 0.125rem 0.125rem 0 rgba(255,255,255,0.25), 0 0 1.25rem rgba(108,195,73,0.6)'
                  : 'inset -0.25rem -0.25rem 0 rgba(0,0,0,0.35), inset 0.125rem 0.125rem 0 rgba(255,255,255,0.15)'
              }}
            >
              <Download className="h-[1.5rem] w-[1.5rem] text-white sm:h-[1.625rem] sm:w-[1.625rem]" />

              {activeCount > 0 && (
                <span className="absolute -right-[0.25rem] -top-[0.25rem] flex min-h-[1.375rem] min-w-[1.375rem] items-center justify-center rounded-none border-[0.125rem] border-[#111214] bg-[#6CC349] px-[0.25rem] text-[0.75rem] font-bold text-[#111214] shadow-[inset_-0.125rem_-0.125rem_0_#3C8527]">
                  {activeCount}
                </span>
              )}

              {/* Progress ring showing actual task progress */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={RING_RADIUS} fill="transparent" stroke="#333" strokeWidth="4" />
                {activeCount > 0 && (
                  <motion.circle
                    cx="50"
                    cy="50"
                    r={RING_RADIUS}
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="text-ore-green"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    animate={{ strokeDashoffset: dashOffset }}
                    transition={{ ease: 'linear', duration: 0.5 }}
                  />
                )}
              </svg>

              {/* Key hint: Xbox View button (two overlapping squares) */}
              <div className="pointer-events-none absolute -top-[2.25rem] right-0 flex items-center gap-[0.25rem]">
                <span className="inline-flex items-center justify-center drop-shadow-[0_1px_0_rgba(0,0,0,0.45)]" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" className="h-6 w-auto" fill="none">
                    <rect x="3" y="7" width="10" height="10" rx="1.5" stroke="#B1B2B5" strokeWidth="2" fill="#313233" />
                    <rect x="9" y="4" width="10" height="10" rx="1.5" stroke="#B1B2B5" strokeWidth="2" fill="#313233" />
                  </svg>
                </span>
              </div>
            </motion.button>
          )}
        </FocusItem>
      )}
    </AnimatePresence>
  );
};
