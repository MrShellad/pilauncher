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
  focusable?: boolean; // ✅ 新增：允许关闭该组件的焦点获取功能
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
  focusable = true, // 默认依然可以获取焦点
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

      <div className={`ore-toggle-btn-group flex items-stretch w-full ${sizeClasses[size]}`}>
        {options.map((option) => {
          const isActive = option.value === value;

          // ✅ 将按钮渲染逻辑抽取出来
          const renderButton = (ref?: any, focused: boolean = false) => (
            <button
              ref={ref}
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
              <div className={`flex items-center justify-center w-full transition-none ${isActive ? 'ore-text-shadow' : ''}`}>
                {option.label}
              </div>
            </button>
          );

          // ✅ 如果不允许获取焦点，则抛弃 FocusItem 包裹，直接输出纯静态按钮 (仅保留鼠标点击能力)
          if (!focusable) {
            return <React.Fragment key={option.value}>{renderButton()}</React.Fragment>;
          }

          return (
            <FocusItem
              key={option.value}
              disabled={disabled}
              onEnter={() => !isActive && onChange(option.value)}
            >
              {({ ref, focused }) => renderButton(ref as any, focused)}
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