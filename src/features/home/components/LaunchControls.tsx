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
  
  // 统一定义内部元素的尺寸与居中方式
  // 注意：去掉了 px- padding 覆盖，绝不干涉 OreButton 组件自带的 padding
  // 利用 flex 和 gap-3 保证图标和文字完美居中
  const innerButtonClass = "h-[clamp(48px,6vh,64px)] text-[clamp(16px,1.8vh,20px)] flex items-center justify-center gap-3 w-full transition-colors duration-200";
  const iconClass = "flex-shrink-0 w-[clamp(20px,2.5vh,28px)] h-[clamp(20px,2.5vh,28px)]";

  useEffect(() => {
    // 自动将默认焦点吸附到 Play 按钮，解决键盘首次无法操作的问题
    const timer = setTimeout(() => {
      focusManager.focus('play-button');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    // 稍微增大了 space-y 间距，留出足以容纳焦点外框的空间，防止互相遮挡
    <div className="flex flex-col items-center justify-center space-y-[clamp(20px,3vh,32px)] w-[clamp(280px,25vw,420px)]">
      
      {/* 1. Play 主按钮 */}
      <FocusItem focusKey="play-button" onEnter={onLaunch}>
        {({ ref, focused }) => (
          // ✅ 核心修复 1：废弃 scale 放大，使用 outline 机制。
          // outline 是绘制在盒子模型外部的，无论怎么变化都绝对不会引起任何 "布局浮动" 和 padding 挤压。
          // 未聚焦时使用 outline-transparent 提前占位，确保尺寸永远一致。
          <div 
            ref={ref} 
            className={`
              w-full rounded-sm transition-shadow duration-150
              ${focused 
                ? 'outline outline-[3px] outline-offset-[4px] outline-ore-green shadow-[0_0_20px_rgba(56,133,39,0.5)] z-10' 
                : 'outline outline-[3px] outline-offset-[4px] outline-transparent'
              }
            `}
          >
            {/* ✅ 核心修复 2：恢复了 size="full"，强制 OreButton 内部按钮撑满外层 div，彻底解决光环宽、按钮窄的问题 */}
            <OreButton 
              variant="primary" 
              size="full"
              className={innerButtonClass}
              onClick={onLaunch}
              tabIndex={-1} 
            >
              <Play fill="currentColor" className={iconClass} />
              <span className="font-minecraft font-bold tracking-widest uppercase leading-none">
                Play
              </span>
            </OreButton>
          </div>
        )}
      </FocusItem>

      {/* 2. 实例选择按钮 */}
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

      {/* 3. 设置按钮 */}
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