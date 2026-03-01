// /src/ui/primitives/OreToggleButton.tsx
import React from 'react';

export interface ToggleOption {
  label: React.ReactNode; // ✅ 改为 ReactNode，以支持传入 SVG 图标或复杂的 HTML
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

      {/* 2. 核心按钮组 */}
      <div className="ore-toggle-btn-group">
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              onClick={() => !isActive && onChange(option.value)}
              className={`ore-toggle-btn-item ${isActive ? 'is-active' : ''}`}
              tabIndex={-1} // 移交控制权给 FocusItem
            >
              <span className={`flex items-center justify-center truncate ${isActive ? 'ore-text-shadow' : ''}`}>
                {option.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. 底部描述区 (✅ 修复：如果没有配置 description，彻底不渲染该区域，防止撑高顶部栏) */}
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