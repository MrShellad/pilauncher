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
import { createPortal } from 'react-dom';

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
  portal?: boolean;
  lazy?: boolean;
  lazyBatchSize?: number;
  panelWidth?: 'content' | 'trigger';
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
  portal = false,
  lazy = false,
  lazyBatchSize = 48,
  panelWidth = 'content',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<DropdownPlacement>('bottom');
  const [alignRight, setAlignRight] = useState(false);
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleOptionCount, setVisibleOptionCount] = useState(lazy ? lazyBatchSize : Number.MAX_SAFE_INTEGER);

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
  const renderedOptions = useMemo(
    () => (lazy ? filteredOptions.slice(0, visibleOptionCount) : filteredOptions),
    [filteredOptions, lazy, visibleOptionCount],
  );
  const hasMoreOptions = lazy && renderedOptions.length < filteredOptions.length;

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
    if (!isOpen) return;
    setVisibleOptionCount(lazy ? Math.max(8, lazyBatchSize) : Number.MAX_SAFE_INTEGER);
  }, [isOpen, lazy, lazyBatchSize, options, searchTerm]);

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
    if (lazy && highlightedIndex >= visibleOptionCount - 4 && visibleOptionCount < filteredOptions.length) {
      setVisibleOptionCount((count) => Math.min(filteredOptions.length, count + lazyBatchSize));
    }
    const optionElements = panelRef.current?.querySelectorAll<HTMLElement>('.ore-dropdown-item');
    optionElements?.[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [filteredOptions.length, highlightedIndex, isOpen, lazy, lazyBatchSize, visibleOptionCount]);

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
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      closeDropdown();
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [closeDropdown, isOpen]);

  const updatePanelGeometry = useCallback(() => {
    if (!isOpen || !triggerRef.current || !panelRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const panelHeight = panelRef.current.offsetHeight;
    const measuredPanelWidth = panelWidth === 'trigger'
      ? triggerRect.width
      : panelRef.current.offsetWidth || PANEL_WIDTH_FALLBACK;
    const availableBelow = window.innerHeight - triggerRect.bottom;
    const availableAbove = triggerRect.top;
    const isSpaceShort = availableBelow < 160;
    const nextPlacement = (panelHeight > availableBelow || isSpaceShort) && availableAbove > availableBelow ? 'top' : 'bottom';
    const nextAlignRight = triggerRect.left + measuredPanelWidth > window.innerWidth && triggerRect.right - measuredPanelWidth >= 0;
    setPlacement(nextPlacement);
    setAlignRight(nextAlignRight);

    if (portal) {
      const left = nextAlignRight
        ? Math.max(12, triggerRect.right - measuredPanelWidth)
        : Math.min(triggerRect.left, Math.max(12, window.innerWidth - measuredPanelWidth - 12));
      const top = nextPlacement === 'bottom'
        ? Math.min(triggerRect.bottom + 4, window.innerHeight - 12)
        : Math.max(12, triggerRect.top - panelHeight - 4);
      setPortalStyle({
        position: 'fixed',
        top,
        left,
        ...(panelWidth === 'trigger'
          ? { width: triggerRect.width, minWidth: triggerRect.width, maxWidth: triggerRect.width }
          : { minWidth: triggerRect.width }),
        zIndex: 10000,
      });
    }
  }, [isOpen, panelWidth, portal]);

  useLayoutEffect(() => {
    updatePanelGeometry();
  }, [filteredOptions.length, isOpen, options.length, searchTerm, searchable, updatePanelGeometry]);

  useEffect(() => {
    if (!isOpen || !portal) return;
    window.addEventListener('resize', updatePanelGeometry);
    window.addEventListener('scroll', updatePanelGeometry, true);
    return () => {
      window.removeEventListener('resize', updatePanelGeometry);
      window.removeEventListener('scroll', updatePanelGeometry, true);
    };
  }, [isOpen, portal, updatePanelGeometry]);

  const handlePanelScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!hasMoreOptions) return;
    const panel = event.currentTarget;
    if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 80) {
      setVisibleOptionCount((count) => Math.min(filteredOptions.length, count + lazyBatchSize));
    }
  };

  const dropdownPanel = (
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
          style={portal
            ? (portalStyle || { position: 'fixed', top: 0, left: 0, visibility: 'hidden' })
            : {
                ...(placement === 'bottom'
                  ? (alignRight ? { top: 'calc(100% + 4px)', right: 0 } : { top: 'calc(100% + 4px)', left: 0 })
                  : (alignRight ? { bottom: 'calc(100% + 4px)', right: 0 } : { bottom: 'calc(100% + 4px)', left: 0 })),
                ...(panelWidth === 'trigger'
                  ? { width: '100%', minWidth: '100%', maxWidth: '100%' }
                  : { minWidth: '100%' }),
              }}
          onScroll={handlePanelScroll}
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
              renderedOptions.map((option, index) => {
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
            {hasMoreOptions && (
              <div className="ore-dropdown-lazy-status">
                正在加载更多...
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

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
          className={`ore-dropdown-root relative block h-[40px] w-full rounded-sm ${className} ${isOpen ? 'z-[100]' : 'z-20'} ${focused ? 'is-focused' : ''}`}
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

            {portal && typeof document !== 'undefined'
              ? createPortal(dropdownPanel, document.body)
              : dropdownPanel}
          </div>
        </div>
      )}
    </FocusItem>
  );
};
