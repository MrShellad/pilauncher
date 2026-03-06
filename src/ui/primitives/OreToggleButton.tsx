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
}) => {
  const activeOption = options.find((opt) => opt.value === value);

  const sizeClasses = {
    sm: 'h-[40px] text-xs', 
    md: 'h-[44px] text-sm', 
    lg: 'h-[48px] text-base',
    full: 'h-full min-h-[44px]', 
  };

  return (
    <div className={`flex flex-col w-full ${className} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      
      {(title || description) && (
        <div className="mb-2 px-1">
          {title && <div className="font-minecraft font-bold text-white ore-text-shadow text-lg">{title}</div>}
          {description && <div className="font-minecraft text-ore-text-muted text-sm mt-0.5">{description}</div>}
        </div>
      )}

      {/* ✅ 移除了溢出隐藏 (overflow-hidden)，确保高光环可以完美展示 */}
      <div className={`ore-toggle-btn-group flex items-stretch w-full ${sizeClasses[size]}`}>
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <FocusItem
              key={option.value}
              disabled={disabled}
              onEnter={() => !isActive && onChange(option.value)}
            >
              {({ ref, focused }) => (
                <button
                  ref={ref as any}
                  onClick={() => !isActive && onChange(option.value)}
                  className={`
                    ore-toggle-btn-item 
                    px-2 outline-none
                    ${isActive ? 'is-active z-10' : ''}
                    ${focused ? 'is-focused' : ''}
                    ${buttonClassName}
                  `}
                  tabIndex={-1} 
                >
                  {/* 去除导致像素扭曲的 scale 缩放，保持纯粹的刚性 UI */}
                  <div className={`flex items-center justify-center w-full transition-none ${isActive ? 'ore-text-shadow' : ''}`}>
                    {option.label}
                  </div>
                </button>
              )}
            </FocusItem>
          );
        })}
      </div>

      {options.some(opt => opt.description) && (
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