// /src/ui/primitives/OreAccordion.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';

// ✅ 引入空间导航焦点组件
import { FocusItem } from '../focus/FocusItem';

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
  const contentId = React.useId();

  return (
    <div className={`flex flex-col w-full ${className}`}>
      
      <FocusItem onEnter={() => setIsExpanded(!isExpanded)}>
        {({ ref, focused, tabIndex }) => (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            tabIndex={tabIndex}
            aria-expanded={isExpanded}
            aria-controls={isExpanded ? contentId : undefined}
            className={`
              ore-accordion-header outline-none flex items-center justify-between
              ${isExpanded ? 'bg-ore-nav-active' : ''}
              ${focused ? 'is-focused' : ''}
            `}
          >
            {/* ✅ 核心修复：将 ref 绑定到紧贴文字的 div 上，而非全宽 of button。
              引擎现在会认为这个组件的中心点在“左侧”，当你按下 ↓ 键时，
              它会笔直地找到同样靠左排列的第一个版本卡片！
            */}
            <div ref={ref as any} className="flex items-center">
              <span className="font-minecraft font-bold text-white ore-text-shadow uppercase tracking-wider">
                {title}
              </span>
            </div>
            
            {/* 旋转箭头 */}
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className={focused ? 'text-white' : 'text-ore-text-muted'}
            >
              <ChevronDown size={20} />
            </motion.div>
          </button>
        )}
      </FocusItem>

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
            <div id={contentId} role="region" className="ore-accordion-content" aria-label={title}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
