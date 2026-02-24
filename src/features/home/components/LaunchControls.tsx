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
    <div className="flex items-center space-x-4 w-full justify-center max-w-2xl">
      {/* 实例选择 */}
      <OreButton size="md" className="w-48 justify-between" onClick={onSelectInstance}>
        <span className="truncate">{instanceName}</span>
        <Folder size={16} className="ml-2" />
      </OreButton>

      {/* 启动按钮 */}
      <OreButton variant="primary" size="lg" onClick={onLaunch} className="flex-1">
        <Play fill="currentColor" size={24} className="mr-3" />
        Play
      </OreButton>

      {/* 设置按钮 */}
      <OreButton size="md" className="px-4" onClick={onSettings}>
        <Settings size={20} />
      </OreButton>
    </div>
  );
};