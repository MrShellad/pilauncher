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
  focusKey?: string;
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
  focusKey,
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

      {/* ✅ 使用 FocusItem 接入底层空间导航引擎 */}
      <FocusItem focusKey={focusKey} disabled={disabled}>
        {({ ref: focusRef, focused }) => (
          <div 
            // 完美合并内部 DOM 测距 Ref 与 Norigin 导航 Ref
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
            tabIndex={disabled ? -1 : 0}
            // ✅ 焦点控制权全部交由外层 wrapper，CSS 响应 .is-focused
            className={`ore-slider-wrapper ${disabled ? 'disabled' : ''} ${focused ? 'is-focused' : ''}`}
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
            {/* 底层凹陷轨道 */}
            <div className="ore-slider-track">
              {/* 进度填充槽：拖拽时无延迟 (transition-none)，点击时有补间动画 */}
              <div 
                className={`ore-slider-fill ${isDragging ? 'transition-none' : 'transition-[width] duration-100 ease-linear'}`}
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* 物理滑块：脱离轨道高度，绝对居中 */}
            <div 
              className={`
                ore-slider-thumb 
                ${isDragging ? 'active transition-none' : 'transition-[left] duration-100 ease-linear'}
              `}
              style={{ left: `${percentage}%` }}
            />
          </div>
        )}
      </FocusItem>
    </div>
  );
};