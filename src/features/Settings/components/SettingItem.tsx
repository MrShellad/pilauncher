// /src/features/Settings/components/SettingItem.tsx
import React from 'react';

interface SettingItemProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const SettingItem: React.FC<SettingItemProps> = ({ title, description, children, className = '' }) => {
  return (
    <div className={`flex items-center justify-between p-4 bg-[#1E1E1F] border-2 border-ore-gray-border ${className}`}>
      <div className="flex flex-col pr-6">
        <span className="font-minecraft text-white text-base tracking-wide ore-text-shadow">
          {title}
        </span>
        {description && (
          <span className="font-minecraft text-xs text-ore-text-muted mt-1.5 leading-relaxed">
            {description}
          </span>
        )}
      </div>
      <div className="flex-shrink-0 flex items-center justify-end min-w-[120px]">
        {children}
      </div>
    </div>
  );
};