// src/ui/primitives/OreButton.tsx
import React from 'react';
import { FocusItem } from '../focus/FocusItem';

// ✅ 核心修复：引入 designToken，确保打包器加载它，并触发内部的 CSS 变量全局注入！
import '../../style/tokens/designToken'; 

interface OreButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'purple' | 'hero';
  size?: 'sm' | 'md' | 'lg' | 'auto' | 'full'; 
  focusKey?: string; 
}

export const OreButton: React.FC<OreButtonProps> = ({ 
  children, 
  variant = 'secondary', 
  size = 'md', 
  className = '',
  disabled,
  onClick,
  focusKey, 
  ...props 
}) => {

  const wrapperSizes = {
    sm: "min-w-[120px] h-[36px]", 
    md: "min-w-[160px] h-[40px]", 
    lg: "min-w-[200px] h-[44px]", 
    auto: "w-auto min-w-[100px] h-[40px]", 
    full: "w-full h-[40px] md:h-[48px] lg:h-[56px]", 
  };
  
  const buttonSizes = {
    sm: "px-4 text-sm", 
    md: "px-6 text-base", 
    lg: "px-8 text-base", 
    auto: "px-5 text-base", 
    full: "px-4 md:px-6 text-base md:text-lg lg:text-xl", 
  };
  
  const variants = {
    primary: "ore-btn-primary ore-text-shadow",
    hero: "ore-btn-primary ore-text-shadow text-lg tracking-wider", // Hero为强化版Primary
    secondary: "ore-btn-secondary",
    danger: "ore-btn-danger ore-text-shadow",
    purple: "ore-btn-purple ore-text-shadow", 
  };

  return (
    <FocusItem 
      focusKey={focusKey} 
      disabled={disabled} 
      onEnter={() => onClick && onClick({ preventDefault: () => {}, stopPropagation: () => {} } as any)}
    >
      {({ ref, focused }) => (
        <div className={`inline-flex items-start justify-center ${wrapperSizes[size]} ${className}`}>
          <button
            ref={ref}
            disabled={disabled}
            onClick={onClick}
            // 样式控制全部移交至上一轮写好的 OreButton.css
            className={`
              ore-btn relative w-full h-full font-minecraft flex items-center justify-center tracking-wide
              focus:outline-none transition-none transform-gpu backface-hidden antialiased
              ${buttonSizes[size]}
              ${variants[variant]}
              ${focused ? 'is-focused' : ''}
            `}
            style={{ fontWeight: 'normal', ...props.style }}
            {...props}
          >
            {children}
          </button>
        </div>
      )}
    </FocusItem>
  );
};