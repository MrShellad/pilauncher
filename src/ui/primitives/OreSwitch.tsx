// /src/ui/primitives/OreSwitch.tsx
import React from 'react';
import { FocusItem } from '../focus/FocusItem';

interface OreSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;      
  disabled?: boolean;
  className?: string;
  focusKey?: string; 
  onArrowPress?: (direction: string) => boolean | void;
}

export const OreSwitch: React.FC<OreSwitchProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
  focusKey,
  onArrowPress,
}) => {
  return (
    // 1. 使用 FocusItem 接管组件，支持手柄 A 键和键盘 Enter 键直接切换
    <FocusItem
      focusKey={focusKey}
      disabled={disabled}
      onEnter={() => !disabled && onChange(!checked)}
      onArrowPress={onArrowPress}
    >
      {({ ref, focused }) => (
        <div 
          ref={ref as any}
          // ✅ 核心修复：添加 is-on 状态类名，将内外光影和滑块位移全权交给 CSS 处理
          className={`ore-switch-wrapper ${checked ? 'is-on' : ''} ${disabled ? 'disabled' : ''} ${focused ? 'is-focused' : ''} ${className}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onChange(!checked);
          }}
          tabIndex={-1} // 禁用原生焦点
        >
          {/* 文本标签：聚焦时文字会变绿并发出光晕 */}
          {label && (
            <span className={`
              mr-3 font-minecraft font-bold ore-text-shadow transition-all duration-200
              ${focused ? 'text-[var(--ore-btn-primary-bg)] drop-shadow-[0_0_8px_rgba(60,133,39,0.4)]' : 'text-white'}
            `}>
              {label}
            </span>
          )}

          {/* 开关滑轨 */}
          <div className="ore-switch-track">
            {/* 物理推钮 (无需 inline style，全由 CSS 驱动) */}
            <div className="ore-switch-thumb" />
          </div>
        </div>
      )}
    </FocusItem>
  );
};
