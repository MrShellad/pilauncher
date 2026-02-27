// /src/ui/primitives/OreButton.tsx
import React from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';

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
  // ✅ 1. 注册为可聚焦元素
  const { ref, focused } = useFocusable({
    focusable: !disabled, // 禁用的按钮不可被选中
    onEnterPress: () => {
      // 当使用手柄A键或键盘Enter键时，触发 onClick 回调
      if (!disabled && onClick) {
        // 构造一个伪事件对象，防止外部代码调用 e.preventDefault() 报错
        onClick({ preventDefault: () => {}, stopPropagation: () => {} } as any);
      }
    }
  });

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
    <div className={`inline-flex items-start justify-center ${wrapperSizes[size]} ${className}`}>
      <button
        // ✅ 2. 绑定 Norigin 生成的 ref
        ref={ref}
        disabled={disabled}
        onClick={onClick}
        className={`
          ore-btn w-full h-full font-minecraft flex items-center justify-center
          focus:outline-none transition-all duration-150 transform-gpu backface-hidden antialiased
          ${buttonSizes[size]}
          ${variants[variant]}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98] active:brightness-90'}
          /* ✅ 3. 核心：如果获取了空间焦点，强制显示白色边框和微微发亮放大，模拟 Hover 效果 */
          ${focused ? 'ring-2 ring-white brightness-110 scale-[1.02] shadow-lg z-10' : 'hover:brightness-110'}
        `}
        style={{ fontWeight: 'normal', ...props.style }}
        {...props}
      >
        {children}
      </button>
    </div>
  );
};