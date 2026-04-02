// src/ui/primitives/OreDropdown.tsx
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
  onArrowPress?: (direction: string) => boolean | void;
  searchable?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  prefixNode?: React.ReactNode; // ✅ 新增：支持前缀图标
}

export const OreDropdown: React.FC<OreDropdownProps> = ({
  options, value, onChange, placeholder = 'Select...', disabled = false, className = '', focusKey, onArrowPress, searchable = false, onOpenChange, prefixNode
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const [alignRight, setAlignRight] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchTerm, setSearchTerm] = useState('');

  const dropdownId = useMemo(() => Math.random().toString(36).substring(2, 9), []);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedOption = value !== '' ? options.find((opt) => opt.value === value) : undefined;

  useEffect(() => {
    const handleGlobalToggle = (e: any) => {
      if (e.detail !== dropdownId) {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    };
    window.addEventListener('ore-dropdown-toggle', handleGlobalToggle);
    return () => window.removeEventListener('ore-dropdown-toggle', handleGlobalToggle);
  }, [dropdownId, onOpenChange]);

  const toggleDropdown = () => {
    if (disabled) return;
    const nextState = !isOpen;
    setIsOpen(nextState);
    onOpenChange?.(nextState);
    if (nextState) {
      window.dispatchEvent(new CustomEvent('ore-dropdown-toggle', { detail: dropdownId }));
    }
  };

  useEffect(() => { if (!isOpen) setSearchTerm(''); }, [isOpen]);
  useEffect(() => { if (isOpen) pause(); else resume(); return () => resume(); }, [isOpen]);

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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      } else {
        return;
      }

      if (e.key === 'ArrowDown') setHighlightedIndex(prev => Math.min(filteredOptions.length - 1, prev + 1));
      else if (e.key === 'ArrowUp') setHighlightedIndex(prev => Math.max(0, prev - 1));
      else if (e.key === 'Enter') {
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          onChange(filteredOptions[highlightedIndex].value);
          setIsOpen(false);
          onOpenChange?.(false);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, highlightedIndex, filteredOptions, onChange, onOpenChange]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, onOpenChange]);

  useLayoutEffect(() => {
    if (isOpen && triggerRef.current && panelRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      setPlacement(spaceBelow < panelRef.current.offsetHeight && spaceAbove > spaceBelow ? 'top' : 'bottom');

      if (window.innerWidth - triggerRect.right < 260) {
        setAlignRight(true);
      } else {
        setAlignRight(false);
      }
    }
  }, [isOpen, options]);

  return (
    <FocusItem focusKey={focusKey} disabled={disabled} onArrowPress={onArrowPress} onEnter={toggleDropdown}>
      {({ ref: focusRef, focused }) => (
        <div
          ref={focusRef as any}
          /* ✅ 提升默认高度至 40px，适配 TV 端阅读体验 */
          className={`relative block w-full rounded-sm h-[40px] ${className} ${isOpen ? 'z-[100]' : (focused ? 'ring-2 ring-white scale-[1.02] z-40 shadow-lg brightness-110' : 'z-20')}`}
        >
          <div ref={containerRef} className="h-full flex flex-col">
            <button
              ref={triggerRef}
              type="button"
              disabled={disabled}
              onClick={toggleDropdown}
              tabIndex={-1}
              className={`ore-dropdown-trigger w-full flex items-center justify-between px-3 ${isOpen ? 'is-open' : ''} ${focused && !isOpen ? 'border-transparent' : ''}`}
            >
              {/* ✅ 支持内嵌前缀图标 */}
              <div className="flex items-center overflow-hidden">
                {prefixNode && (
                  <div className={`mr-2 flex-shrink-0 transition-colors ${!selectedOption ? 'text-[#48494A]' : 'text-black'}`}>
                    {prefixNode}
                  </div>
                )}
                <span className={`truncate font-minecraft font-bold ${!selectedOption ? 'text-[#48494A]' : 'text-black'}`}>
                  {selectedOption ? selectedOption.label : placeholder}
                </span>
              </div>
              <motion.div animate={{ rotate: isOpen ? (placement === 'bottom' ? 180 : -180) : 0 }} transition={{ duration: 0.2 }} className="ml-2 flex-shrink-0">
                <ChevronDown size={18} className={!selectedOption ? 'text-[#48494A]' : 'text-black'} />
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
                  className="ore-dropdown-panel custom-scrollbar min-w-full"
                  style={{
                    ...(placement === 'bottom' ? { top: '100%', marginTop: '2px' } : { bottom: '100%', marginBottom: '2px' }),
                    ...(alignRight ? { right: 0, left: 'auto' } : { left: 0, right: 'auto' })
                  }}
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
                      <div className="px-4 py-8 text-center text-sm text-gray-400 font-minecraft">无匹配结果</div>
                    ) : (
                      filteredOptions.map((opt, idx) => {
                        const isSelected = opt.value === value;
                        const isHighlighted = highlightedIndex === idx;
                        return (
                          <div
                            key={opt.value}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            onClick={() => { onChange(opt.value); setIsOpen(false); onOpenChange?.(false); }}
                            className={`ore-dropdown-item ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
                          >
                            <span className="font-minecraft whitespace-normal break-words pr-2">{opt.label}</span>
                            {isSelected && <Check size={18} className="text-white ml-3 flex-shrink-0" />}
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