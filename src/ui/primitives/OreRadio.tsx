// /src/ui/primitives/OreRadio.tsx
import React from 'react';
import { FocusItem } from '../focus/FocusItem';
import '../../style/tokens/designToken';

export interface OreRadioProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  focusKey?: string;
  onArrowPress?: (direction: string) => boolean | void;
  'aria-label'?: string;
  autoScroll?: boolean;
  name?: string;
  value?: string;
}

export const OreRadio: React.FC<OreRadioProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
  focusKey,
  onArrowPress,
  'aria-label': ariaLabel,
  autoScroll = false,
}) => {
  return (
    <FocusItem
      focusKey={focusKey}
      disabled={disabled}
      onEnter={() => !disabled && onChange(true)}
      onArrowPress={onArrowPress}
      autoScroll={autoScroll}
    >
      {({ ref, focused, tabIndex }) => (
        <div
          ref={ref as any}
          role="radio"
          aria-checked={checked}
          aria-disabled={disabled}
          aria-label={ariaLabel || label}
          className={`ore-radio-wrapper ${checked ? 'is-checked' : ''} ${disabled ? 'disabled' : ''} ${focused ? 'is-focused' : ''} ${className}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onChange(true);
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              onChange(true);
            }
          }}
          tabIndex={tabIndex}
        >
          {/* 45° 菱形盒体 */}
          <div className="ore-radio-diamond-container">
            <div className="ore-radio-diamond">
              {checked && (
                <div className="ore-radio-dot" />
              )}
            </div>
          </div>

          {/* 文本标签 */}
          {label && (
            <span className="ore-radio-label">
              {label}
            </span>
          )}
        </div>
      )}
    </FocusItem>
  );
};
