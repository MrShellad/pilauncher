// /src/ui/layout/FormRow.tsx
import React from 'react';

interface FormRowProps {
  label: React.ReactNode; // ✅ 核心修复：将 string 改为 React.ReactNode，支持传入图标和复杂的 DOM 结构
  description?: React.ReactNode;
  control: React.ReactNode;
  className?: string;
  controlClassName?: string;
  onClick?: () => void;
  vertical?: boolean; // 强制上下换行布局
}

export const FormRow: React.FC<FormRowProps> = ({ 
  label, description, control, className = '', controlClassName = '', onClick, vertical = false 
}) => {
  const isClickable = !!onClick;
  
  // 提取公共的基础样式
  const baseClasses = `px-6 py-5 min-h-[80px] transition-colors duration-200 ${
    isClickable ? 'cursor-pointer hover:bg-white/[0.04] active:bg-white/[0.08]' : ''
  } ${className}`;

  // ==========================================
  // 布局 A: 强制上下换行 (专为滑动条等宽控件设计)
  // ==========================================
  if (vertical) {
    return (
      <div onClick={onClick} className={`flex flex-col ${baseClasses}`}>
        {/* 上半部：文字说明 */}
        <div className="flex flex-col w-full mb-4 mt-1">
          <div className="text-white font-minecraft text-lg mb-1.5 drop-shadow-sm flex items-center">
            {label}
          </div>
          {description && (
            <div className="text-sm text-[#A0A0A0] font-minecraft leading-relaxed opacity-90 max-w-xl">
              {description}
            </div>
          )}
        </div>
        
        {/* 下半部：控件区域，独占一整行 */}
        <div className="w-full flex items-center justify-start">
          {control}
        </div>
      </div>
    );
  }

  // ==========================================
  // 布局 B: 默认的左右对齐 (用于开关、下拉框等)
  // ==========================================
  return (
    <div onClick={onClick} className={`flex flex-col lg:flex-row lg:items-start justify-between ${baseClasses}`}>
      {/* 左侧文字 */}
      <div className="flex flex-col flex-1 pr-6 mb-5 lg:mb-0 mt-1">
        <div className="text-white font-minecraft text-lg mb-1.5 drop-shadow-sm flex items-center">
          {label}
        </div>
        {description && (
          <div className="text-sm text-[#A0A0A0] font-minecraft leading-relaxed opacity-90 max-w-xl">
            {description}
          </div>
        )}
      </div>

      {/* 右侧控件 */}
      <div className={`flex-shrink-0 flex items-center justify-end min-w-[120px] lg:mt-1 ${controlClassName}`}>
        {control}
      </div>
    </div>
  );
};
