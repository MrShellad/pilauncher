// /src/ui/primitives/OreSwitch.tsx
import React from 'react';

interface OreSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;      // 可选的文字标签
  disabled?: boolean;
  className?: string;
}

export const OreSwitch: React.FC<OreSwitchProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
}) => {
  return (
    // 使用 label 包裹，点击文字也能触发开关
    <label 
      className={`ore-switch-wrapper ${disabled ? 'disabled' : ''} ${className}`}
      // 阻止事件冒泡，防止嵌套在卡片里时触发卡片的点击
      onClick={(e) => e.stopPropagation()}
    >
      {/* 文本标签 */}
      {label && (
        <span className="mr-3 font-minecraft font-bold text-white ore-text-shadow">
          {label}
        </span>
      )}

      {/* 开关滑轨 (动态改变背景色) */}
      <div 
        className={`ore-switch-track ${checked ? 'bg-ore-green' : 'bg-ore-gray-track'}`}
      >
        <input
          type="checkbox"
          className="sr-only" // 隐藏原生 checkbox
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        
        {/* 物理推钮 (动态改变水平位置) */}
        <div 
          className="ore-switch-thumb"
          style={{ 
            left: checked ? '24px' : '-2px' 
          }}
        />
      </div>
    </label>
  );
};