import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download } from 'lucide-react';

export const FloatingButton = ({ isOpen, onClick, activeCount, progress }: any) => {
  return (
    <AnimatePresence>
      {!isOpen && activeCount > 0 && (
        <motion.button
          initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={onClick}
          className="relative w-14 h-14 bg-[#1E1E1F] border-2 border-ore-gray-border rounded-full flex items-center justify-center shadow-lg group hover:border-ore-green transition-colors"
        >
          <Download size={24} className="text-white" />
          <span className="absolute -top-1 -right-1 bg-ore-green text-[#1E1E1F] text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
            {activeCount}
          </span>
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="transparent" stroke="#333" strokeWidth="4" />
            <circle cx="50" cy="50" r="46" fill="transparent" stroke="#22C55E" strokeWidth="4" 
              strokeDasharray={`${(progress || 0) * 2.89} 289`} 
              className="transition-all duration-500" 
            />
          </svg>
        </motion.button>
      )}
    </AnimatePresence>
  );
};