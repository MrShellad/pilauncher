import React from 'react';

type ControlHintVariant = 'keyboard' | 'bumper' | 'trigger' | 'face';
type ControlHintTone = 'neutral' | 'dark' | 'green' | 'red' | 'yellow' | 'blue';

export type ControlHintSize = 'sm' | 'md' | 'lg';

export interface ControlHintProps {
  label: string;
  variant?: ControlHintVariant;
  tone?: ControlHintTone;
  size?: ControlHintSize;
  className?: string;
}

const palettes: Record<ControlHintTone, { fill: string; shade: string; stroke: string; text: string; highlight: string }> = {
  neutral: {
    fill: '#D0D1D4',
    shade: '#58585A',
    stroke: '#1E1E1F',
    text: '#000000',
    highlight: 'rgba(255,255,255,0.75)'
  },
  dark: {
    fill: '#48494A',
    shade: '#1E1E1F',
    stroke: '#141516',
    text: '#F2F2F2',
    highlight: 'rgba(255,255,255,0.16)'
  },
  green: {
    fill: '#3C8527',
    shade: '#1D4D13',
    stroke: '#1E1E1F',
    text: '#FFFFFF',
    highlight: 'rgba(255,255,255,0.22)'
  },
  red: {
    fill: '#C33636',
    shade: '#8D1F1F',
    stroke: '#1E1E1F',
    text: '#FFFFFF',
    highlight: 'rgba(255,255,255,0.2)'
  },
  yellow: {
    fill: '#FFE866',
    shade: '#C9B12D',
    stroke: '#1E1E1F',
    text: '#000000',
    highlight: 'rgba(255,255,255,0.25)'
  },
  blue: {
    fill: '#4F87E8',
    shade: '#2E5CAD',
    stroke: '#1E1E1F',
    text: '#FFFFFF',
    highlight: 'rgba(255,255,255,0.2)'
  }
};

const measureWidth = (label: string, variant: ControlHintVariant) => {
  if (variant === 'face') return 28;
  const charWidth = variant === 'keyboard' ? 9 : 10;
  return Math.max(28, label.length * charWidth + 18);
};

export const ControlHint: React.FC<ControlHintProps> = ({
  label,
  variant = 'keyboard',
  tone = 'neutral',
  size = 'lg',
  className = ''
}) => {
  const palette = palettes[tone];
  const width = measureWidth(label, variant);
  
  const baseHeight = variant === 'trigger' ? 30 : 28;
  const textY = variant === 'trigger' ? 17 : 16;

  let heightRem = '1.75rem';
  if (variant === 'trigger') {
    heightRem = '1.875rem'; // Unified to the size used in the resource download page
  } else {
    heightRem = size === 'sm' ? '1.25rem' : size === 'md' ? '1.5rem' : '1.75rem';
  }

  const renderShape = () => {
    if (variant === 'face') {
      return (
        <>
          <circle cx="14" cy="14" r="12" fill={palette.fill} stroke={palette.stroke} strokeWidth="2" />
          <path d="M4 14a10 10 0 0 0 20 0v3a10 10 0 0 1-20 0Z" fill={palette.shade} opacity="0.95" />
          <path d="M5 11a9 9 0 0 1 18 0" fill="none" stroke={palette.highlight} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    }

    if (variant === 'trigger') {
      return (
        <>
          <path
            d={`M7 2h${width - 14}l5 6v21H2V8l5-6Z`}
            fill={palette.fill}
            stroke={palette.stroke}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d={`M2 22h${width - 4}v6H2Z`} fill={palette.shade} opacity="0.95" />
          <path d={`M8 7h${width - 16}`} fill="none" stroke={palette.highlight} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    }

    if (variant === 'bumper') {
      return (
        <>
          <path
            d={`M6 4h${width - 12}l4 4v18H2V8l4-4Z`}
            fill={palette.fill}
            stroke={palette.stroke}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d={`M2 20h${width - 4}v5H2Z`} fill={palette.shade} opacity="0.95" />
          <path d={`M7 8h${width - 14}`} fill="none" stroke={palette.highlight} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    }

    return (
      <>
        <rect x="1" y="1" width={width - 2} height={26} rx="4" fill={palette.fill} stroke={palette.stroke} strokeWidth="2" />
        <path d={`M1 20h${width - 2}v7H1Z`} fill={palette.shade} opacity="0.95" />
        <path d={`M6 7h${width - 12}`} fill="none" stroke={palette.highlight} strokeWidth="2" strokeLinecap="round" />
      </>
    );
  };

  return (
    <span className={`inline-flex items-center justify-center ${className}`} aria-hidden="true">
      <svg
        width={width}
        height={baseHeight}
        viewBox={`0 0 ${width} ${baseHeight}`}
        className="w-auto overflow-visible drop-shadow-[0_1px_0_rgba(0,0,0,0.45)]"
        style={{ height: heightRem }}
      >
        {renderShape()}
        <text
          x={variant === 'face' ? 14 : width / 2}
          y={textY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={palette.text}
          style={{
            fontFamily: 'var(--ore-font-family-minecraft), "Minecraft Ten", "Minecraft Seven", sans-serif',
            fontSize: variant === 'face' ? 12 : 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </text>
      </svg>
    </span>
  );
};
