// /src/ui/primitives/OreList.tsx
import React from 'react';
import { FocusItem } from '../focus/FocusItem';

interface OreListProps {
  title: React.ReactNode;        
  subtitle?: React.ReactNode;    
  description?: React.ReactNode; 
  icon?: React.ReactNode;        
  actions?: React.ReactNode;     
  onClick?: () => void;          
  disabled?: boolean;            
  isInactive?: boolean;          
  className?: string;
}

export const OreList: React.FC<OreListProps> = ({
  title, subtitle, description, icon, actions, onClick,
  disabled = false, isInactive = false, className = '',
}) => {
  return (
    // ✅ 修复 1：扩大外层保护垫到 p-2，给 scale 放大的卡片和 4px 的光环留足物理空间
    <div className="p-2">
      <FocusItem disabled={disabled} onEnter={onClick}>
        {({ ref, focused }) => (
          <div
            ref={ref as React.RefObject<HTMLDivElement>}
            onClick={() => !disabled && onClick?.()}
            className={`
              relative flex flex-row w-full h-20
              bg-[#4B4C50] border-2 border-b-4 border-[#1E1E1F]
              overflow-hidden shadow-md transition-all duration-200 outline-none
              ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:shadow-lg hover:bg-[#58595D]'}
              ${focused ? 'ring-4 ring-white/50 scale-[1.02] z-10 brightness-110' : ''}
              ${isInactive && !focused ? 'opacity-60 grayscale' : ''}
              ${className}
            `}
          >
            {/* 左侧：图标区 */}
            {icon && (
              <div className="relative w-20 flex-shrink-0 bg-[#141415] border-r-2 border-[#1E1E1F] flex items-center justify-center overflow-hidden">
                {icon}
              </div>
            )}

            {/* 中部：文本内容区 */}
            <div className="flex-1 flex flex-col justify-center px-4 py-1.5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-px bg-white/10 pointer-events-none" />

              {/* ✅ 修复 2：将 text-lg 改为 text-base，缩小字体消除拥挤感 */}
              <div className={`font-minecraft font-bold text-base truncate drop-shadow-md ${isInactive ? 'text-gray-400 line-through' : 'text-white'}`}>
                {title}
              </div>
              
              {subtitle && (
                <div className="text-[#A0A0A0] font-minecraft text-xs mt-0.5 truncate">
                  {subtitle}
                </div>
              )}
              
              {description && (
                /* ✅ 修复 2：将 text-sm 改为 text-xs，收缩行高 */
                <div className={`text-xs mt-1 line-clamp-2 leading-tight ${isInactive ? 'text-gray-500' : 'text-gray-300'}`}>
                  {description}
                </div>
              )}
            </div>

            {/* 右侧：操作按钮区 */}
            {actions && (
              <div
                className="flex-shrink-0 flex items-center justify-center px-3 border-l-2 border-[#1E1E1F] hover:bg-white/5 transition-colors relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="absolute top-0 left-0 w-px h-full bg-white/10 pointer-events-none" />
                <div className="flex items-center space-x-2">
                  {actions}
                </div>
              </div>
            )}
          </div>
        )}
      </FocusItem>
    </div>
  );
};