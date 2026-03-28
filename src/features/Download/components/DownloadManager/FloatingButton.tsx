import { motion, AnimatePresence } from 'framer-motion';
import { Download } from 'lucide-react';

import { FocusItem } from '../../../../ui/focus/FocusItem';

export const FloatingButton = ({ isOpen, onClick, activeCount, hasTasks }: any) => {
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

              <svg className="pointer-events-none absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="transparent" stroke="#333" strokeWidth="4" />
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="4"
                  className={activeCount > 0 ? 'animate-[spin_3s_linear_infinite] stroke-dasharray-[100_200] text-ore-green' : 'hidden'}
                />
              </svg>

              <div className="pointer-events-none absolute -top-[1.875rem] right-0 rounded-[0.1875rem] bg-black/70 px-[0.5rem] py-[0.125rem] text-[0.6875rem] text-ore-text-muted shadow-sm">
                手柄菜单键：打开/关闭
              </div>
            </motion.button>
          )}
        </FocusItem>
      )}
    </AnimatePresence>
  );
};
