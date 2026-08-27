// /src/ui/primitives/OreBanner.tsx
import React from 'react';
import '../../style/tokens/designToken';

export interface OreBannerProps {
  variant?: 'important' | 'info' | 'warning' | 'danger';
  children: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

export const OreBanner: React.FC<OreBannerProps> = ({
  variant = 'important',
  children,
  icon,
  action,
  className = '',
  onClose,
}) => {
  return (
    <div
      role="alert"
      className={`ore-banner ore-banner-${variant} ${className}`}
    >
      <div className="ore-banner-content">
        {icon && <div className="ore-banner-icon">{icon}</div>}
        <div className="ore-banner-text">{children}</div>
      </div>
      {action && <div className="ore-banner-action">{action}</div>}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭横幅"
          className="ore-banner-close-btn"
        >
          ×
        </button>
      )}
    </div>
  );
};
