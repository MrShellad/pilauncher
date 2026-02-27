// src/ui/layout/SettingsPageLayout.tsx
import React from 'react';

interface SettingsPageLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export const SettingsPageLayout: React.FC<SettingsPageLayoutProps> = ({ 
  title, subtitle, children, className = '' 
}) => {
  return (
    <div className={`w-full h-full overflow-y-auto custom-scrollbar bg-[#1E1E1F] p-6 md:p-8 ${className}`}>
      {/* 最大宽度限制，保证表单在宽屏下的阅读体验 */}
      <div className="max-w-4xl mx-auto w-full">
        
        {/* 页面级大标题 */}
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-minecraft text-white ore-text-shadow mb-1">{title}</h2>
          {subtitle && (
            <p className="text-sm font-minecraft text-ore-text-muted tracking-widest uppercase">
              {subtitle}
            </p>
          )}
        </div>

        {/* 页面内容区，自动为子 Section 增加垂直间距 */}
        <div className="space-y-8 pb-12">
          {children}
        </div>
        
      </div>
    </div>
  );
};