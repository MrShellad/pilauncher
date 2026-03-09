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
        bg-[#48494A] border-2 border-[#1E1E1F]
        shadow-[inset_2px_2px_rgba(255,255,255,0.1),_inset_-2px_-2px_rgba(0,0,0,0.2)]
        outline-none transition-colors duration-200
        ${disabled ? 'cursor-not-allowed opacity-50 grayscale' : 'cursor-pointer hover:bg-[#58585A] hover:border-[#6D6D6E]'}
        ${isVisualFocused ? 'outline outline-[3px] outline-ore-focus outline-offset-[2px] z-20 drop-shadow-ore-glow brightness-110' : ''}
        ${isInactive && !isVisualFocused ? 'opacity-60 grayscale-[50%]' : ''}
        ${className}
      `}
    >
      <div className="absolute top-0 left-0 w-full h-px bg-white/10 pointer-events-none" />

      {leading && (
        <div className="flex-shrink-0 flex items-center justify-center w-[48px] h-[48px] mr-4 overflow-hidden">
          {leading}
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className={`font-minecraft font-bold text-[18px] truncate drop-shadow-md leading-tight ${isInactive ? 'text-[#8C8D90] line-through' : 'text-white'}`}>
          {title}
        </div>
        {subtitle && (
          <div className={`font-minecraft text-[14px] truncate mt-1 ${isInactive ? 'text-[#8C8D90]' : 'text-[#D0D1D4]'}`}>
            {subtitle}
          </div>
        )}
        {content && (
          <div className={`font-sans text-[12px] leading-tight line-clamp-2 mt-1.5 ${isInactive ? 'text-[#58585A]' : 'text-[#A0A0A0]'}`}>
            {content}
          </div>
        )}
      </div>

      {trailing && (
        <div 
          className="flex-shrink-0 flex items-center ml-4 pl-4 border-l-2 border-[#333334] relative z-30 space-x-2"
          onClick={(e) => e.stopPropagation()} 
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="absolute top-1/2 -translate-y-1/2 left-0 w-px h-[80%] bg-white/5 pointer-events-none" />
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