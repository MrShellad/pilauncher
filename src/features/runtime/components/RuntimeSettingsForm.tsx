// src/features/runtime/components/RuntimeSettingsForm.tsx
import React from 'react';

import { SettingsSection } from '../../../ui/layout/SettingsSection';
import { FormRow } from '../../../ui/layout/FormRow';
import { OreSwitch } from '../../../ui/primitives/OreSwitch';

import { JavaSelector } from './JavaSelector';
import { MemorySlider } from './MemorySlider';
import { JVMParamsEditor } from './JVMParamsEditor';
import type { RuntimeConfig } from '../types';

export const RuntimeSettingsForm: React.FC<{
  mode: 'global' | 'instance';
  config: RuntimeConfig;
  onChange: (c: RuntimeConfig) => void;
}> = ({ mode, config, onChange }) => {
  const isInstance = mode === 'instance';
  const handleChange = (key: keyof RuntimeConfig, value: any) => onChange({ ...config, [key]: value });

  return (
    <>
      <SettingsSection title="Java 运行环境" icon={<span className="font-minecraft font-bold">☕</span>}>
        {isInstance && (
          <FormRow
            label="跟随全局 Java 设定"
            description="启用后，该实例将使用启动器全局配置的 Java 路径。"
            control={
              // ✅ 核心修复：直接把入口锚点名称传给 OreSwitch 组件，抛弃多余的外层包装！
              <OreSwitch
                focusKey="java-entry-point" 
                checked={config.useGlobalJava}
                onChange={(v) => handleChange('useGlobalJava', v)}
              />
            }
          />
        )}

        <div className={`transition-opacity duration-300 ${isInstance && config.useGlobalJava ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          <FormRow
            label="Java 运行时路径"
            description="请确保 Java 版本和当前 Minecraft 版本匹配。"
            control={
              <JavaSelector
                value={config.javaPath}
                onChange={(v) => handleChange('javaPath', v)}
                disabled={isInstance && config.useGlobalJava}
              />
            }
          />
        </div>
      </SettingsSection>

      <div className="mt-8">
        <SettingsSection title="内存与参数分配" icon={<span className="font-minecraft font-bold">🧠</span>}>
          {isInstance && (
            <FormRow
              label="跟随全局内存设定"
              description="启用后，该实例将使用全局内存和 JVM 参数配置。"
              control={
                // ✅ 同样剥离外层包装，恢复纯净调用
                <OreSwitch
                  focusKey="java-switch-global-memory"
                  checked={config.useGlobalMemory}
                  onChange={(v) => handleChange('useGlobalMemory', v)}
                />
              }
            />
          )}

          <div className={`transition-opacity duration-300 divide-y-2 divide-[#1E1E1F] ${isInstance && config.useGlobalMemory ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            <FormRow
              label="最大内存分配"
              description="动态调整游戏可用 RAM，建议保留系统余量。"
              control={
                <MemorySlider
                  maxMemory={config.maxMemory}
                  onChange={(v) => handleChange('maxMemory', v)}
                  disabled={isInstance && config.useGlobalMemory}
                />
              }
            />
            <FormRow
              label="JVM 附加参数"
              description="高级选项。可添加额外启动参数用于优化或调试。"
              control={
                <JVMParamsEditor
                  value={config.jvmArgs}
                  onChange={(v) => handleChange('jvmArgs', v)}
                  disabled={isInstance && config.useGlobalMemory}
                />
              }
            />
          </div>
        </SettingsSection>
      </div>
    </>
  );
};