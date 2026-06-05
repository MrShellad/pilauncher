import React from 'react';
import { FocusItem } from '../focus/FocusItem';
import { motion } from 'motion/react';

interface OreSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;      
  disabled?: boolean;
  className?: string;
  focusKey?: string; 
  onArrowPress?: (direction: string) => boolean | void;
  'aria-label'?: string;
}

export const OreSwitch: React.FC<OreSwitchProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
  focusKey,
  onArrowPress,
  'aria-label': ariaLabel,
}) => {
  return (
    // 1. 使用 FocusItem 接管组件，支持手柄 A 键和键盘 Enter 键直接切换
    <FocusItem
      focusKey={focusKey}
      disabled={disabled}
      onEnter={() => !disabled && onChange(!checked)}
      onArrowPress={onArrowPress}
    >
      {({ ref, focused, tabIndex }) => (
        <div 
          ref={ref as any}
          role="switch"
          aria-checked={checked}
          aria-disabled={disabled}
          aria-label={ariaLabel || label}
          // We remove 'is-on' class name to let motion handle the left layout transitions
          className={`ore-switch-wrapper ${disabled ? 'disabled' : ''} ${focused ? 'is-focused' : ''} ${className}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onChange(!checked);
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              onChange(!checked);
            }
          }}
          tabIndex={tabIndex}
        >
          {/* 文本标签 */}
          {label && (
            <span className={`
              mr-3 font-minecraft font-bold ore-text-shadow transition-colors duration-150
              ${disabled ? 'text-[#5A5A5A]' : (checked ? 'text-[var(--ore-btn-primary-bg)]' : 'text-white')}
              ${focused ? 'brightness-110' : ''}
            `}>
              {label}
            </span>
          )}

          {/* 开关滑轨 */}
          <div className="ore-switch-track">
            {/* 物理推钮 (使用 transform 进行 GPU 加速平移，避免 animate left 引起的 reflow 抖动) */}
            <motion.div 
              className="ore-switch-thumb"
              initial={false}
              animate={{ x: checked ? 30 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{ transition: 'none', willChange: 'transform' }}
            />
          </div>
        </div>
      )}
    </FocusItem>
  );
};
