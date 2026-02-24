// /src/ui/primitives/OreList.tsx
import React from 'react';

interface OreListProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export const OreList: React.FC<OreListProps> = ({
  title,
  subtitle,
  icon,
  actions,
  onClick,
  disabled = false,
  className = '',
}) => {
  return (
    <div
      onClick={() => !disabled && onClick?.()}
      className={`ore-list-item ${disabled ? 'disabled opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <div className="flex items-center space-x-4 flex-1 min-w-0">
        {icon && <div className="ore-list-icon">{icon}</div>}
        <div className="flex flex-col justify-center min-w-0">
          <span className="font-minecraft font-bold text-lg text-white ore-text-shadow truncate">{title}</span>
          {subtitle && <span className="text-ore-green text-xs font-minecraft mt-0.5">{subtitle}</span>}
        </div>
      </div>
      <div className="flex items-center space-x-2 ml-4" onClick={(e) => e.stopPropagation()}>
        {actions}
      </div>
    </div>
  );
};