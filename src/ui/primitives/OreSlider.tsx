// /src/ui/primitives/OreSlider.tsx
import React, { useRef, useCallback, useEffect } from 'react';

interface OreSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export const OreSlider: React.FC<OreSliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled = false,
  className = ''
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // 计算百分比
  const percentage = Math.min(Math.max((value - min) / (max - min), 0), 1) * 100;

  const handleMove = useCallback((clientX: number) => {
    if (disabled || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const percent = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const newValue = min + percent * (max - min);
    
    // 处理步长
    const steppedValue = Math.round(newValue / step) * step;
    onChange(Math.min(Math.max(steppedValue, min), max));
  }, [disabled, min, max, step, onChange]);

  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    handleMove(e.clientX);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging.current) handleMove(e.clientX);
    };
    const onMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [handleMove]);

  return (
    <div className={`flex items-center h-[30px] my-3 w-full ${className}`}>
      {/* 滑动轨道：高8px */}
      <div 
        ref={trackRef}
        onMouseDown={onMouseDown}
        className={`
          relative w-full h-[8px] mx-1.5 ore-track
          ${disabled ? 'bg-[#CFD0D4] cursor-not-allowed border-[#8C8D90]' : 'bg-[#8C8D90] cursor-pointer'}
        `}
      >
        {/* 已经填充的进度条 */}
        <div 
          className={`absolute left-0 top-0 bottom-0 shadow-[inset_2px_2px_rgba(255,255,255,0.4),inset_-2px_-2px_rgba(255,255,255,0.2)] ${disabled ? 'bg-[#CFD0D4]' : 'bg-[#3C8527]'}`}
          style={{ width: `${percentage}%`, transition: isDragging.current ? 'none' : 'width 100ms linear' }}
        />

        {/* 物理推钮 */}
        <div 
          className={`
            absolute w-[28px] h-[28px] top-1/2 -translate-y-1/2 -translate-x-1/2 z-10
            ${disabled ? 'bg-[#CFD0D4] border-[#8C8D90] shadow-[inset_0_-4px_#B0B1B5,inset_2px_2px_rgba(255,255,255,0.6),inset_-2px_-6px_rgba(255,255,255,0.4)]' : 'ore-thumb'}
          `}
          style={{ left: `${percentage}%`, transition: isDragging.current ? 'none' : 'left 100ms linear' }}
        />
      </div>
    </div>
  );
};