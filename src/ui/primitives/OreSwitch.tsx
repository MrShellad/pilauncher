// /src/ui/primitives/OreSwitch.tsx
import React from 'react';

interface OreSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const OreSwitch: React.FC<OreSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  className = ''
}) => {
  return (
    <div className={`p-1.5 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        // 外部轨道：宽58，高24
        className={`
          relative w-[58px] h-[24px] overflow-visible outline-none ore-track
          ${disabled ? 'bg-[#D0D1D4] cursor-not-allowed border-[#8C8D90]' : 'cursor-pointer'}
        `}
        style={!disabled ? {
          // 巧妙的对半渐变背景
          background: 'linear-gradient(to right, #3C8527 50%, #8C8D90 50%)'
        } : {}}
      >
        {/* 滑动推钮：宽高28 */}
        <div 
          className={`
            absolute w-[28px] h-[28px] top-[-4px] z-10
            ${disabled ? 'bg-[#D0D1D4] border-[#8C8D90] shadow-[inset_0_-4px_#B1B2B5]' : 'ore-thumb'}
          `}
          style={{
            // left 从 -2px 到 28px
            left: checked ? '28px' : '-2px'
          }}
        />
      </button>
    </div>
  );
};