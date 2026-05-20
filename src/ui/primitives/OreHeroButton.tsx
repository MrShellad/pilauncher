// src/ui/primitives/OreHeroButton.tsx
import React from 'react';
import { OreButton } from './OreButton';

interface OreHeroButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  focusKey?: string;
  isPulse?: boolean; // 是否开启呼吸发光特效
}

export const OreHeroButton: React.FC<OreHeroButtonProps> = ({
  children,
  icon,
  focusKey,
  className = '',
  isPulse = false,
  ...props
}) => {
  return (
    // 外层容器：用于承载底部的环境光晕
    <div className="relative w-full group">
      
      {/* 核心视觉提升：环境光晕 (Ambient Glow) */}
      {/* 当 isPulse 为 true 时，会有一个缓慢的呼吸效果；当鼠标悬停或手柄聚焦时，光晕会扩大变亮 */}
      <div 
        className={`
          absolute inset-0 bg-ore-green/30 blur-xl rounded-sm pointer-events-none transition-all duration-500
          group-hover:bg-ore-green/50 group-hover:blur-2xl
          group-focus-within:bg-ore-green/60 group-focus-within:blur-2xl
          ${isPulse ? 'animate-pulse' : ''}
        `} 
      />

      {/* 复用 OreButton 的底层逻辑，但通过 ! 强制覆写巨型尺寸 */}
      <OreButton
        variant="primary"
        size="full" // 继承基础宽度
        focusKey={focusKey}
        className={`
          relative z-10
          /* 强制覆盖为 Hero 尺寸，适配从小屏到 4K */
          !h-[clamp(56px,7vh,80px)] 
          !text-[clamp(18px,2.2vh,28px)] 
          !px-[clamp(24px,3vw,40px)]
          shadow-[0_0_20px_rgba(56,133,39,0.4)]
          ${className}
        `}
        {...props}
      >
        {icon && (
          // 动态响应式的 Icon 尺寸
          <span className="mr-3 flex-shrink-0 flex items-center justify-center [&>svg]:w-[clamp(24px,3vh,36px)] [&>svg]:h-[clamp(24px,3vh,36px)]">
            {icon}
          </span>
        )}
        <span className="leading-none tracking-[0.2em] font-bold">
          {children}
        </span>
      </OreButton>

    </div>
  );
};