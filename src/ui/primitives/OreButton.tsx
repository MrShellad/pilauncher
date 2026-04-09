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
    sm: "min-w-[7.5rem] h-9 px-4 text-sm", 
    md: "min-w-[10rem] h-10 px-6 text-base", 
    lg: "min-w-[12.5rem] h-11 px-8 text-lg", 
    auto: "w-auto min-w-[6.25rem] h-10 px-5 text-base", 
    full: "w-full h-10 md:h-12 lg:h-14 px-4 md:px-6 text-base md:text-lg lg:text-xl", 
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
      {({ ref, focused }) => (
        <button
          ref={ref}
          disabled={disabled}
          onClick={onClick}
          // 单层尺寸控制，采用rem和标准响应式类适配TV/SteamDeck/PC
          className={`
            ore-btn relative inline-flex items-center justify-center font-minecraft tracking-wide
            focus:outline-none transition-none transform-gpu backface-hidden antialiased
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
