// /src/ui/primitives/OreAccordion.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import '../../style/index.css';

interface OreAccordionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

export const OreAccordion: React.FC<OreAccordionProps> = ({
  title,
  children,
  defaultExpanded = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`flex flex-col w-full ${className}`}>
      {/* 标题栏 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`ore-accordion-header ${isExpanded ? 'bg-ore-nav-active' : ''}`}
      >
        <span className="font-minecraft font-bold text-white ore-text-shadow uppercase tracking-wider">
          {title}
        </span>
        
        {/* 旋转箭头 */}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="text-ore-text-muted"
        >
          <ChevronDown size={20} />
        </motion.div>
      </button>

      {/* 内容区域 */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="ore-accordion-content-wrapper"
          >
            <div className="ore-accordion-content">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};