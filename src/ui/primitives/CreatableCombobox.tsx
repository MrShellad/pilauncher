import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useId,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, Search } from 'lucide-react';
import { pause, resume } from '@noriginmedia/norigin-spatial-navigation';

import { FocusBoundary } from '../focus/FocusBoundary';
import { OreInput } from './OreInput';
import { OreOverlayScrollArea } from './OreOverlayScrollArea';

export interface ComboboxOption {
  label: string;
  value: string;
  [key: string]: any;
}

interface CreatableComboboxProps {
  options: ComboboxOption[];
  value: string; // Currently selected option's value
  onChange: (option: ComboboxOption) => void;
  onCreate?: (inputValue: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  focusKey?: string;
  prefixNode?: React.ReactNode;
  label?: string;
}

export const CreatableCombobox: React.FC<CreatableComboboxProps> = ({
  options,
  value,
  onChange,
  onCreate,
  placeholder = '输入或选择...',
  disabled = false,
  className = '',
  focusKey,
  prefixNode,
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const comboboxId = useId().replace(/:/g, '');
  const panelId = `ore-combobox-panel-${comboboxId}`;

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value || opt.label === value);
  }, [options, value]);

  // Handle outside updates to value or options when dropdown is closed
  useEffect(() => {
    if (!isOpen) {
      setInputValue(selectedOption ? selectedOption.label : value || '');
    }
  }, [selectedOption, value, isOpen]);

  // Filter options based on user input (fuzzy match, case-insensitive)
  const filteredOptions = useMemo(() => {
    const trimmed = inputValue.trim().toLowerCase();
    if (!trimmed) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(trimmed)
    );
  }, [options, inputValue]);

  // Determine if we should show the "Create New Option" item
  const trimmedInput = inputValue.trim();
  const showCreateOption = useMemo(() => {
    if (!trimmedInput || !onCreate) return false;
    // Check if there is an exact match (case-insensitive and trimmed)
    const hasExactMatch = options.some(
      (option) => option.label.trim().toLowerCase() === trimmedInput.toLowerCase()
    );
    return !hasExactMatch;
  }, [options, trimmedInput, onCreate]);

  // Total items in list (filtered options + create item if visible)
  const totalListItemsCount = useMemo(() => {
    return filteredOptions.length + (showCreateOption ? 1 : 0);
  }, [filteredOptions.length, showCreateOption]);

  // Pause spatial navigation when open to allow arrow keys navigation inside combobox
  useEffect(() => {
    if (isOpen) {
      pause();
    } else {
      resume();
    }
    return () => {
      resume();
    };
  }, [isOpen]);

  // Reset highlight when filtered options change
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(filteredOptions.length > 0 ? 0 : showCreateOption ? 0 : -1);
    } else {
      setHighlightedIndex(-1);
    }
  }, [filteredOptions.length, showCreateOption, isOpen]);

  // Position portal-rendered listbox dynamically
  const updatePanelGeometry = useCallback(() => {
    if (!isOpen || !containerRef.current || !panelRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const listHeight = Math.min(240, Math.max(120, window.innerHeight - rect.bottom - 18));
    setPortalStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      height: listHeight,
      zIndex: 10020,
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    updatePanelGeometry();
    window.addEventListener('resize', updatePanelGeometry);
    window.addEventListener('scroll', updatePanelGeometry, true);
    return () => {
      window.removeEventListener('resize', updatePanelGeometry);
      window.removeEventListener('scroll', updatePanelGeometry, true);
    };
  }, [isOpen, updatePanelGeometry]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    const optionElements = panelRef.current?.querySelectorAll<HTMLElement>(
      '.ore-combobox-item, .ore-combobox-create-item'
    );
    optionElements?.[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  const selectOption = useCallback(
    (option: ComboboxOption) => {
      onChange(option);
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [onChange]
  );

  const createOption = useCallback(
    (text: string) => {
      if (onCreate && text.trim()) {
        onCreate(text.trim());
      }
      setInputValue('');
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [onCreate]
  );

  // Keyboard navigation inside open list
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) return;

      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'ArrowDown') {
        setHighlightedIndex((prev) =>
          totalListItemsCount === 0 ? -1 : Math.min(totalListItemsCount - 1, prev + 1)
        );
      } else if (event.key === 'ArrowUp') {
        setHighlightedIndex((prev) =>
          totalListItemsCount === 0 ? -1 : Math.max(0, prev - 1)
        );
      } else if (event.key === 'Enter') {
        if (highlightedIndex >= 0 && highlightedIndex < totalListItemsCount) {
          if (highlightedIndex < filteredOptions.length) {
            selectOption(filteredOptions[highlightedIndex]);
          } else if (showCreateOption && highlightedIndex === filteredOptions.length) {
            createOption(trimmedInput);
          }
        }
      } else if (event.key === 'Escape') {
        setIsOpen(false);
        setInputValue(selectedOption ? selectedOption.label : '');
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [
    isOpen,
    highlightedIndex,
    filteredOptions,
    showCreateOption,
    trimmedInput,
    totalListItemsCount,
    selectOption,
    createOption,
    selectedOption,
  ]);

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    setIsOpen(true);
  };

  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      setInputValue(selectedOption ? selectedOption.label : '');
    }, 150);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
    setIsOpen(true);
  };

  const listboxPanel = (
    <FocusBoundary id={`ore-combobox-listbox-boundary-${comboboxId}`}>
      <div
        ref={panelRef}
        id={panelId}
        role="listbox"
        className="ore-combobox-panel"
        style={
          portalStyle || {
            position: 'fixed',
            top: 0,
            left: 0,
            width: 1,
            height: 1,
            visibility: 'hidden',
          }
        }
      >
        <OreOverlayScrollArea
          className="h-full"
          contentClassName="ore-combobox-options-list"
          safeInsetTop={6}
          safeInsetBottom={6}
          safeInsetRight={4}
          contentSafePaddingRight={18}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const active = option.value === value;
              const highlighted = highlightedIndex === index;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(option)}
                  className={[
                    'ore-combobox-item',
                    highlighted ? 'is-highlighted' : active ? 'is-active' : 'is-normal',
                  ].join(' ')}
                >
                  <span className="truncate">{option.label}</span>
                  {active && <Check size={15} />}
                </button>
              );
            })
          ) : !showCreateOption ? (
            <div className="ore-combobox-empty">暂无数据</div>
          ) : null}

          {showCreateOption && (
            <button
              type="button"
              onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => createOption(trimmedInput)}
              className={[
                'ore-combobox-create-item',
                highlightedIndex === filteredOptions.length ? 'is-highlighted' : '',
              ].join(' ')}
            >
              <span className="truncate">➕ 创建 "{trimmedInput}"</span>
            </button>
          )}
        </OreOverlayScrollArea>
      </div>
    </FocusBoundary>
  );

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <OreInput
        ref={inputRef}
        focusKey={focusKey}
        disabled={disabled}
        value={inputValue}
        label={label}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleInputChange}
        placeholder={placeholder}
        prefixNode={prefixNode || <Search size={15} />}
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={panelId}
        role="combobox"
      />

      {isOpen && typeof document !== 'undefined' && createPortal(listboxPanel, document.body)}
    </div>
  );
};
