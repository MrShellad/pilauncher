// /src/ui/primitives/OreInput.tsx
import React, { useId, useRef } from 'react';
import { FocusItem } from '../focus/FocusItem';

interface OreInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'width' | 'height'> {
  label?: string;
  description?: string;
  error?: string;
  containerClassName?: string;
  width?: string | number;
  height?: string | number;
  focusKey?: string;
  prefixNode?: React.ReactNode; // ✅ 新增：用于在左侧内嵌图标 (如搜索放大镜)
}

export const OreInput = React.forwardRef<HTMLInputElement, OreInputProps>(
  ({ label, description, error, containerClassName = '', width = '100%', height = '40px', disabled, className = '', style, focusKey, prefixNode, onKeyDown, ...props }, forwardedRef) => {
    const id = useId(); 
    const internalRef = useRef<HTMLInputElement>(null);

    // 合并 ref，既保证内部能调用 focus/blur，又支持外部传 ref
    const setRefs = (node: HTMLInputElement) => {
      internalRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };

    // ✅ 核心逃生舱逻辑：当在输入框内按下回车或ESC时，强制失去原生焦点，把控制权还给空间导航
    const handleNativeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.currentTarget.blur();
      }
      if (onKeyDown) onKeyDown(e);
    };

    return (
      <FocusItem 
        focusKey={focusKey} 
        disabled={disabled} 
        onEnter={() => internalRef.current?.focus()} // ✅ 手柄按下确认时，激活原生输入模式
      >
        {({ ref: focusRef, focused }) => (
          <div 
            ref={focusRef as any}
            className={`ore-input-wrapper ${containerClassName} transition-all rounded-sm ${focused ? 'ring-2 ring-white scale-[1.01] z-20 shadow-lg brightness-110' : ''}`}
            style={{ width }} 
          >
            {label && (
              <label htmlFor={id} className={`text-sm font-minecraft font-bold ore-text-shadow ${disabled ? 'text-gray-500' : 'text-white'}`}>
                {label}
              </label>
            )}

            <div className="relative w-full flex items-center" style={{ height }}>
              {/* 渲染前缀图标 */}
              {prefixNode && (
                <div className={`absolute left-3 z-10 transition-colors pointer-events-none ${focused ? 'text-white' : 'text-gray-400'}`}>
                  {prefixNode}
                </div>
              )}

              <input
                id={id}
                ref={setRefs}
                disabled={disabled}
                onKeyDown={handleNativeKeyDown}
                className={`ore-input ${error ? 'border-red-500 focus:border-red-500 shadow-[0_0_0_1px_red]' : ''} ${prefixNode ? '!pl-9' : ''} ${className}`}
                style={style}
                {...props}
              />
            </div>

            {(description || error) && (
              <span className={`text-xs font-minecraft mt-0.5 ${error ? 'text-red-500' : disabled ? 'text-gray-500' : 'text-ore-text-muted'}`}>
                {error || description}
              </span>
            )}
          </div>
        )}
      </FocusItem>
    );
  }
);

OreInput.displayName = 'OreInput';