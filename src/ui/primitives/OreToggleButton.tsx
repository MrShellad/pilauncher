// /src/ui/primitives/OreToggleButton.tsx
import React from 'react';
import { FocusItem } from '../focus/FocusItem';

export interface ToggleOption {
  label: React.ReactNode;
  value: string;
  description?: string;
}

interface OreToggleButtonProps {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
  title?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
  focusable?: boolean;
  focusKeyPrefix?: string;
  onArrowPress?: (direction: string) => boolean | void;
  uiScale?: 'default' | 'adaptive';
}

export const OreToggleButton: React.FC<OreToggleButtonProps> = ({
  options,
  value,
  onChange,
  title,
  description,
  disabled = false,
  className = '',
  buttonClassName = '',
  size = 'full',
  focusable = true,
  focusKeyPrefix,
  onArrowPress,
  uiScale = 'default',
}) => {
  const activeOption = options.find((opt) => opt.value === value);
  const isAdaptiveScale = uiScale === 'adaptive';

  const sizeClasses = {
    xs: 'h-8 text-xs',
    sm: 'h-9 text-xs',
    md: 'h-10 text-sm sm:text-base',
    lg: 'h-12 text-lg',
    full: 'h-full min-h-9',
  };

  return (
    <div
      className={`
        flex flex-col ${isAdaptiveScale ? 'w-max' : 'w-full'}
        ${isAdaptiveScale ? 'ore-toggle-btn-scale-adaptive' : ''}
        ${className}
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      {(title || description) && (
        <div className="mb-2 px-1">
          {title && <div className="font-minecraft font-bold text-white ore-text-shadow text-lg">{title}</div>}
          {description && <div className="font-minecraft text-ore-text-muted text-sm mt-0.5">{description}</div>}
        </div>
      )}

      <div
        role="radiogroup"
        aria-label={title}
        className={`
          ore-toggle-btn-group flex items-stretch
          ${isAdaptiveScale ? 'ore-toggle-btn-group--adaptive' : `w-full ${sizeClasses[size] || sizeClasses.sm}`}
        `}
      >
        {options.map((option, idx) => {
          const isActive = option.value === value;
          const optionFocusKey = focusKeyPrefix ? `${focusKeyPrefix}-${idx}` : undefined;

          const renderButton = (ref?: any, focused: boolean = false, tabIndex: number = -1) => (
            <button
              ref={ref}
              onClick={() => !isActive && onChange(option.value)}
              role="radio"
              aria-checked={isActive}
              aria-disabled={disabled}
              className={`
                ore-toggle-btn-item h-full
                px-2 outline-none
                ${isActive ? 'is-active z-10' : ''}
                ${focused ? 'is-focused' : ''}
                ${buttonClassName}
              `}
              tabIndex={tabIndex}
            >
              <div className={`flex items-center justify-center whitespace-nowrap w-full transition-none ${isActive ? 'ore-text-shadow' : ''}`}>
                {option.label}
              </div>
            </button>
          );

          if (!focusable) {
            return <React.Fragment key={option.value}>{renderButton(undefined, false, -1)}</React.Fragment>;
          }

          return (
            <FocusItem
              key={option.value}
              focusKey={optionFocusKey}
              disabled={disabled}
              onArrowPress={onArrowPress}
              onEnter={() => !isActive && onChange(option.value)}
            >
              {({ ref, focused, tabIndex }) => renderButton(ref as any, focused, tabIndex)}
            </FocusItem>
          );
        })}
      </div>

      {options.some((opt) => opt.description) && (
        <div className="mt-2 px-1 min-h-[20px]">
          {activeOption?.description && (
            <div className="font-minecraft text-ore-text-muted text-xs">
              {activeOption.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
