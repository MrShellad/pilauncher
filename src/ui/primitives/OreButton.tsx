import React from 'react';
import { Loader2 } from 'lucide-react';
import { FocusItem } from '../focus/FocusItem';

// ✅ 引入 designToken 确保注入全局 CSS 变量
import '../../style/tokens/designToken'; 

export type OreButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'auto' | 'full' | 'icon';

export interface OreButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'purple' | 'hero' | 'ghost';
  size?: OreButtonSize;
  iconOnly?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  focusKey?: string; 
  focusable?: boolean;
  onArrowPress?: (direction: string) => boolean | void;
  autoScroll?: boolean;
}

const BUTTON_SIZE_CLASSES: Record<'xs' | 'sm' | 'md' | 'lg', { normal: string; iconOnly: string; loaderSize: number }> = {
  xs: {
    normal: "h-[var(--ore-btn-xs-h,2rem)] px-2.5 text-xs",
    iconOnly: "h-[var(--ore-btn-xs-h,2rem)] w-[var(--ore-btn-xs-h,2rem)] min-w-[2rem] px-0 text-xs",
    loaderSize: 13,
  },
  sm: {
    normal: "h-[var(--ore-btn-sm-h,2.25rem)] px-3 text-xs md:text-sm",
    iconOnly: "h-[var(--ore-btn-sm-h,2.25rem)] w-[var(--ore-btn-sm-h,2.25rem)] min-w-[2.25rem] px-0 text-sm",
    loaderSize: 14,
  },
  md: {
    normal: "h-[var(--ore-btn-md-h,2.5rem)] px-4 text-sm",
    iconOnly: "h-[var(--ore-btn-md-h,2.5rem)] w-[var(--ore-btn-md-h,2.5rem)] min-w-[2.5rem] px-0 text-base",
    loaderSize: 16,
  },
  lg: {
    normal: "h-[var(--ore-btn-lg-h,3rem)] px-6 text-base",
    iconOnly: "h-[var(--ore-btn-lg-h,3rem)] w-[var(--ore-btn-lg-h,3rem)] min-w-[3rem] px-0 text-lg",
    loaderSize: 18,
  },
};

const VARIANTS = {
  primary: "ore-btn-primary",
  hero: "ore-btn-primary text-lg tracking-wider",
  secondary: "ore-btn-secondary",
  danger: "ore-btn-danger",
  purple: "ore-btn-purple", 
  ghost: "ore-btn-ghost",
};

export const OreButton: React.FC<OreButtonProps> = ({ 
  children, 
  variant = 'secondary', 
  size = 'md', 
  iconOnly = false,
  fullWidth = false,
  loading = false,
  prefixIcon,
  suffixIcon,
  className = '',
  disabled,
  onClick,
  focusKey, 
  focusable = true,
  onArrowPress,
  autoScroll,
  ...props 
}) => {
  // 处理尺寸与向后兼容模式
  let resolvedSize: 'xs' | 'sm' | 'md' | 'lg' = 'md';
  let isIconOnly = iconOnly;
  let isFullWidth = fullWidth;

  if (size === 'xs' || size === 'sm' || size === 'md' || size === 'lg') {
    resolvedSize = size;
  } else if (size === 'icon') {
    resolvedSize = 'md';
    isIconOnly = true;
  } else if (size === 'full') {
    resolvedSize = 'md';
    isFullWidth = true;
  } else if (size === 'auto') {
    resolvedSize = 'md';
  }

  const sizeConfig = BUTTON_SIZE_CLASSES[resolvedSize];
  const sizeClass = isIconOnly ? sizeConfig.iconOnly : sizeConfig.normal;
  const widthClass = isFullWidth ? 'w-full' : '';
  const isDisabled = disabled || loading;

  return (
    <FocusItem 
      focusKey={focusKey} 
      disabled={isDisabled} 
      focusable={focusable && !isDisabled}
      onArrowPress={onArrowPress}
      autoScroll={autoScroll}
      onEnter={() => !isDisabled && onClick?.({ preventDefault: () => {}, stopPropagation: () => {} } as React.MouseEvent<HTMLButtonElement>)}
    >
      {({ ref, focused, tabIndex }) => (
        <button
          ref={ref}
          disabled={isDisabled}
          aria-busy={loading ? 'true' : undefined}
          onClick={(e) => {
            if (isDisabled) {
              e.preventDefault();
              return;
            }
            onClick?.(e);
          }}
          tabIndex={tabIndex}
          className={`
            ore-btn relative inline-flex items-center justify-center font-minecraft tracking-wide
            focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 transition-none antialiased
            ${sizeClass}
            ${widthClass}
            ${VARIANTS[variant]}
            ${focused ? 'is-focused' : ''}
            ${className}
          `}
          style={{ fontWeight: 'normal', ...props.style }}
          {...props}
        >
          {loading ? (
            <span className="inline-flex items-center justify-center gap-1.5">
              <Loader2 size={sizeConfig.loaderSize} className="animate-spin shrink-0" />
              {!isIconOnly && children && <span>{children}</span>}
            </span>
          ) : (
            <>
              {prefixIcon && (
                <span className="mr-1.5 shrink-0 inline-flex items-center justify-center pointer-events-none">
                  {prefixIcon}
                </span>
              )}
              {children}
              {suffixIcon && (
                <span className="ml-1.5 shrink-0 inline-flex items-center justify-center pointer-events-none">
                  {suffixIcon}
                </span>
              )}
            </>
          )}
        </button>
      )}
    </FocusItem>
  );
};
