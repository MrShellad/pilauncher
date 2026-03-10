// src/ui/primitives/OreList.tsx
import React from 'react';
import { FocusItem } from '../focus/FocusItem';

interface OreListProps {
  leading?: React.ReactNode;     
  title: React.ReactNode;        
  subtitle?: React.ReactNode;    
  content?: React.ReactNode; 
  trailing?: React.ReactNode;     
  onClick?: () => void;          
  disabled?: boolean;            
  isInactive?: boolean;          
  className?: string;
  focusKey?: string;
  /** ✅ 新增：是否允许整行被聚焦？如果行内有按钮，需设为 false 以让出焦点 */
  focusable?: boolean; 
}

export const OreList: React.FC<OreListProps> = ({
  leading, title, subtitle, content, trailing, onClick,
  disabled = false, isInactive = false, className = '', focusKey,
  focusable = true // 默认保持可聚焦
}) => {

  // 提取纯净的内部 UI 渲染逻辑
  const renderInner = (isVisualFocused: boolean) => (
    <div
      onClick={() => !disabled && onClick?.()}
      className={`
        relative flex flex-row items-center w-full px-4 py-3
        bg-[#48494A] border-[2px] border-[#1E1E1F]
        shadow-[inset_2px_2px_rgba(255,255,255,0.1),_inset_-2px_-2px_rgba(0,0,0,0.2)]
        transition-colors duration-100 ease-in-out
        ${disabled ? 'cursor-not-allowed bg-[#D0D1D4] border-[#8C8D90] !shadow-none opacity-80' : 'cursor-pointer hover:bg-[#58585A] active:bg-[#313233] active:shadow-[inset_0_4px_#242425]'}
        ${isVisualFocused ? 'outline outline-[3px] outline-white outline-offset-[2px] z-20 brightness-110' : 'outline-none'}
        ${className}
      `}
    >
      <div className={`absolute top-0 left-0 w-full h-px ${disabled ? 'bg-transparent' : 'bg-white/10'} pointer-events-none`} />

      {leading && (
        <div className={`flex-shrink-0 flex items-center justify-center w-[48px] h-[48px] mr-4 overflow-hidden ${disabled ? 'grayscale brightness-50' : ''}`}>
          {leading}
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className={`font-minecraft font-bold text-[18px] truncate drop-shadow-sm leading-tight
          ${disabled || isInactive ? 'text-[#48494A]' : 'text-[#FFFFFF]'}
          ${isInactive && !disabled ? 'line-through text-[#8C8D90]' : ''}
        `}>
          {title}
        </div>
        
        {subtitle && (
          <div className={`font-minecraft text-[14px] truncate mt-1
            ${disabled ? 'text-[#58585A]' : (isInactive ? 'text-[#8C8D90]' : 'text-[#D0D1D4]')}
          `}>
            {subtitle}
          </div>
        )}

        {content && (
          <div className={`font-sans font-bold text-[12px] leading-tight line-clamp-2 mt-1.5
            ${disabled ? 'text-[#58585A]' : (isInactive ? 'text-[#8C8D90]' : 'text-[#B1B2B5]')}
          `}>
            {content}
          </div>
        )}
      </div>

      {trailing && (
        <div 
          className="flex-shrink-0 flex items-center ml-4 pl-4 border-l-[2px] border-[#1E1E1F] relative z-30 space-x-2"
          onClick={(e) => e.stopPropagation()} 
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className={`absolute top-[10%] left-0 w-px h-[80%] ${disabled ? 'bg-transparent' : 'bg-[rgba(255,255,255,0.1)]'} pointer-events-none`} />
          {trailing}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-1.5 w-full">
      {focusable ? (
        // 可聚焦模式：通过引擎捕获焦点
        <FocusItem focusKey={focusKey} disabled={disabled} onEnter={onClick}>
          {({ ref, focused }) => (
             <div ref={ref as React.RefObject<HTMLDivElement>}>
               {renderInner(focused)}
             </div>
          )}
        </FocusItem>
      ) : (
        // 不可聚焦模式：直接渲染，将焦点权完全下放给 trailing 里的按钮
        renderInner(false)
      )}
    </div>
  );
};