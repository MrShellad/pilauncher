// src/ui/primitives/OreButton.tsx
import React from 'react';
import { FocusItem } from '../focus/FocusItem';

// ✅ 核心修复：引入 designToken，确保打包器加载它，并触发内部的 CSS 变量全局注入！
import '../../style/tokens/designToken'; 

interface OreButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'purple' | 'hero' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'auto' | 'full'; 
  focusKey?: string; 
  focusable?: boolean;
  onArrowPress?: (direction: string) => boolean | void;
  autoScroll?: boolean;
}

export const OreButton: React.FC<OreButtonProps> = ({ 
  children, 
  variant = 'secondary', 
  size = 'md', 
  className = '',
  disabled,
  onClick,
  focusKey, 
  focusable = true,
  onArrowPress,
  autoScroll,
  ...props 
}) => {

  const buttonSizes = {
    sm: "min-w-[var(--ore-btn-sm-min-w,7.5rem)] h-[var(--ore-btn-sm-h,2.25rem)] px-4 text-sm", 
    md: "min-w-[var(--ore-btn-md-min-w,10rem)] h-[var(--ore-btn-md-h,2.5rem)] px-6 text-base", 
    lg: "min-w-[var(--ore-btn-lg-min-w,12.5rem)] h-[var(--ore-btn-lg-h,2.75rem)] px-8 text-lg", 
    auto: "w-auto min-w-[var(--ore-btn-auto-min-w,6.25rem)] h-[var(--ore-btn-md-h,2.5rem)] px-5 text-base", 
    full: "w-full h-[var(--ore-btn-md-h,2.5rem)] px-4 text-base", 
  };
  
  const variants = {
    primary: "ore-btn-primary ore-text-shadow",
    hero: "ore-btn-primary ore-text-shadow text-lg tracking-wider", // Hero为强化版Primary
    secondary: "ore-btn-secondary",
    danger: "ore-btn-danger ore-text-shadow",
    purple: "ore-btn-purple ore-text-shadow", 
    ghost: "ore-btn-ghost",
  };

  return (
    <FocusItem 
      focusKey={focusKey} 
      disabled={disabled} 
      focusable={focusable}
      onArrowPress={onArrowPress}
      autoScroll={autoScroll}
      onEnter={() => onClick && onClick({ preventDefault: () => {}, stopPropagation: () => {} } as any)}
    >
      {({ ref, focused, tabIndex }) => (
        <button
          ref={ref}
          disabled={disabled}
          onClick={onClick}
          tabIndex={tabIndex}
          // 单层尺寸控制，采用rem和标准响应式类适配TV/SteamDeck/PC，同时支持 focus-visible 焦点环
          className={`
            ore-btn relative inline-flex items-center justify-center font-minecraft tracking-wide
            focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 transition-none antialiased
            ${buttonSizes[size]}
            ${variants[variant]}
            ${focused ? 'is-focused' : ''}
            ${className}
          `}
          style={{ fontWeight: 'normal', ...props.style }}
          {...props}
        >
          {children}
        </button>
      )}
    </FocusItem>
  );
};
