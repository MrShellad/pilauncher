// /src/ui/primitives/OreToggleButton.tsx
import React from 'react';
import { FocusItem } from '../focus/FocusItem'; // ✅ 引入空间导航核心组件

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

      <div className={`ore-toggle-btn-group flex items-stretch w-full overflow-hidden ${sizeClasses[size]}`}>
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            // ✅ 核心修复：为每个选项注入 FocusItem，支持键盘左右键导航与 Enter 键触发
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
                    flex-1 flex items-center justify-center px-2 
                    border-2 transition-all duration-200 outline-none
                    ${isActive ? 'is-active border-ore-green z-10' : 'border-transparent'}
                    ${focused ? 'ring-2 ring-white scale-[1.02] z-30 brightness-125 shadow-lg' : ''}
                    ${buttonClassName}
                  `}
                  tabIndex={-1} 
                >
                  <div className={`
                    flex items-center justify-center w-full transition-transform duration-200
                    ${isActive ? 'ore-text-shadow scale-[1.03]' : 'scale-100'}
                  `}>
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