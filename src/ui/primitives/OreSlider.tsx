import React, { useRef, useState, useCallback } from 'react';
import { FocusItem } from '../focus/FocusItem';
import { motion } from 'motion/react';

interface OreSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  description?: string;
  valueFormatter?: (val: number) => string;
  showCounter?: boolean;
  segments?: number;
  disabled?: boolean;
  className?: string;
  focusKey?: string;
  onArrowPress?: (direction: string) => boolean | void;
  fillColorClass?: string;
  thumbColorClass?: string;
  'aria-label'?: string;
}

export const OreSlider: React.FC<OreSliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
  description,
  valueFormatter,
  showCounter = false,
  segments,
  disabled = false,
  className = '',
  focusKey,
  onArrowPress,
  fillColorClass = '',
  thumbColorClass = '',
  'aria-label': ariaLabel,
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

  const formattedValue = valueFormatter
    ? valueFormatter(value)
    : showCounter
    ? String(Math.round(value)).padStart(3, '0')
    : value;

  return (
    <div className={`flex flex-col w-full ${className}`}>
      {(label || description) && (
        <div className="flex justify-between items-start mb-2 px-1 select-none font-minecraft">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1 pr-2">
            {label && (
              <span className="font-bold text-white text-sm uppercase tracking-wide ore-text-shadow">
                {label}
              </span>
            )}
            {description && (
              <span className="text-[11px] text-[var(--ore-color-text-muted-default)] tracking-wide">
                {description}
              </span>
            )}
          </div>
          <span className="font-mono font-bold text-sm text-white ore-text-shadow shrink-0">
            {formattedValue}
          </span>
        </div>
      )}

      <FocusItem 
        focusKey={focusKey} 
        disabled={disabled}
        onArrowPress={onArrowPress}
        onFocus={() => {
          trackRef.current?.focus({ preventScroll: true });
        }}
      >
        {({ ref: focusRef, focused, tabIndex }) => (
          <div 
            ref={(node) => {
              trackRef.current = node;
              if (focusRef) {
                if (typeof focusRef === 'function') {
                  (focusRef as (node: HTMLDivElement | null) => void)(node);
                } else {
                  (focusRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                }
              }
            }}
            role="slider"
            aria-valuenow={value}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuetext={String(formattedValue)}
            aria-label={ariaLabel || label}
            aria-disabled={disabled}
            tabIndex={tabIndex}
            className={`ore-slider-wrapper ${disabled ? 'disabled' : ''} ${focused ? 'is-focused' : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={(e) => {
              if (disabled || !focused) return; 
              
              if (e.key === 'ArrowLeft') {
                e.stopPropagation(); e.preventDefault();
                onChange(Math.max(min, value - step));
              } else if (e.key === 'ArrowRight') {
                e.stopPropagation(); e.preventDefault();
                onChange(Math.min(max, value + step));
              }
            }}
          >
            {/* 底层凹陷轨道 */}
            <div className="ore-slider-track">
              <motion.div 
                className={`ore-slider-fill ${fillColorClass}`}
                animate={{ width: `${Math.round(percentage)}%` }}
                transition={isDragging ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 30 }}
                style={{ transition: 'none' }}
              />

              {/* 分段刻度标记 (Segmented Ticks) */}
              {segments && segments > 1 && (
                <div className="ore-slider-segments" aria-hidden="true">
                  {Array.from({ length: segments - 1 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="ore-slider-segment-tick"
                      style={{ left: `${((idx + 1) / segments) * 100}%` }}
                    />
                  ))}
                </div>
              )}
            </div>
 
            {/* 物理正方形滑块 (无 Scale 缩放，保持 OreUI 直角像素) */}
            <motion.div 
              className={`
                ore-slider-thumb 
                ${thumbColorClass}
                ${isDragging ? 'active' : ''}
              `}
              animate={{ left: `${Math.round(percentage)}%` }}
              transition={isDragging ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 30 }}
              style={{ transition: 'none', x: '-50%', y: '-50%' }}
            />
          </div>
        )}
      </FocusItem>
    </div>
  );
};

