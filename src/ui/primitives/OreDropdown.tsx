// /src/ui/primitives/OreDropdown.tsx
import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Search } from 'lucide-react';
import { FocusItem } from '../focus/FocusItem';

import { pause, resume } from '@noriginmedia/norigin-spatial-navigation';

export interface DropdownOption { label: string; value: string; }

interface OreDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string; 
  focusKey?: string;
  searchable?: boolean; 
}

export const OreDropdown: React.FC<OreDropdownProps> = ({
  options, value, onChange, placeholder = 'Select...', disabled = false, className = 'w-48', focusKey, searchable = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const [highlightedIndex, setHighlightedIndex] = useState(-1); 
  const [searchTerm, setSearchTerm] = useState(''); 
  
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => { if (!isOpen) setSearchTerm(''); }, [isOpen]);

  useEffect(() => {
    if (isOpen) pause();
    else resume();
    return () => resume();
  }, [isOpen]);

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

  // 内部滚动条自动吸附
  useEffect(() => {
    if (isOpen && panelRef.current && highlightedIndex >= 0) {
      const optionsContainer = panelRef.current.querySelector('.options-scroll-container');
      if (!optionsContainer) return;
      
      const target = optionsContainer.children[highlightedIndex] as HTMLElement;
      
      if (target) {
        const containerTop = panelRef.current.scrollTop;
        const containerBottom = containerTop + panelRef.current.clientHeight;
        const searchBoxHeight = searchable ? 52 : 0;
        const targetTop = target.offsetTop + searchBoxHeight;
        const targetBottom = targetTop + target.offsetHeight;

        if (targetTop < containerTop + searchBoxHeight) {
          panelRef.current.scrollTop = targetTop - searchBoxHeight - 8; 
        } else if (targetBottom > containerBottom) {
          panelRef.current.scrollTop = targetBottom - panelRef.current.clientHeight + 8;
        }
      }
    }
  }, [highlightedIndex, isOpen, searchable]);

  // 内部空间导航 (手柄/键盘)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation(); 
      } else {
        return; 
      }

      if (e.key === 'ArrowDown') setHighlightedIndex(prev => Math.min(filteredOptions.length - 1, prev + 1));
      else if (e.key === 'ArrowUp') setHighlightedIndex(prev => Math.max(0, prev - 1));
      else if (e.key === 'Enter') {
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          onChange(filteredOptions[highlightedIndex].value);
          setIsOpen(false);
        }
      } else if (e.key === 'Escape') setIsOpen(false);
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
        <div 
          ref={focusRef as any} 
          className={`relative inline-block ${className} transition-all rounded-sm h-full ${isOpen ? 'z-[100]' : (focused ? 'ring-2 ring-white scale-[1.02] z-30 shadow-lg brightness-110' : 'z-20')}`}
        >
          <div ref={containerRef} className="h-full flex flex-col">
            
            <button
              ref={triggerRef}
              type="button"
              disabled={disabled}
              onClick={() => setIsOpen(!isOpen)}
              tabIndex={-1} 
              className={`ore-dropdown-trigger ${isOpen ? 'is-open' : ''} ${focused && !isOpen ? 'border-transparent' : ''}`}
            >
              <span className={`truncate ore-text-shadow ${!selectedOption ? 'text-gray-400 font-bold' : ''}`}>
                {selectedOption ? selectedOption.label : placeholder}
              </span>
              <motion.div animate={{ rotate: isOpen ? (placement === 'bottom' ? 180 : -180) : 0 }} transition={{ duration: 0.2 }} className="ml-2 flex-shrink-0">
                <ChevronDown size={18} className={!selectedOption ? 'text-gray-500' : 'text-white'} />
              </motion.div>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  ref={panelRef}
                  initial={{ opacity: 0, scaleY: 0.95, originY: placement === 'bottom' ? 0 : 1 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  exit={{ opacity: 0, scaleY: 0.95, transition: { duration: 0.1 } }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="ore-dropdown-panel custom-scrollbar"
                  style={{ ...(placement === 'bottom' ? { top: '100%', marginTop: '2px' } : { bottom: '100%', marginBottom: '2px' }) }}
                >
                  {searchable && (
                    <div className="ore-dropdown-search-wrapper">
                      <div className="relative flex items-center h-full">
                        <Search size={14} className="absolute left-3 text-gray-400 pointer-events-none" />
                        <input
                          autoFocus
                          type="text"
                          placeholder="搜索..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          onClick={(e) => e.stopPropagation()} 
                          className="ore-dropdown-search-input"
                        />
                      </div>
                    </div>
                  )}

                  <div className="options-scroll-container flex flex-col py-1">
                    {filteredOptions.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-500 font-minecraft">无匹配结果</div>
                    ) : (
                      filteredOptions.map((opt, idx) => {
                        const isSelected = opt.value === value;
                        const isHighlighted = highlightedIndex === idx; 
                        return (
                          <div
                            key={opt.value}
                            onMouseEnter={() => setHighlightedIndex(idx)} 
                            onClick={() => handleSelect(opt.value)}
                            className={`ore-dropdown-item ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
                          >
                            <span className="truncate ore-text-shadow font-minecraft">{opt.label}</span>
                            {isSelected && <Check size={18} className="text-ore-green ml-3 flex-shrink-0" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </FocusItem>
  );
};