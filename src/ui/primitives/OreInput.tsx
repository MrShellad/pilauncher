// /src/ui/primitives/OreInput.tsx
import React, { useId, useRef } from 'react';
// ✅ 1. 引入高级空间导航挂载点
import { FocusItem } from '../focus/FocusItem';

interface OreInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export const OreInput = React.forwardRef<HTMLInputElement, OreInputProps>(
  ({ label, error, containerClassName = '', disabled, ...props }, forwardedRef) => {
    const id = useId(); // 自动生成唯一的 ID 绑定 Label
    const internalRef = useRef<HTMLInputElement>(null);

    // 巧妙的 ref 合并函数：既保留外部传入的 ref（比如 react-hook-form 使用），又让内部能拿到 DOM
    const setRefs = (node: HTMLInputElement) => {
      internalRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    };

    return (
      // ✅ 2. 挂载空间导航引擎
      <FocusItem 
        disabled={disabled}
        onEnter={() => {
          // ✅ 3. 核心交互：当手柄或键盘在这个输入框上按下“确认”时，强制原生 input 获取焦点以便打字
          internalRef.current?.focus();
        }}
      >
        {({ ref: focusRef, focused }) => (
          <div 
            // ✅ 4. 引擎监听的物理范围挂载在外层容器上
            ref={focusRef} 
            className={`ore-input-wrapper ${containerClassName}`}
          >
            {/* 如果有 Label，显示带阴影的 MC 风格文字 */}
            {label && (
              <label 
                htmlFor={id} 
                className="text-sm font-minecraft font-bold text-ore-text-muted ore-text-shadow px-1"
              >
                {label}
              </label>
            )}

            <div className="relative">
              <input
                id={id}
                ref={setRefs}
                disabled={disabled}
                className={`
                  ore-input 
                  ${error ? 'border-red-500 focus:border-red-500' : ''}
                  /* ✅ 5. 焦点视觉表现：与按钮保持一致的全局 Focus 样式（仅限键盘/手柄触发） */
                  ${focused ? 'ring-2 ring-white brightness-110 shadow-lg z-10 border-white/20' : ''}
                `}
                {...props}
              />
              
              {/* 输入框右侧的装饰（可选：比如搜索图标或清除按钮可以塞在这里） */}
            </div>

            {/* 错误提示文字 */}
            {error && (
              <span className="text-xs font-minecraft text-red-500 mt-1 px-1">
                {error}
              </span>
            )}
          </div>
        )}
      </FocusItem>
    );
  }
);

OreInput.displayName = 'OreInput';