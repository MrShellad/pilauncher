// /src/features/Settings/components/tabs/JavaSettings.tsx
import React, { useState } from 'react';
import { SettingItem } from '../SettingItem';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreSlider } from '../../../../ui/primitives/OreSlider';

export const JavaSettings: React.FC = () => {
  const [autoDetect, setAutoDetect] = useState(true);
  const [minMem, setMinMem] = useState(1024);
  const [maxMem, setMaxMem] = useState(4096);

  return (
    <div className="space-y-4 pb-10">
      <div className="mb-6">
        <h2 className="text-2xl font-minecraft text-white ore-text-shadow mb-1">Java 运行环境</h2>
        <p className="text-sm font-minecraft text-ore-text-muted tracking-widest">Java Runtime & Memory Allocation</p>
      </div>

      <SettingItem 
        title="自动检测 Java 环境" 
        description="启动游戏时自动匹配对应版本最适合的 JDK。"
      >
        <OreSwitch checked={autoDetect} onChange={setAutoDetect} />
      </SettingItem>

      {/* 内存分配块 */}
      <div className="bg-[#1E1E1F] border-2 border-ore-gray-border p-4 flex flex-col">
        <span className="font-minecraft text-white text-base tracking-wide ore-text-shadow mb-1">
          全局内存分配
        </span>
        <span className="font-minecraft text-xs text-ore-text-muted leading-relaxed mb-6">
          默认情况下新创建的实例会继承这里的内存设置。若滑块变灰，说明已被实例的独立配置覆盖。
        </span>

        <div className="space-y-6">
          <div className="flex flex-col">
            <div className="flex justify-between font-minecraft text-sm mb-2">
              <span className="text-ore-text-muted">最小内存 (Min)</span>
              <span className="text-ore-green font-bold">{minMem} MB</span>
            </div>
            <OreSlider value={minMem} min={512} max={8192} step={512} onChange={setMinMem} />
          </div>

          <div className="flex flex-col">
            <div className="flex justify-between font-minecraft text-sm mb-2">
              <span className="text-ore-text-muted">最大内存 (Max)</span>
              <span className="text-ore-green font-bold">{maxMem} MB</span>
            </div>
            <OreSlider value={maxMem} min={1024} max={16384} step={512} onChange={setMaxMem} />
          </div>
        </div>
      </div>
    </div>
  );
};