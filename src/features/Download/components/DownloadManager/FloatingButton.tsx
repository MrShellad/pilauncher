// src/features/Download/components/DownloadManager/FloatingButton.tsx
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
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={onClick}
              className={`relative w-16 h-16 bg-[#1E1E1F] border-2 border-ore-gray-border rounded-full flex items-center justify-center shadow-lg group hover:border-ore-green transition-all outline-none
                ${focused ? 'ring-4 ring-ore-green shadow-[0_0_20px_rgba(34,197,94,0.5)] z-50 scale-105' : ''}
              `}
            >
              <Download size={26} className="text-white" />
              
              {/* 角标：仅在有正在下载的任务时显示 */}
              {activeCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-ore-green text-[#1E1E1F] text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                  {activeCount}
                </span>
              )}

              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="transparent" stroke="#333" strokeWidth="4" />
                <circle cx="50" cy="50" r="46" fill="transparent" stroke="currentColor" strokeWidth="4" 
                  className={activeCount > 0 ? "text-ore-green animate-[spin_3s_linear_infinite] stroke-dasharray-[100_200]" : "hidden"} 
                />
              </svg>
              <div className="absolute -top-6 right-0 text-[10px] text-ore-text-muted bg-black/70 px-2 py-0.5 rounded-sm shadow-sm pointer-events-none">
                手柄菜单键：打开/关闭
              </div>
            </motion.button>
          )}
        </FocusItem>
      )}
    </AnimatePresence>
  );
};