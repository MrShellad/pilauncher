// src/ui/primitives/OreButton.tsx
import React from 'react';
// ✅ 1. 引入我们自己封装的高级 FocusItem
import { FocusItem } from '../focus/FocusItem';

interface OreButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'auto' | 'full'; 
}

export const OreButton: React.FC<OreButtonProps> = ({ 
  children, 
  variant = 'secondary', 
  size = 'md', 
  className = '',
  disabled,
  onClick,
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
    secondary: "ore-btn-secondary",
    danger: "ore-btn-danger ore-text-shadow",
  };

  return (
    // ✅ 2. 使用 FocusItem 包裹，处理手柄的回车事件
    <FocusItem 
      disabled={disabled} 
      onEnter={() => onClick && onClick({ preventDefault: () => {}, stopPropagation: () => {} } as any)}
    >
      {/* ✅ 3. 接收底层传来的 ref 和 visuallyFocused 状态 */}
      {({ ref, focused }) => (
        <div className={`inline-flex items-start justify-center ${wrapperSizes[size]} ${className}`}>
          <button
            ref={ref}
            disabled={disabled}
            onClick={onClick}
            className={`
              ore-btn w-full h-full font-minecraft flex items-center justify-center
              focus:outline-none transition-all duration-150 transform-gpu backface-hidden antialiased
              ${buttonSizes[size]}
              ${variants[variant]}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98] active:brightness-90'}
              /* ✅ 4. 只有在键盘/手柄模式下，才会出现白色边框，鼠标点击完全无感！ */
              ${focused ? 'ring-2 ring-white brightness-110 scale-[1.02] shadow-lg z-10' : 'hover:brightness-110'}
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