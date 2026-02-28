// /src/ui/layout/FormRow.tsx
import React from 'react';

interface FormRowProps {
  label: string;
  description?: React.ReactNode;
  control: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const FormRow: React.FC<FormRowProps> = ({ 
  label, description, control, className = '', onClick 
}) => {
  const isClickable = !!onClick;

  return (
    <div 
      onClick={onClick}
      className={`
        flex flex-col lg:flex-row lg:items-start justify-between 
        px-6 py-5 min-h-[80px] 
        transition-colors duration-200
        ${isClickable ? 'cursor-pointer hover:bg-white/[0.04] active:bg-white/[0.08]' : ''}
        ${className}
      `}
    >
      {/* 左侧：标签与描述 (加入 mt-1 匹配右侧控件的顶部高度) */}
      <div className="flex flex-col flex-1 pr-6 mb-5 lg:mb-0 mt-1">
        <span className="text-white font-minecraft text-lg mb-1.5 drop-shadow-sm">
          {label}
        </span>
        {description && (
          <span className="text-sm text-[#A0A0A0] font-minecraft leading-relaxed opacity-90 max-w-xl">
            {description}
          </span>
        )}
      </div>

      {/* 右侧：操作控件 */}
      {/* ✅ 核心修复：限制右侧最大不超过 60%，防止极长文本挤压左侧布局 */}
      <div className="flex-shrink-0 flex items-start w-full lg:w-auto lg:max-w-[55%] xl:max-w-[60%]">
        <div className="w-full flex lg:justify-end">
          {control}
        </div>
      </div>
    </div>
  );
};