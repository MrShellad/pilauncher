// /src/ui/primitives/OreSlider.tsx
import React, { useRef, useState, useCallback } from 'react';
import { FocusItem } from '../focus/FocusItem';

interface OreSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;            
  valueFormatter?: (val: number) => string; 
  disabled?: boolean;
  className?: string;
  fillColorClass?: string;  
  thumbColorClass?: string; 
}

export const OreSlider: React.FC<OreSliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
  valueFormatter,
  disabled = false,
  className = '',
  fillColorClass,
  thumbColorClass,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const updateValueFromPointer = useCallback((clientX: number) => {
    if (!trackRef.current || disabled) return;
    const rect = trackRef.current.getBoundingClientRect();
    let percent = (clientX - rect.left) / rect.width;
    percent = Math.max(0, Math.min(1, percent));
    
    const rawValue = percent * (max - min) + min;
    let steppedValue = Math.round((rawValue - min) / step) * step + min;
    steppedValue = Number(steppedValue.toFixed(5));
    
    if (steppedValue !== value) {
      onChange(Math.min(max, Math.max(min, steppedValue)));
    }
  }, [disabled, max, min, step, value, onChange]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateValueFromPointer(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) updateValueFromPointer(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className={`flex flex-col w-full ${className}`}>
      {label && (
        <div className="flex justify-between items-end mb-2 px-1 select-none">
          <span className="font-minecraft font-bold text-ore-text-muted ore-text-shadow">
            {label}
          </span>
          <span className="font-minecraft text-white ore-text-shadow">
            {valueFormatter ? valueFormatter(value) : value}
          </span>
        </div>
      )}

      <FocusItem disabled={disabled}>
        {({ ref: focusRef, focused }) => (
          <div 
            // ✅ 核心修复：完美合并内部 DOM ref 与 Norigin 空间导航需要的 Ref 对象！
            ref={(node) => {
              trackRef.current = node;
              if (focusRef) {
                if (typeof focusRef === 'function') {
                  focusRef(node);
                } else {
                  // 强行写入 Norigin 引擎的 ref.current
                  (focusRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                }
              }
            }}
            tabIndex={disabled ? -1 : 0}
            className={`ore-slider-wrapper outline-none ${disabled ? 'disabled' : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDownCapture={(e) => {
              if (disabled) return;
              if (e.key === 'ArrowLeft') {
                e.stopPropagation(); e.preventDefault();
                onChange(Math.max(min, value - step));
              } else if (e.key === 'ArrowRight') {
                e.stopPropagation(); e.preventDefault();
                onChange(Math.min(max, value + step));
              }
            }}
          >
            <div className={`ore-slider-track transition-all duration-300 ${focused ? 'ring-2 ring-white ring-offset-2 ring-offset-[#2A2A2C]' : ''}`}>
              <div 
                className={`ore-slider-fill transition-colors duration-300 ${fillColorClass || ''}`}
                style={{ width: `${percentage}%` }}
              />
            </div>

            <div 
              className={`
                ore-slider-thumb transition-colors duration-300
                ${isDragging ? 'active' : ''} 
                ${focused ? 'ring-4 ring-white/40 brightness-125 scale-110' : ''}
                ${thumbColorClass || ''}
              `}
              style={{ left: `${percentage}%` }}
            />
          </div>
        )}
      </FocusItem>
    </div>
  );
};