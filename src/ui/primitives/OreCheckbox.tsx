// /src/ui/primitives/OreCheckbox.tsx
import React from 'react';
import { FocusItem } from '../focus/FocusItem';

interface OreCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  focusKey?: string;
  onArrowPress?: (direction: string) => boolean | void;
}

export const OreCheckbox: React.FC<OreCheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
  focusKey,
  onArrowPress,
}) => {
  return (
    <FocusItem
      focusKey={focusKey}
      disabled={disabled}
      onEnter={() => !disabled && onChange(!checked)}
      onArrowPress={onArrowPress}
    >
      {({ ref, focused }) => (
        <div
          ref={ref as any}
          className={`ore-checkbox-wrapper ${checked ? 'is-checked' : ''} ${disabled ? 'disabled' : ''} ${focused ? 'is-focused' : ''} ${className}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onChange(!checked);
          }}
          tabIndex={-1}
        >
          {/* Checkbox 盒体 */}
          <div className="ore-checkbox-box">
            {checked && (
              <svg
                className="ore-checkbox-checkmark"
                viewBox="0 0 9 9"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
              >
                {/* 3D 像素阴影 */}
                <path
                  d="M1.5 5.5L2.5 5.5L2.5 6.5L3.5 6.5L3.5 7.5L4.5 7.5L4.5 6.5L5.5 6.5L5.5 5.5L6.5 5.5L6.5 4.5L7.5 4.5L7.5 3.5L8.5 3.5"
                  stroke={disabled ? '#5A5A5A' : '#1D4D13'}
                  strokeWidth="1"
                />
                {/* 顶层白色像素对勾 */}
                <path
                  d="M1.5 4.5L2.5 4.5L2.5 5.5L3.5 5.5L3.5 6.5L4.5 6.5L4.5 5.5L5.5 5.5L5.5 4.5L6.5 4.5L6.5 3.5L7.5 3.5L7.5 2.5L8.5 2.5"
                  stroke={disabled ? '#B5B5B5' : '#FFFFFF'}
                  strokeWidth="1"
                />
              </svg>
            )}
          </div>

          {/* 文本标签 */}
          {label && (
            <span className="ore-checkbox-label">
              {label}
            </span>
          )}
        </div>
      )}
    </FocusItem>
  );
};
