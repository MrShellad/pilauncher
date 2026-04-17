import React from 'react';

interface OreProgressBarProps {
  percent: number;
  label?: React.ReactNode;
  className?: string;
}

export const OreProgressBar: React.FC<OreProgressBarProps> = ({
  percent,
  label,
  className = '',
}) => {
  return (
    <div className={`w-full space-y-4 px-2 ${className}`}>
      <div className="overflow-hidden border-2 border-[#1E1E1F] bg-[#48494A] shadow-[inset_0_-4px_#333334]">
        <div
          className="h-5 bg-[#3C8527] shadow-[inset_0_-4px_#1D4D13,inset_3px_3px_rgba(255,255,255,0.2),inset_-3px_-7px_rgba(255,255,255,0.1)] transition-[width] duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-[#A1A3A5] drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]">
        <span>{label}</span>
        <span className="text-white">{percent}%</span>
      </div>
    </div>
  );
};
