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
  className?: string;
}

export const OreToggleButton: React.FC<OreToggleButtonProps> = ({
  options,
  value,
  onChange,
  title,
  description,
  disabled = false,
  className = '',
}) => {
  const activeOption = options.find((opt) => opt.value === value);

  return (
    <div className={`flex flex-col w-full ${className} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      
      {/* 1. 顶部文本区 */}
      {(title || description) && (
        <div className="mb-2 px-1">
          {title && <div className="font-minecraft font-bold text-white ore-text-shadow text-lg">{title}</div>}
          {description && <div className="font-minecraft text-ore-text-muted text-sm mt-0.5">{description}</div>}
        </div>
      )}

      {/* 2. 核心按钮组：完全恢复你的 ore-toggle-btn-group 类名 */}
      <div className="ore-toggle-btn-group flex w-full">
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              onClick={() => !isActive && onChange(option.value)}
              // ✅ 核心修复：
              // 1. 保留你的 ore-toggle-btn-item 和 is-active 样式
              // 2. min-h-[48px] 让按钮变得更大气
              // 3. border-2 border-transparent：提前占下 2px 的边框位置！这样当你点击加上边框时，就不会发生任何抖动了。
              className={`
                ore-toggle-btn-item 
                flex-1 flex items-center justify-center min-h-[48px] px-2 
                border-2 transition-all duration-200
                ${isActive ? 'is-active border-ore-green' : 'border-transparent'}
              `}
              tabIndex={-1} 
            >
              {/* ✅ flex items-center justify-center 确保内部的 SVG 和文字绝对居中对齐 */}
              <span className={`
                flex items-center justify-center truncate transition-transform duration-200
                ${isActive ? 'ore-text-shadow scale-105' : 'scale-100'}
              `}>
                {option.label}
              </span>
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