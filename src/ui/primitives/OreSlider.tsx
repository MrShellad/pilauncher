// /src/ui/primitives/OreSlider.tsx
import React, { useRef, useState, useCallback } from 'react';

interface OreSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;            // 开关上方的文字标签
  valueFormatter?: (val: number) => string; // 格式化显示值 (比如加个 "%")
  disabled?: boolean;
  className?: string;
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
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 计算百分比以控制 UI 渲染
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  // 核心坐标计算逻辑
  const updateValueFromPointer = useCallback((clientX: number) => {
    if (!trackRef.current || disabled) return;
    
    const rect = trackRef.current.getBoundingClientRect();
    let percent = (clientX - rect.left) / rect.width;
    percent = Math.max(0, Math.min(1, percent));
    
    const rawValue = percent * (max - min) + min;
    // 处理步长 (step)
    let steppedValue = Math.round((rawValue - min) / step) * step + min;
    // 修复浮点数精度丢失问题 (如 0.30000000004)
    steppedValue = Number(steppedValue.toFixed(5));
    
    // 只有值发生变化时才触发 onChange
    if (steppedValue !== value) {
      onChange(Math.min(max, Math.max(min, steppedValue)));
    }
  }, [disabled, max, min, step, value, onChange]);

  // --- 指针事件处理 (支持鼠标和触摸屏) ---
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    setIsDragging(true);
    // 捕获指针，即使鼠标移出组件/窗口也能继续拖拽
    e.currentTarget.setPointerCapture(e.pointerId);
    updateValueFromPointer(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      updateValueFromPointer(e.clientX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className={`flex flex-col w-full ${className}`}>
      {/* 顶部标签和数值显示 */}
      <div className="flex justify-between items-end mb-2 px-1 select-none">
        {label && (
          <span className="font-minecraft font-bold text-ore-text-muted ore-text-shadow">
            {label}
          </span>
        )}
        <span className="font-minecraft text-white ore-text-shadow">
          {valueFormatter ? valueFormatter(value) : value}
        </span>
      </div>

      {/* 核心滑动轨道区 */}
      <div 
        ref={trackRef}
        className={`ore-slider-wrapper ${disabled ? 'disabled' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        // 意外中断时停止拖拽
        onPointerCancel={handlePointerUp}
      >
        {/* 底层轨道 */}
        <div className="ore-slider-track">
          {/* 绿色进度槽 */}
          <div 
            className="ore-slider-fill"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* 物理推钮 */}
        <div 
          className={`ore-slider-thumb ${isDragging ? 'active' : ''}`}
          style={{ left: `${percentage}%` }}
        />
      </div>
    </div>
  );
};