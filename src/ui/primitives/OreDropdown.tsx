import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Search } from 'lucide-react';
import { pause, resume } from '@noriginmedia/norigin-spatial-navigation';

import { FocusItem } from '../focus/FocusItem';

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
  className?: string;
  focusKey?: string;
  onArrowPress?: (direction: string) => boolean | void;
  searchable?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  prefixNode?: React.ReactNode;
}

type DropdownPlacement = 'bottom' | 'top';

const PANEL_WIDTH_FALLBACK = 260;

/**
 * 核心逻辑：处理中间省略号
 * 将文本拆分为：[实例名称] + [ (版本 加载器)]
 */
const renderMiddleTruncate = (text: string) => {
  if (!text) return null;

  // 寻找最后一个 " (" 作为分割点
  const splitIndex = text.lastIndexOf(' (');

  // 如果没有括号或者文本非常短，直接显示
  if (splitIndex === -1 || text.length < 15) {
    // 增加 min-w-0 和 block 保证单行也能在 Flex 父级中截断
    return <span className="truncate min-w-0 block">{text}</span>;
  }

  const namePart = text.substring(0, splitIndex);
  const infoPart = text.substring(splitIndex);

  return (
    <>
      {/* 前半部分：增加 block 让 truncate 完美生效 */}
      <span className="truncate min-w-0 block">{namePart}</span>
      {/* 后半部分：禁止收缩，始终保持完整 */}
      <span className="shrink-0 whitespace-pre">{infoPart}</span>
    </>
  );
};

