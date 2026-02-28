// /src/ui/primitives/OreSwitch.tsx
import React from 'react';
import { FocusItem } from '../focus/FocusItem';

interface OreSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;      
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
    // ✅ 1. 使用 FocusItem 接管状态，支持手柄 A 键和键盘 Enter 键
    <FocusItem disabled={disabled} onEnter={() => !disabled && onChange(!checked)}>
      {({ ref, focused }) => (
        <div 
          ref={ref}
          className={`ore-switch-wrapper ${disabled ? 'disabled' : ''} ${className}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onChange(!checked);
          }}
          tabIndex={disabled ? -1 : 0}
        >
          {/* 文本标签 */}
          {label && (
            <span className="mr-3 font-minecraft font-bold text-white ore-text-shadow">
              {label}
            </span>
          )}

          {/* 开关滑轨 (动态改变背景色，并且在获取焦点时加上白色高亮光环) */}
          <div 
            className={`
              ore-switch-track transition-all duration-300
              ${checked ? 'bg-ore-green' : 'bg-ore-gray-track'}
              ${focused ? 'ring-2 ring-white ring-offset-2 ring-offset-[#2A2A2C] brightness-110' : ''}
            `}
          >
            {/* 物理推钮 (动态改变水平位置) */}
            <div 
              className="ore-switch-thumb"
              style={{ 
                left: checked ? '24px' : '-2px' 
              }}
            />
          </div>
        </div>
      )}
    </FocusItem>
  );
};