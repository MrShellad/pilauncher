// src/ui/layout/SettingsPageLayout.tsx
import React from 'react';

interface SettingsPageLayoutProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  adaptiveScale?: boolean;
  width?: 'default' | 'wide' | 'full';
  /** When false, disables the outer scroll container so inner components (e.g. Virtuoso) can own scrolling. Default: true */
  scrollable?: boolean;
}

export const SettingsPageLayout: React.FC<SettingsPageLayoutProps> = ({
  title,
  subtitle,
  children,
  className = '',
  adaptiveScale = false,
  width = 'default',
  scrollable = true
}) => {
  const widthClass = width === 'default' ? '' : `ore-settings-page-layout--${width}`;
  const scrollClass = scrollable
    ? 'overflow-y-auto custom-scrollbar'
    : 'ore-settings-page-layout--no-scroll overflow-hidden';

  return (
    <div
      className={`ore-settings-page-layout ${widthClass} w-full h-full ${scrollClass} ${
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
