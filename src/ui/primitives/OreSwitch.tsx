// /src/ui/primitives/OreSwitch.tsx
import React from 'react';
import { FocusItem } from '../focus/FocusItem';

interface OreSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;      
  disabled?: boolean;
  className?: string;
  focusKey?: string; // ✅ 新增：允许显式指定焦点 ID
}

export const OreSwitch: React.FC<OreSwitchProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
  focusKey,
}) => {
  return (
    // ✅ 1. 使用 FocusItem 接管组件，支持手柄 A 键和键盘 Enter 键直接切换
    <FocusItem focusKey={focusKey} disabled={disabled} onEnter={() => !disabled && onChange(!checked)}>
      {({ ref, focused }) => (
        <div 
          ref={ref as any}
          // ✅ 2. 将 focused 状态转化为 is-focused 类名交给 CSS 处理
          className={`ore-switch-wrapper ${disabled ? 'disabled' : ''} ${focused ? 'is-focused' : ''} ${className}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onChange(!checked);
          }}
          tabIndex={-1} // 禁用原生焦点，全权交由引擎接管
        >
          {/* 文本标签：聚焦时文字会变色并发出绿色光晕 */}
          {label && (
            <span className={`
              mr-3 font-minecraft font-bold ore-text-shadow transition-all duration-200
              ${focused ? 'text-ore-green drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]' : 'text-white'}
            `}>
              {label}
            </span>
          )}

          {/* 开关滑轨 (动态改变背景色，特效均移交 CSS 层) */}
          <div className={`ore-switch-track ${checked ? 'bg-ore-green' : 'bg-ore-gray-track'}`}>
            
            {/* 物理推钮 (仅控制水平位置，动画交由 CSS) */}
            <div 
              className="ore-switch-thumb"
              style={{ left: checked ? '24px' : '-2px' }}
            />
          </div>
        </div>
      )}
    </FocusItem>
  );
};