// /src/features/Settings/components/tabs/GeneralSettings.tsx
import React, { useState } from 'react';
import { SettingItem } from '../SettingItem';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../ui/primitives/OreButton';

export const GeneralSettings: React.FC = () => {
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [analytics, setAnalytics] = useState(false);

  return (
    <div className="space-y-4 pb-10">
      <div className="mb-6">
        <h2 className="text-2xl font-minecraft text-white ore-text-shadow mb-1">常规设置</h2>
        <p className="text-sm font-minecraft text-ore-text-muted tracking-widest">General Preferences</p>
      </div>

      <SettingItem 
        title="自动检查更新" 
        description="在启动器启动时自动检测并下载 PiLauncher 的最新版本。"
      >
        <OreSwitch checked={autoUpdate} onChange={setAutoUpdate} />
      </SettingItem>

      <SettingItem 
        title="发送匿名统计数据" 
        description="发送崩溃报告和基本使用情况，以帮助我们改进启动器。"
      >
        <OreSwitch checked={analytics} onChange={setAnalytics} />
      </SettingItem>

      <SettingItem 
        title="语言 (Language)" 
        description="更改启动器的显示语言。重启后完全生效。"
      >
        <select className="bg-[#141415] border-2 border-ore-gray-border text-white font-minecraft p-2 focus:outline-none focus:border-ore-green">
          <option value="zh-CN">简体中文</option>
          <option value="en-US">English</option>
        </select>
      </SettingItem>

      <SettingItem 
        title="全局数据目录" 
        description="所有实例、核心和配置文件的存放根目录。(如需迁移请前往高级选项)"
      >
        <div className="flex space-x-2">
          <OreInput value="D:\PiLauncher" readOnly className="opacity-70 cursor-not-allowed w-48" />
          <OreButton variant="secondary" size="sm">打开</OreButton>
        </div>
      </SettingItem>
    </div>
  );
};