// src/ui/layout/FormRow.tsx
import React from 'react';

interface FormRowProps {
  label: string;
  description?: React.ReactNode;
  control: React.ReactNode;
  className?: string;
  // 为手柄设计：如果整个行本身就是一个可点击的动作（例如跳转），可以传入 onClick
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
        flex flex-col md:flex-row md:items-center justify-between 
        px-6 py-5 min-h-[80px] /* Deck放大密度，高度充足，避免手柄选中时显得拥挤 */
        transition-colors duration-200
        ${isClickable ? 'cursor-pointer hover:bg-white/[0.04] active:bg-white/[0.08]' : ''}
        ${className}
      `}
    >
      {/* 左侧：标签与描述 */}
      <div className="flex flex-col justify-center flex-1 pr-6 mb-4 md:mb-0">
        <span className="text-white font-minecraft text-lg mb-1 drop-shadow-sm">
          {label}
        </span>
        {description && (
          <span className="text-sm text-[#A0A0A0] font-minecraft leading-relaxed opacity-90">
            {description}
          </span>
        )}
      </div>

      {/* 右侧：操作控件 (开关、下拉框、按钮等) */}
      <div className="flex-shrink-0 flex items-center justify-start md:justify-end min-w-[160px]">
        {control}
      </div>
    </div>
  );
};