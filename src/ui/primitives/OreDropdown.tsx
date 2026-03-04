// /src/ui/primitives/OreDropdown.tsx
import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Search } from 'lucide-react'; // ✅ 增加搜索图标
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
  searchable?: boolean; // ✅ 需求3：开启下拉框内部搜素
}

export const OreDropdown: React.FC<OreDropdownProps> = ({
  options, value, onChange, placeholder = 'Select...', disabled = false, className = 'w-48', focusKey, searchable = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const [highlightedIndex, setHighlightedIndex] = useState(-1); 
  const [searchTerm, setSearchTerm] = useState(''); // ✅ 搜索词状态
  
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // 清空逻辑
  useEffect(() => { if (!isOpen) setSearchTerm(''); }, [isOpen]);

  // ✅ 实时过滤计算
  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm) return options;
    return options.filter(opt => 
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
      opt.value.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchable, searchTerm]);

  useEffect(() => {
    if (isOpen) {
      const idx = filteredOptions.findIndex(opt => opt.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [isOpen, value, filteredOptions]);

  useEffect(() => {
    if (isOpen && panelRef.current && highlightedIndex >= 0) {
      const container = panelRef.current;
      // 加上 1 是因为如果开了搜索，内部第一个元素是输入框 wrapper
      const targetOffset = searchable ? highlightedIndex + 1 : highlightedIndex; 
      const target = container.children[targetOffset] as HTMLElement;
      
      if (target) {
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.clientHeight;
        const targetTop = target.offsetTop;
        const targetBottom = targetTop + target.offsetHeight;

        if (targetTop < containerTop) container.scrollTop = targetTop - 40; 
        else if (targetBottom > containerBottom) container.scrollTop = targetBottom - container.clientHeight;
      }
    }
  }, [highlightedIndex, isOpen, searchable]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ✅ 拦截默认滚动行为，但放行输入法相关的键
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation(); 
      } else {
        return; // 让用户能在搜索框打字
      }

      if (e.key === 'ArrowDown') {
        setHighlightedIndex(prev => Math.min(filteredOptions.length - 1, prev + 1));
      } else if (e.key === 'ArrowUp') {
        setHighlightedIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'Enter') {
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          onChange(filteredOptions[highlightedIndex].value);
          setIsOpen(false);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, highlightedIndex, filteredOptions, onChange]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

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
        <div ref={focusRef as any} className={`relative inline-block ${className} transition-all rounded-sm h-full ${focused ? 'ring-2 ring-white scale-[1.05] z-30 shadow-lg brightness-125' : 'z-20'}`}>
          <div ref={containerRef} className="h-full flex flex-col">
            <button
              ref={triggerRef}
              type="button"
              disabled={disabled}
              onClick={() => setIsOpen(!isOpen)}
              tabIndex={-1} 
              // 确保按钮能吃满传入的尺寸类名
              className={`ore-dropdown-trigger h-full min-h-0 py-1 px-3 ${isOpen ? 'is-open' : ''} ${focused ? 'border-transparent' : ''}`}
            >
              <span className={`truncate ore-text-shadow ${!selectedOption ? 'text-gray-400 font-bold' : ''}`}>
                {selectedOption ? selectedOption.label : placeholder}
              </span>
              <motion.div animate={{ rotate: isOpen ? (placement === 'bottom' ? 180 : -180) : 0 }} transition={{ duration: 0.2 }} className="ml-1.5 flex-shrink-0">
                <ChevronDown size={14} className={!selectedOption ? 'text-gray-500' : ''} />
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
                  // ✅ 核心修复 3：强制注入 absolute 绝对定位、最高 z-index，以及设定一个合理的 min-w 避免搜索框被挤烂
                  className="ore-dropdown-panel absolute z-50 min-w-[150px] w-full bg-[#18181B] border border-[#2A2A2C] shadow-2xl rounded-sm max-h-64 overflow-y-auto custom-scrollbar"
                  style={{ ...(placement === 'bottom' ? { top: '100%', marginTop: '4px' } : { bottom: '100%', marginBottom: '4px' }) }}
                >
                  {/* ✅ 内置独立搜索栏 */}
                  {searchable && (
                    <div className="sticky top-0 bg-[#18181B] z-10 p-1.5 border-b border-white/5 shadow-sm">
                      <div className="relative flex items-center">
                        <Search size={12} className="absolute left-2.5 text-gray-500 pointer-events-none" />
                        <input
                          autoFocus
                          type="text"
                          placeholder="搜索版本..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          onClick={(e) => e.stopPropagation()} // 防误触冒泡
                          className="w-full bg-black/40 border border-white/10 rounded-sm pl-8 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-ore-green transition-colors placeholder:text-gray-600"
                        />
                      </div>
                    </div>
                  )}

                  {filteredOptions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500 font-minecraft">无匹配结果</div>
                  ) : (
                    filteredOptions.map((opt, idx) => {
                      const isSelected = opt.value === value;
                      const isHighlighted = highlightedIndex === idx; 
                      return (
                        <div
                          key={opt.value}
                          onMouseEnter={() => setHighlightedIndex(idx)} 
                          onClick={() => handleSelect(opt.value)}
                          className={`ore-dropdown-item py-1.5 px-3 text-xs ${isSelected ? 'is-selected font-bold text-ore-green bg-ore-green/10' : ''} ${isHighlighted && !isSelected ? 'bg-ore-nav-hover text-white' : ''}`}
                        >
                          <span className="truncate ore-text-shadow font-minecraft">{opt.label}</span>
                          {isSelected && <Check size={14} className="text-ore-green ml-2 flex-shrink-0" />}
                        </div>
                      );
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </FocusItem>
  );
};