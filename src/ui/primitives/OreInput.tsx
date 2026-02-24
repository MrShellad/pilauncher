// /src/ui/primitives/OreInput.tsx
import React, { useId } from 'react';

interface OreInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export const OreInput = React.forwardRef<HTMLInputElement, OreInputProps>(
  ({ label, error, containerClassName = '', ...props }, ref) => {
    const id = useId(); // 自动生成唯一的 ID 绑定 Label

    return (
      <div className={`ore-input-wrapper ${containerClassName}`}>
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
            ref={ref}
            className={`ore-input ${error ? 'border-red-500 focus:border-red-500' : ''}`}
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
    );
  }
);

OreInput.displayName = 'OreInput';