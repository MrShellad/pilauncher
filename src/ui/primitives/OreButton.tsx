// /src/ui/primitives/OreButton.tsx
import React from 'react';

interface OreButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const OreButton: React.FC<OreButtonProps> = ({ 
  children, 
  variant = 'secondary', 
  size = 'md', 
  className = '',
  disabled,
  ...props 
}) => {
  // 定义外层固定容器的尺寸 (对标基岩版的 btn 标准尺寸)
  const sizes = {
    sm: "w-[130px] h-[36px] text-sm", // 参考原版 .small_btn
    md: "w-[200px] h-[40px] text-base", // 参考原版 .middle_btn
    lg: "w-[272px] h-[40px] text-base", // 参考原版 .large_btn
  };
  
  // 白色字体的按钮需要加上基岩版特有的右下角文字阴影 (ore-text-shadow)
  const variants = {
    primary: "ore-btn-primary ore-text-shadow",
    secondary: "ore-btn-secondary", // 灰色按钮是黑色字体，不需要加文字阴影
    danger: "ore-btn-danger ore-text-shadow",
  };

  return (
    /* 外层容器 (占位符)：
      items-start 是关键！它保证了内部 button 变小时，始终贴着上边缘往下长 margin-top，
      而不会因为默认的居中对齐导致上下乱飞。
    */
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