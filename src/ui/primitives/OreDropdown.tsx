// /src/ui/primitives/OreDropdown.tsx
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { FocusItem } from '../focus/FocusItem';

export interface DropdownOption { label: string; value: string; }

interface OreDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string; 
  focusKey?: string;
}

export const OreDropdown: React.FC<OreDropdownProps> = ({
  options, value, onChange, placeholder = 'Select...', disabled = false, className = 'w-48', focusKey
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const [highlightedIndex, setHighlightedIndex] = useState(-1); 
  
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // 1. 展开时初始化高亮项
  useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex(opt => opt.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [isOpen, value, options]);

  // ✅ 2. 核心体验修复：当键盘上下选择时，列表自动滚动跟随！
  useEffect(() => {
    if (isOpen && panelRef.current && highlightedIndex >= 0) {
      const container = panelRef.current;
      // 获取当前高亮 DOM 节点
      const target = container.children[highlightedIndex] as HTMLElement;
      
      if (target) {
        // 计算容器的当前可视顶部和底部边界
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.clientHeight;
        
        // 计算目标元素的顶部和底部绝对位置
        const targetTop = target.offsetTop;
        const targetBottom = targetTop + target.offsetHeight;

        // 判断如果超出了视口，则自动调整滚动条
        if (targetTop < containerTop) {
          // 向上越界，将其贴着视口顶部
          container.scrollTop = targetTop;
        } else if (targetBottom > containerBottom) {
          // 向下越界，将其贴着视口底部
          container.scrollTop = targetBottom - container.clientHeight;
        }
      }
    }
  }, [highlightedIndex, isOpen]);

  // 3. 键盘事件捕获
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation(); 
      }

      if (e.key === 'ArrowDown') {
        setHighlightedIndex(prev => Math.min(options.length - 1, prev + 1));
      } else if (e.key === 'ArrowUp') {
        setHighlightedIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'Enter') {
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          onChange(options[highlightedIndex].value);
          setIsOpen(false);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, highlightedIndex, options, onChange]);

  // 4. 鼠标点击外部关闭
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // 5. 智能翻转逻辑
  useLayoutEffect(() => {
    if (isOpen && triggerRef.current && panelRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      setPlacement(spaceBelow < panelRef.current.offsetHeight && spaceAbove > spaceBelow ? 'top' : 'bottom');
    }
  }, [isOpen, options]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <FocusItem focusKey={focusKey} disabled={disabled} onEnter={() => setIsOpen(!isOpen)}>
      {({ ref: focusRef, focused }) => (
        <div ref={focusRef as any} className={`relative inline-block ${className} transition-all rounded-sm ${focused ? 'ring-2 ring-white scale-[1.05] z-30 shadow-lg brightness-125' : 'z-20'}`}>
          <div ref={containerRef}>
            <button
              ref={triggerRef}
              type="button"
              disabled={disabled}
              onClick={() => setIsOpen(!isOpen)}
              tabIndex={-1} 
              className={`ore-dropdown-trigger ${isOpen ? 'is-open' : ''} ${focused ? 'border-transparent' : ''}`}
            >
              <span className={`truncate ore-text-shadow ${!selectedOption ? 'text-ore-text-muted opacity-80' : ''}`}>
                {selectedOption ? selectedOption.label : placeholder}
              </span>
              <motion.div animate={{ rotate: isOpen ? (placement === 'bottom' ? 180 : -180) : 0 }} transition={{ duration: 0.2 }} className="ml-2 flex-shrink-0">
                <ChevronDown size={18} />
              </motion.div>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  ref={panelRef}
                  initial={{ opacity: 0, scaleY: 0.9, originY: placement === 'bottom' ? 0 : 1 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  exit={{ opacity: 0, scaleY: 0.9, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="ore-dropdown-panel"
                  style={{ ...(placement === 'bottom' ? { top: '100%', marginTop: '4px' } : { bottom: '100%', marginBottom: '4px' }) }}
                >
                  {options.map((opt, idx) => {
                    const isSelected = opt.value === value;
                    const isHighlighted = highlightedIndex === idx; 
                    return (
                      <div
                        key={opt.value}
                        onMouseEnter={() => setHighlightedIndex(idx)} 
                        onClick={() => handleSelect(opt.value)}
                        className={`ore-dropdown-item ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'bg-ore-nav-hover text-white' : ''}`}
                      >
                        <span className="truncate ore-text-shadow">{opt.label}</span>
                        {isSelected && <Check size={16} className="text-ore-green ml-2 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </FocusItem>
  );
};