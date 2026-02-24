// /src/ui/primitives/OreButton.tsx
import React from 'react';

interface OreButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  // 新增 auto (随文字宽度自适应) 和 full (随父容器宽度自适应)
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
  const sizes = {
    sm: "min-w-[120px] h-[36px] px-4 text-sm", 
    md: "min-w-[160px] h-[40px] px-6 text-base", 
    lg: "min-w-[200px] h-[44px] px-8 text-base", 
    auto: "w-auto h-[40px] px-6 text-base",
    // 【关键改动】：让 full 模式不仅宽度占满，高度和字体在窗口变大时也变大
    // 小窗: 高度40px 基础字体
    // 中窗(md): 高度48px 较大字体
    // 大窗(lg): 高度56px 更大字体
    full: "w-full h-[40px] md:h-[48px] lg:h-[56px] px-4 md:px-6 text-base md:text-lg lg:text-xl", 
  };
  
  const variants = {
    primary: "ore-btn-primary ore-text-shadow",
    secondary: "ore-btn-secondary",
    danger: "ore-btn-danger ore-text-shadow",
  };

  return (
    <div className={`inline-flex items-start justify-center ${sizes[size]} ${className}`}>
      <button
        disabled={disabled}
        className={`
          ore-btn w-full h-full 
          focus:outline-none focus-visible:ring-2 focus-visible:ring-white 
          ${variants[variant]}
        `}
        {...props}
      >
        {children}
      </button>
    </div>
  );
};