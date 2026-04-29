// src/ui/layout/SettingsPageLayout.tsx
import React from 'react';

interface SettingsPageLayoutProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  adaptiveScale?: boolean;
  width?: 'default' | 'wide' | 'full';
}

export const SettingsPageLayout: React.FC<SettingsPageLayoutProps> = ({
  title,
  subtitle,
  children,
  className = '',
  adaptiveScale = false,
  width = 'default'
}) => {
  const widthClass = width === 'default' ? '' : `ore-settings-page-layout--${width}`;

  return (
    <div
      className={`ore-settings-page-layout ${widthClass} w-full h-full overflow-y-auto custom-scrollbar ${
        adaptiveScale ? 'ore-settings-scale-adaptive' : ''
      } ${className}`}
    >
      <div className="ore-settings-page-layout__inner mx-auto w-full">
        {title && (
          <div className="ore-settings-page-layout__header">
            <h2 className="ore-settings-page-layout__title font-minecraft text-white ore-text-shadow">{title}</h2>
            {subtitle && (
              <p className="ore-settings-page-layout__subtitle font-minecraft text-ore-text-muted tracking-widest uppercase">
                {subtitle}
              </p>
            )}
          </div>
        )}

        <div className="ore-settings-page-layout__content">
          {children}
        </div>
      </div>
    </div>
  );
};
