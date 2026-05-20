// /src/ui/primitives/OreCard.tsx
import React from 'react';

interface OreCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export const OreCard: React.FC<OreCardProps> = ({
  title,
  subtitle,
  description,
  icon,
  actions,
  onClick,
  disabled = false,
  className = '',
}) => {
  return (
    <div
      onClick={() => !disabled && onClick?.()}
      className={`ore-card-item ${disabled ? 'disabled opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {/* 1. 媒体区 */}
      <div className="ore-card-media">
        {icon || <div className="text-ore-gray-track font-minecraft opacity-20 text-4xl">?</div>}
      </div>

      {/* 2. 信息区 */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
        <h3 className="font-minecraft font-bold text-xl text-white ore-text-shadow truncate w-full">{title}</h3>
        {subtitle && <p className="text-ore-green text-sm font-minecraft mt-1">{subtitle}</p>}
        {description && (
          <p className="text-ore-text-muted text-xs font-minecraft mt-3 line-clamp-3 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* 3. 底部操作区 */}
      <div className="ore-card-footer" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center space-x-2 w-full justify-center">
          {actions}
        </div>
      </div>
    </div>
  );
};