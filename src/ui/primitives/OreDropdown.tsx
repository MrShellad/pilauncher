// /src/ui/primitives/OreDropdown.tsx
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  label: string;
  value: string;
}

interface OreDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string; // 控制外层容器宽度
}

export const OreDropdown: React.FC<OreDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className = 'w-48',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 1. 获取当前选中的选项数据
  const selectedOption = options.find((opt) => opt.value === value);

  // 2. 点击外部区域自动关闭
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // 3. 核心：智能翻转逻辑 (防遮挡)
  useLayoutEffect(() => {
    if (isOpen && triggerRef.current && panelRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const panelHeight = panelRef.current.offsetHeight;
      const windowHeight = window.innerHeight;

      const spaceBelow = windowHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;

      // 如果下方空间不足以放下整个面板，且上方空间比下方多，则向上翻转
      if (spaceBelow < panelHeight && spaceAbove > spaceBelow) {
        setPlacement('top');
      } else {
        setPlacement('bottom');
      }
    }
  }, [isOpen, options]); // 依赖 options 变动可能引起的高度变化

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* 触发器按钮 */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`ore-dropdown-trigger ${isOpen ? 'is-open' : ''}`}
      >
        <span className={`truncate ore-text-shadow ${!selectedOption ? 'text-ore-text-muted opacity-80' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? (placement === 'bottom' ? 180 : -180) : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-2 flex-shrink-0"
        >
          <ChevronDown size={18} />
        </motion.div>
      </button>

      {/* 下拉面板 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            // 动画设定：根据 placement 决定动画的原点
            initial={{ opacity: 0, scaleY: 0.9, originY: placement === 'bottom' ? 0 : 1 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.9, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="ore-dropdown-panel"
            style={{
              // 物理定位：向上翻转时吸附上方，向下翻转时吸附下方，留出 4px 的呼吸间距
              ...(placement === 'bottom' 
                ? { top: '100%', marginTop: '4px' } 
                : { bottom: '100%', marginBottom: '4px' }
              )
            }}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className={`ore-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                >
                  <span className="truncate ore-text-shadow">{opt.label}</span>
                  {/* 选中时的对勾 */}
                  {isSelected && <Check size={16} className="text-ore-green ml-2 flex-shrink-0" />}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};