// /src/features/home/components/LaunchControls.tsx
import React from 'react';
import { OreButton } from '../../../ui/primitives/OreButton';
import { Play, Folder, Settings } from 'lucide-react';

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
  return (
    <div className="flex flex-col items-center justify-center space-y-3 md:space-y-4 lg:space-y-5 w-[80%] md:w-[40%] lg:w-[30%] min-w-[240px] max-w-[450px]">
      
      {/* 全部使用 size="full"，让它们跟随上面设定的父容器尺寸 */}
      <OreButton variant="primary" size="full" onClick={onLaunch}>
        {/* 图标尺寸也可以做成响应式，大屏更大 */}
        <Play fill="currentColor" className="mr-2 w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7" />
        Play
      </OreButton>

      <OreButton variant="secondary" size="full" onClick={onSelectInstance}>
        <Folder className="mr-2 flex-shrink-0 w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6" />
        <span className="truncate max-w-[120px] md:max-w-[160px] lg:max-w-[220px]">
          {instanceName}
        </span>
      </OreButton>

      <OreButton variant="secondary" size="full" onClick={onSettings}>
        <Settings className="mr-2 w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7" />
        Settings
      </OreButton>
      
    </div>
  );
};