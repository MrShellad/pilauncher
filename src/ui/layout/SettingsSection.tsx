// src/ui/layout/SettingsSection.tsx
import React from 'react';

interface SettingsSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean; // 是否为危险区域（红黑色调）
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ 
  title, icon, children, danger = false 
}) => {
  // 危险模式与普通模式的色调区分
  const bgClass = danger ? 'bg-[#2a1717]' : 'bg-[#2A2A2C]';
  const borderClass = danger ? 'border-[#4a1c1c]' : 'border-[#18181B]';
  const titleColor = danger ? 'text-red-400' : 'text-white';
  const indicatorColor = danger ? 'bg-red-600' : 'bg-ore-green shadow-[0_0_8px_rgba(56,133,39,0.4)]';

  return (
    <div className={`${bgClass} border-2 ${borderClass} shadow-sm relative overflow-hidden`}>
      {/* 危险模式的左侧红色粗条纹侧边 */}
      {danger && <div className="absolute top-0 left-0 w-2 h-full bg-red-600" />}

      {/* Section Header */}
      <div className={`px-6 py-4 border-b-2 ${borderClass} flex items-center ${danger ? 'ml-2' : ''}`}>
        {!danger && <span className={`w-1.5 h-4 ${indicatorColor} mr-3 inline-block`} />}
        {icon && <div className={`mr-3 ${danger ? 'text-red-400' : 'text-ore-text-muted'}`}>{icon}</div>}
        <h3 className={`text-lg font-minecraft ${titleColor}`}>{title}</h3>
      </div>

      {/* Section Content: 使用 divide-y 自动在 FormRow 之间生成底部分割线，无需手动干预 */}
      <div className={`flex flex-col divide-y-2 ${danger ? 'divide-[#4a1c1c]' : 'divide-[#1E1E1F]'}`}>
        {children}
      </div>
    </div>
  );
};