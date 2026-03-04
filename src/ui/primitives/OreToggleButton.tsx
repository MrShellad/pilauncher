// /src/ui/primitives/OreToggleButton.tsx
import React from 'react';

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
  className?: string;        // 控制最外层容器的样式 (如 w-full, w-1/2 等)
  buttonClassName?: string;  // ✅ 控制按钮自身的样式 (如 aspect-square, px-4 等)
  size?: 'sm' | 'md' | 'lg' | 'full'; // ✅ 预设的高度和排版尺寸
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
  size = 'full', // 默认使用 full，完美向后兼容 FilterBar
}) => {
  const activeOption = options.find((opt) => opt.value === value);

  // ✅ 根据 size 动态映射容器高度与默认文字大小
  const sizeClasses = {
    sm: 'h-8 text-xs',
    md: 'min-h-[36px] text-sm',
    lg: 'min-h-[48px] text-base',
    full: 'h-full min-h-[36px]', // 填满父容器高度
  };

  return (
    <div className={`flex flex-col w-full ${className} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      
      {/* 1. 顶部文本区 */}
      {(title || description) && (
        <div className="mb-2 px-1">
          {title && <div className="font-minecraft font-bold text-white ore-text-shadow text-lg">{title}</div>}
          {description && <div className="font-minecraft text-ore-text-muted text-sm mt-0.5">{description}</div>}
        </div>
      )}

      {/* 2. 核心按钮组：注入高度控制，并强行去除多余底边 */}
      <div className={`ore-toggle-btn-group flex w-full !border-b-0 ${sizeClasses[size]}`}>
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              onClick={() => !isActive && onChange(option.value)}
              // ✅ h-full 确保按钮撑满组容器；注入 buttonClassName 实现高级定制
              className={`
                ore-toggle-btn-item 
                flex-1 flex items-center justify-center h-full px-2 
                border-2 transition-all duration-200
                ${isActive ? 'is-active border-ore-green' : 'border-transparent'}
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
          );
        })}
      </div>

      {/* 3. 底部描述区 */}
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