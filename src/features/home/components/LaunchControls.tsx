// /src/features/home/components/LaunchControls.tsx
import React, { useEffect } from 'react';
import { OreButton } from '../../../ui/primitives/OreButton';
import { Play, Folder, Settings } from 'lucide-react';

// 引入空间焦点组件和焦点管理器
import { FocusItem } from '../../../ui/focus/FocusItem';
import { focusManager } from '../../../ui/focus/FocusManager';

interface LaunchControlsProps {
  instanceName: string;
  onLaunch: () => void;
  onSettings: () => void;
  onSelectInstance: () => void;
}

export const LaunchControls: React.FC<LaunchControlsProps> = ({
  instanceName,
  onLaunch,
  onSettings,
  onSelectInstance,
}) => {
  
  // ==========================================
  // 次要按钮尺寸 (保留原有的精致感)
  // ==========================================
  const innerButtonClass = "h-[clamp(48px,6vh,64px)] text-[clamp(16px,1.8vh,20px)] flex items-center justify-center gap-3 w-full transition-colors duration-200";
  const iconClass = "flex-shrink-0 w-[clamp(20px,2.5vh,28px)] h-[clamp(20px,2.5vh,28px)]";

  // ==========================================
  // 巨型主按钮尺寸 (Hero Button 专属)
  // ==========================================
  const heroButtonClass = "h-[clamp(56px,7.5vh,76px)] text-[clamp(18px,2.2vh,24px)] flex items-center justify-center gap-3 w-full transition-colors duration-200";
  const heroIconClass = "flex-shrink-0 w-[clamp(24px,3vh,32px)] h-[clamp(24px,3vh,32px)]";

  useEffect(() => {
    // 自动将默认焦点吸附到 Play 按钮
    const timer = setTimeout(() => {
      focusManager.focus('play-button');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center space-y-[clamp(20px,3vh,32px)] w-[clamp(280px,25vw,420px)]">
      
      {/* 1. Play 主按钮 (升级为 Hero 视觉) */}
      <FocusItem focusKey="play-button" onEnter={onLaunch}>
        {({ ref, focused }) => (
          // 套一层 relative group 用来承载底层光晕
          <div className="relative w-full group">
            
            {/* 核心视觉提升：底层环境光晕 (Ambient Glow) */}
            <div 
              className={`
                absolute inset-0 bg-ore-green/40 blur-xl rounded-sm pointer-events-none transition-all duration-500
                ${focused ? 'bg-ore-green/70 blur-2xl scale-105' : 'group-hover:bg-ore-green/60 group-hover:blur-2xl'}
              `} 
            />

            {/* 按钮本体：保留你完美的 outline 无抖动方案 */}
            <div 
              ref={ref} 
              className={`
                relative w-full rounded-sm transition-shadow duration-150 z-10
                ${focused 
                  ? 'outline outline-[3px] outline-offset-[4px] outline-ore-green shadow-[0_0_20px_rgba(56,133,39,0.6)]' 
                  : 'outline outline-[3px] outline-offset-[4px] outline-transparent'
                }
              `}
            >
              <OreButton 
                variant="primary" 
                size="full"
                className={heroButtonClass}
                onClick={onLaunch}
                tabIndex={-1} 
              >
                <Play fill="currentColor" className={heroIconClass} />
                <span className="font-minecraft font-bold tracking-[0.1em] uppercase leading-none">
                  Play
                </span>
              </OreButton>
            </div>
          </div>
        )}
      </FocusItem>

      {/* 2. 实例选择按钮 (保持原样) */}
      <FocusItem focusKey="instance-button" onEnter={onSelectInstance}>
        {({ ref, focused }) => (
          <div 
            ref={ref} 
            className={`
              w-full rounded-sm transition-shadow duration-150
              ${focused 
                ? 'outline outline-[3px] outline-offset-[4px] outline-white/60 shadow-[0_0_15px_rgba(255,255,255,0.2)] z-10' 
                : 'outline outline-[3px] outline-offset-[4px] outline-transparent'
              }
            `}
          >
            <OreButton 
              variant="secondary" 
              size="full"
              className={innerButtonClass}
              onClick={onSelectInstance}
              tabIndex={-1}
            >
              <Folder className={iconClass} />
              <span className="font-minecraft truncate max-w-[70%] tracking-wide leading-none">
                {instanceName}
              </span>
            </OreButton>
          </div>
        )}
      </FocusItem>

      {/* 3. 设置按钮 (保持原样) */}
      <FocusItem focusKey="settings-button" onEnter={onSettings}>
        {({ ref, focused }) => (
          <div 
            ref={ref} 
            className={`
              w-full rounded-sm transition-shadow duration-150
              ${focused 
                ? 'outline outline-[3px] outline-offset-[4px] outline-white/60 shadow-[0_0_15px_rgba(255,255,255,0.2)] z-10' 
                : 'outline outline-[3px] outline-offset-[4px] outline-transparent'
              }
            `}
          >
            <OreButton 
              variant="secondary" 
              size="full"
              className={innerButtonClass}
              onClick={onSettings}
              tabIndex={-1}
            >
              <Settings className={iconClass} />
              <span className="font-minecraft font-medium tracking-wide leading-none">
                Settings
              </span>
            </OreButton>
          </div>
        )}
      </FocusItem>
      
    </div>
  );
};