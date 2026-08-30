import React from 'react';

export type OreProgressBarVariant =
  | 'primary'
  | 'info'
  | 'dark'
  | 'white'
  | 'gold'
  | 'current'
  | 'currentColor';

export type OreProgressBarSize = 'thin' | 'sm' | 'md' | 'lg';
export type OreProgressBarLabelPosition = 'bottom' | 'top';
export type OreProgressBarLabelAlign = 'center' | 'start' | 'end' | 'between';

export interface OreProgressBarProps {
  /** 进度百分比 (0-100)，兼容 value / max */
  percent?: number;
  value?: number;
  max?: number;
  label?: React.ReactNode;
  variant?: OreProgressBarVariant;
  size?: OreProgressBarSize;
  className?: string;
  showPercentage?: boolean;
  labelPosition?: OreProgressBarLabelPosition;
  labelAlign?: OreProgressBarLabelAlign;
  style?: React.CSSProperties;
}

export const OreProgressBar: React.FC<OreProgressBarProps> = ({
  percent,
  value,
  max = 100,
  label,
  variant = 'primary',
  size = 'md',
  className = '',
  showPercentage = true,
  labelPosition = 'bottom',
  labelAlign = 'center',
  style,
}) => {
  const actualMax = Number.isFinite(max) && max > 0 ? max : 100;
  const rawValue = value !== undefined ? value : (percent ?? 0);
  const clampedValue = Math.min(actualMax, Math.max(0, rawValue));
  const progressRatio = clampedValue / actualMax;
  const percentage = Math.round(progressRatio * 100);

  const normalizedVariant = variant === 'currentColor' ? 'current' : variant;

  const renderLabel = () => {
    if (!label && !showPercentage) return null;

    if (labelAlign === 'between') {
      return (
        <div className={`ore-progress-bar-label is-${labelPosition} flex items-center justify-between`}>
          {label && <span>{label}</span>}
          {showPercentage && <span className="font-bold">{percentage}%</span>}
        </div>
      );
    }

    const alignmentClass =
      labelAlign === 'start'
        ? 'justify-self-start text-left'
        : labelAlign === 'end'
        ? 'justify-self-end text-right'
        : 'justify-self-center text-center';

    return (
      <div className={`ore-progress-bar-label is-${labelPosition} ${alignmentClass}`}>
        {label ? (
          <span>
            {label}
            {showPercentage && <span className="ml-1 font-bold">({percentage}%)</span>}
          </span>
        ) : (
          showPercentage && <span className="font-bold">{percentage}%</span>
        )}
      </div>
    );
  };

  return (
    <div
      className={`ore-progress-bar variant-${normalizedVariant} ${className}`}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={actualMax}
      aria-label={typeof label === 'string' ? label : '进度条'}
      style={style}
    >
      {labelPosition === 'top' && renderLabel()}

      <div className={`ore-progress-bar-track is-${size}`}>
        <div
          className="ore-progress-bar-fill"
          style={{
            width: progressRatio > 0 ? `calc((100% - 4px) * ${progressRatio})` : '0px',
          }}
        />
      </div>

      {labelPosition === 'bottom' && renderLabel()}
    </div>
  );
};
