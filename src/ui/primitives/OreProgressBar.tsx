import React from 'react';
import { motion } from 'motion/react';

interface OreProgressBarProps {
  percent: number;
  label?: React.ReactNode;
  variant?: 'primary' | 'info';
  size?: 'thin' | 'sm' | 'md';
  className?: string;
  showPercentage?: boolean;
}

export const OreProgressBar: React.FC<OreProgressBarProps> = ({
  percent,
  label,
  variant = 'primary',
  size = 'md',
  className = '',
  showPercentage = true,
}) => {
  const roundedPercent = Math.round(Math.min(100, Math.max(0, percent)));

  const sizeClasses = {
    thin: 'h-1.5 border-[1px]',
    sm: 'h-2.5 border-[2px]',
    md: 'h-5 border-[2px]',
  };

  const fillSizeClasses = {
    thin: 'h-1.5',
    sm: 'h-2.5',
    md: 'h-5',
  };

  const fillVariantClasses = {
    primary: 'bg-[#3C8527] shadow-[inset_0_-2px_#1D4D13,inset_2px_2px_rgba(255,255,255,0.2)]',
    info: 'bg-[#2E6BE5] shadow-[inset_0_-2px_#1B4DB0,inset_2px_2px_rgba(255,255,255,0.25)]',
  };

  return (
    <div 
      className={`w-full space-y-2 select-none ${className}`}
      role="progressbar"
      aria-valuenow={roundedPercent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={typeof label === 'string' ? label : '进度条'}
    >
      <div className={`overflow-hidden border-[#1E1E1F] bg-[#48494A] shadow-[inset_0_-2px_#333334] ${sizeClasses[size]}`}>
        <motion.div
          className={`${fillSizeClasses[size]} ${fillVariantClasses[variant]}`}
          animate={{ width: `${roundedPercent}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        />
      </div>

      {(label || showPercentage) && size !== 'thin' && (
        <div className="flex items-center justify-between text-xs font-minecraft font-bold uppercase tracking-[0.16em] text-[#A1A3A5] drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]">
          <span>{label}</span>
          {showPercentage && <span className="text-white">{roundedPercent}%</span>}
        </div>
      )}
    </div>
  );
};