export const OreDropdown: React.FC<OreDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  focusKey,
  onArrowPress,
  searchable = false,
  onOpenChange,
  prefixNode,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<DropdownPlacement>('bottom');
  const [alignRight, setAlignRight] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchTerm, setSearchTerm] = useState('');

  const dropdownId = useId().replace(/:/g, '');
  const panelId = `ore-dropdown-panel-${dropdownId}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => (value !== '' ? options.find((option) => option.value === value) : undefined),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm) {
      return options;
    }

    const normalizedTerm = searchTerm.toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(normalizedTerm) ||
        option.value.toLowerCase().includes(normalizedTerm),
    );
  }, [options, searchable, searchTerm]);

  const closeDropdown = useCallback(() => {
    setIsOpen((previous) => {
      if (!previous) return previous;
      onOpenChange?.(false);
      return false;
    });
  }, [onOpenChange]);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setIsOpen((previous) => {
      if (previous) return previous;
      onOpenChange?.(true);
      return true;
    });
    window.dispatchEvent(new CustomEvent('ore-dropdown-toggle', { detail: dropdownId }));
  }, [disabled, dropdownId, onOpenChange]);

  const toggleDropdown = useCallback(() => {
    if (disabled) return;
    isOpen ? closeDropdown() : openDropdown();
  }, [closeDropdown, disabled, isOpen, openDropdown]);

  const selectOption = useCallback(
    (nextValue: string) => {
      onChange(nextValue);
      closeDropdown();
    },
    [closeDropdown, onChange],
  );

  useEffect(() => {
    if (disabled) closeDropdown();
  }, [closeDropdown, disabled]);

  useEffect(() => {
    const handleGlobalToggle = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail !== dropdownId) closeDropdown();
    };
    window.addEventListener('ore-dropdown-toggle', handleGlobalToggle);
    return () => window.removeEventListener('ore-dropdown-toggle', handleGlobalToggle);
  }, [closeDropdown, dropdownId]);

  useEffect(() => {
    if (isOpen) pause();
    else {
      resume();
      setSearchTerm('');
    }
    return () => resume();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
      return;
    }
    const selectedIndex = filteredOptions.findIndex((option) => option.value === value);
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : filteredOptions.length > 0 ? 0 : -1);
  }, [filteredOptions, isOpen, value]);

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    const optionElements = panelRef.current?.querySelectorAll<HTMLElement>('.ore-dropdown-item');
    optionElements?.[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'ArrowDown') {
        setHighlightedIndex(prev => filteredOptions.length === 0 ? -1 : Math.min(filteredOptions.length - 1, prev + 1));
      } else if (event.key === 'ArrowUp') {
        setHighlightedIndex(prev => filteredOptions.length === 0 ? -1 : Math.max(0, prev - 1));
      } else if (event.key === 'Enter') {
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          selectOption(filteredOptions[highlightedIndex].value);
        }
      } else {
        closeDropdown();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [closeDropdown, filteredOptions, highlightedIndex, isOpen, selectOption]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) closeDropdown();
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [closeDropdown, isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current || !panelRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const panelHeight = panelRef.current.offsetHeight;
    const panelWidth = panelRef.current.offsetWidth || PANEL_WIDTH_FALLBACK;
    const availableBelow = window.innerHeight - triggerRect.bottom;
    const availableAbove = triggerRect.top;
    const isSpaceShort = availableBelow < 160;
    setPlacement((panelHeight > availableBelow || isSpaceShort) && availableAbove > availableBelow ? 'top' : 'bottom');
    setAlignRight(triggerRect.left + panelWidth > window.innerWidth && triggerRect.right - panelWidth >= 0);
  }, [filteredOptions.length, isOpen, options.length, searchTerm, searchable]);

  return (
    <FocusItem
      focusKey={focusKey}
      disabled={disabled}
      onArrowPress={onArrowPress}
      onEnter={toggleDropdown}
    >
      {({ ref: focusRef, focused }) => (
        <div
          ref={focusRef as React.RefObject<HTMLDivElement>}
          className={`ore-dropdown-root relative block h-[40px] w-full rounded-sm ${className} ${isOpen ? 'z-[100]' : focused ? 'z-40 scale-[1.02] ring-2 ring-white shadow-lg brightness-110' : 'z-20'
            }`}
        >
          <div ref={containerRef} className="relative flex h-full flex-col">
            <button
              ref={triggerRef}
              type="button"
              disabled={disabled}
              onClick={toggleDropdown}
              tabIndex={-1}
              className={`ore-dropdown-trigger ${isOpen ? 'is-open' : ''}`}
            >
              <div className="ore-dropdown-trigger__content">
                {prefixNode && (
                  <div className={`ore-dropdown-trigger__prefix ${!selectedOption ? 'is-placeholder' : ''}`}>
                    {prefixNode}
                  </div>
                )}
                <div className={`ore-dropdown-trigger__label ${!selectedOption ? 'is-placeholder' : ''}`}>
                  {selectedOption ? renderMiddleTruncate(selectedOption.label) : placeholder}
                </div>
              </div>

              <motion.div
                animate={{ rotate: isOpen ? (placement === 'bottom' ? 180 : -180) : 0 }}
                transition={{ duration: 0.18 }}
                className={`ore-dropdown-trigger__arrow ${disabled ? 'is-disabled' : ''} ${!selectedOption ? 'is-placeholder' : ''}`}
              >
                <ChevronDown size={18} />
              </motion.div>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  ref={panelRef}
                  id={panelId}
                  role="listbox"
                  initial={{ opacity: 0, scaleY: 0.96, originY: placement === 'bottom' ? 0 : 1 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  exit={{ opacity: 0, scaleY: 0.96, transition: { duration: 0.1 } }}
                  className="ore-dropdown-panel custom-scrollbar"
                  style={{
                    ...(placement === 'bottom'
                      ? (alignRight ? { top: 'calc(100% + 4px)', right: 0 } : { top: 'calc(100% + 4px)', left: 0 })
                      : (alignRight ? { bottom: 'calc(100% + 4px)', right: 0 } : { bottom: 'calc(100% + 4px)', left: 0 })),
                    minWidth: '100%',
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  {searchable && (
                    <div className="ore-dropdown-search-wrapper">
                      <div className="relative flex h-full items-center">
                        <Search size={14} className="pointer-events-none absolute left-3 text-[#B1B2B5]" />
                        <input autoFocus type="text" value={searchTerm} placeholder="搜索..." onChange={(e) => setSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()} className="ore-dropdown-search-input" />
                      </div>
                    </div>
                  )}

                  <div className="options-scroll-container ore-dropdown-options-list">
                    {filteredOptions.length === 0 ? (
                      <div className="ore-dropdown-empty">无匹配结果</div>
                    ) : (
                      filteredOptions.map((option, index) => {
                        const isSelected = option.value === value;
                        const isHighlighted = highlightedIndex === index;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onMouseEnter={() => setHighlightedIndex(index)}
                            onClick={() => selectOption(option.value)}
                            className={`ore-dropdown-item ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
                            tabIndex={-1}
                          >
                            <span className="ore-dropdown-item__label">
                              {renderMiddleTruncate(option.label)}
                            </span>
                            <span className="ore-dropdown-item__check">
                              {isSelected ? <Check size={16} strokeWidth={3} /> : null}
                            </span>
                          </button>
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