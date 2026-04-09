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
      if (!previous) {
        return previous;
      }

      onOpenChange?.(false);
      return false;
    });
  }, [onOpenChange]);

  const openDropdown = useCallback(() => {
    if (disabled) {
      return;
    }

    setIsOpen((previous) => {
      if (previous) {
        return previous;
      }

      onOpenChange?.(true);
      return true;
    });

    window.dispatchEvent(new CustomEvent('ore-dropdown-toggle', { detail: dropdownId }));
  }, [disabled, dropdownId, onOpenChange]);

  const toggleDropdown = useCallback(() => {
    if (disabled) {
      return;
    }

    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }, [closeDropdown, disabled, isOpen, openDropdown]);

  const selectOption = useCallback(
    (nextValue: string) => {
      onChange(nextValue);
      closeDropdown();
    },
    [closeDropdown, onChange],
  );

  useEffect(() => {
    if (disabled) {
      closeDropdown();
    }
  }, [closeDropdown, disabled]);

  useEffect(() => {
    const handleGlobalToggle = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail !== dropdownId) {
        closeDropdown();
      }
    };

    window.addEventListener('ore-dropdown-toggle', handleGlobalToggle);
    return () => window.removeEventListener('ore-dropdown-toggle', handleGlobalToggle);
  }, [closeDropdown, dropdownId]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      pause();
    } else {
      resume();
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
    if (!isOpen || highlightedIndex < 0) {
      return;
    }

    const optionElements = panelRef.current?.querySelectorAll<HTMLElement>('.ore-dropdown-item');
    optionElements?.[highlightedIndex]?.scrollIntoView({
      block: 'nearest',
    });
  }, [highlightedIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (event.key === 'ArrowDown') {
        setHighlightedIndex((previous) => {
          if (filteredOptions.length === 0) {
            return -1;
          }
          return Math.min(filteredOptions.length - 1, previous + 1);
        });
        return;
      }

      if (event.key === 'ArrowUp') {
        setHighlightedIndex((previous) => {
          if (filteredOptions.length === 0) {
            return -1;
          }
          return Math.max(0, previous - 1);
        });
        return;
      }

      if (event.key === 'Enter') {
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          selectOption(filteredOptions[highlightedIndex].value);
        }
        return;
      }

      closeDropdown();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [closeDropdown, filteredOptions, highlightedIndex, isOpen, selectOption]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [closeDropdown, isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current || !panelRef.current) {
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const panelHeight = panelRef.current.offsetHeight;
    const panelWidth = panelRef.current.offsetWidth || PANEL_WIDTH_FALLBACK;
    const availableBelow = window.innerHeight - triggerRect.top;
    const availableAbove = triggerRect.bottom;

    setPlacement(panelHeight > availableBelow && availableAbove > availableBelow ? 'top' : 'bottom');
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
          className={`ore-dropdown-root relative block h-[40px] w-full rounded-sm ${className} ${
            isOpen ? 'z-[100]' : focused ? 'z-40 scale-[1.02] ring-2 ring-white shadow-lg brightness-110' : 'z-20'
          }`}
        >
          <div ref={containerRef} className="relative flex h-full flex-col">
            <button
              ref={triggerRef}
              type="button"
              disabled={disabled}
              onClick={toggleDropdown}
              tabIndex={-1}
              aria-expanded={isOpen}
              aria-haspopup="listbox"
              aria-controls={panelId}
              className={`ore-dropdown-trigger ${isOpen ? 'is-open' : ''}`}
            >
              <div className="ore-dropdown-trigger__content">
                {prefixNode && (
                  <div
                    className={`ore-dropdown-trigger__prefix ${!selectedOption ? 'is-placeholder' : ''}`}
                  >
                    {prefixNode}
                  </div>
                )}
                <span
                  className={`ore-dropdown-trigger__label ${!selectedOption ? 'is-placeholder' : ''}`}
                >
                  {selectedOption ? selectedOption.label : placeholder}
                </span>
              </div>

              <motion.div
                animate={{ rotate: isOpen ? (placement === 'bottom' ? 180 : -180) : 0 }}
                transition={{ duration: 0.18 }}
                className={`ore-dropdown-trigger__arrow ${disabled ? 'is-disabled' : ''} ${
                  !selectedOption ? 'is-placeholder' : ''
                }`}
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
                  initial={{
                    opacity: 0,
                    scaleY: 0.96,
                    originY: placement === 'bottom' ? 0 : 1,
                  }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  exit={{ opacity: 0, scaleY: 0.96, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className="ore-dropdown-panel custom-scrollbar"
                  data-placement={placement}
                  style={
                    placement === 'bottom'
                      ? alignRight
                        ? { top: 0, right: 0 }
                        : { top: 0, left: 0 }
                      : alignRight
                        ? { bottom: 0, right: 0 }
                        : { bottom: 0, left: 0 }
                  }
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  {searchable && (
                    <div className="ore-dropdown-search-wrapper">
                      <div className="relative flex h-full items-center">
                        <Search
                          size={14}
                          className="pointer-events-none absolute left-3 text-[#B1B2B5]"
                        />
                        <input
                          autoFocus
                          type="text"
                          value={searchTerm}
                          placeholder="搜索..."
                          onChange={(event) => setSearchTerm(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          className="ore-dropdown-search-input"
                        />
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
                            role="option"
                            aria-selected={isSelected}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            onClick={() => selectOption(option.value)}
                            className={`ore-dropdown-item ${isSelected ? 'is-selected' : ''} ${
                              isHighlighted ? 'is-highlighted' : ''
                            }`}
                            tabIndex={-1}
                          >
                            <span className="ore-dropdown-item__label">{option.label}</span>
                            <span className="ore-dropdown-item__check" aria-hidden="true">
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
