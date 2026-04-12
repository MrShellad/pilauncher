import { motion, AnimatePresence } from 'framer-motion';
import { Download } from 'lucide-react';

import { FocusItem } from '../../../../ui/focus/FocusItem';

const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const FloatingButton = ({ isOpen, onClick, activeCount, hasTasks, progress }: {
  isOpen: boolean;
  onClick: () => void;
  activeCount: number;
  hasTasks: boolean;
  progress: number;
}) => {
  const dashOffset = RING_CIRCUMFERENCE - (progress / 100) * RING_CIRCUMFERENCE;

  return (
    <AnimatePresence>
      {!isOpen && hasTasks && (
        <FocusItem focusKey="btn-floating-download" onEnter={onClick} autoScroll={false}>
          {({ ref, focused }) => (
            <motion.button
              ref={ref as any}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClick}
              className={`group relative flex h-[clamp(3.5rem,4vw,4.5rem)] w-[clamp(3.5rem,4vw,4.5rem)] items-center justify-center rounded-full border-[0.125rem] border-ore-gray-border bg-[#1E1E1F] shadow-lg outline-none transition-all hover:border-ore-green
                ${focused ? 'z-50 scale-105 ring-4 ring-ore-green shadow-[0_0_20px_rgba(34,197,94,0.5)]' : ''}
              `}
            >
              <Download className="h-[1.5rem] w-[1.5rem] text-white sm:h-[1.625rem] sm:w-[1.625rem]" />

              {activeCount > 0 && (
                <span className="absolute -right-[0.25rem] -top-[0.25rem] flex min-h-[1.375rem] min-w-[1.375rem] items-center justify-center rounded-full bg-ore-green px-[0.25rem] text-[0.75rem] font-bold text-[#1E1E1F]">
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
