// /src/ui/primitives/OreButton.tsx
import React from 'react';

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
  ...props 
}) => {
  // 1. Wrapper 尺寸：负责外部的物理占位，控制宽、高、最小宽度
  const wrapperSizes = {
    sm: "min-w-[120px] h-[36px]", 
    md: "min-w-[160px] h-[40px]", 
    lg: "min-w-[200px] h-[44px]", 
    // auto 模式保持宽度自适应，加一个 100px 的保底宽度让按钮不至于太局促
    auto: "w-auto min-w-[100px] h-[40px]", 
    full: "w-full h-[40px] md:h-[48px] lg:h-[56px]", 
  };
  
  // 2. Button 尺寸：负责真正的内部留白 (Padding) 和 字体大小
  const buttonSizes = {
    sm: "px-4 text-sm", 
    md: "px-6 text-base", 
    lg: "px-8 text-base", 
    // 给 auto 模式充足的左右 padding，让文字远离边框
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
        disabled={disabled}
        className={`
          ore-btn w-full h-full 
          focus:outline-none focus-visible:ring-2 focus-visible:ring-white 
          ${buttonSizes[size]}
          ${variants[variant]}
        `}
        {...props}
      >
        {children}
      </button>
    </div>
  );
};