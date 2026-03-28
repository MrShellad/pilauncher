import React, { useCallback, useMemo } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { SettingsSection } from '../../../ui/layout/SettingsSection';
import { FormRow } from '../../../ui/layout/FormRow';
import { OreSwitch } from '../../../ui/primitives/OreSwitch';

import { JavaSelector } from './JavaSelector';
import { JVMParamsEditor } from './JVMParamsEditor';
import { MemorySlider } from './MemorySlider';
import type { RuntimeConfig } from '../types';

export const RuntimeSettingsForm: React.FC<{
  mode: 'global' | 'instance';
  config: RuntimeConfig;
  onChange: (c: RuntimeConfig) => void;
}> = ({ mode, config, onChange }) => {
  const isInstance = mode === 'instance';
  const handleChange = (key: keyof RuntimeConfig, value: any) => onChange({ ...config, [key]: value });

  const focusOrder = useMemo(() => {
    const order: string[] = [];

    if (isInstance) {
      order.push('java-entry-point');
    }

    if (!(isInstance && config.useGlobalJava)) {
      order.push('java-btn-browse');
    }

    if (isInstance) {
      order.push('java-switch-global-memory');
    }

    if (!(isInstance && config.useGlobalMemory)) {
      order.push('java-slider-memory', 'java-btn-recommend', 'java-input-jvm');
    }

    return order;
  }, [config.useGlobalJava, config.useGlobalMemory, isInstance]);

  const handleLinearArrow = useCallback((fallbackKey: string) => (direction: string) => {
    const step = direction === 'left' || direction === 'up'
      ? -1
      : direction === 'right' || direction === 'down'
        ? 1
        : 0;

    if (step === 0) return true;

    const currentFocusKey = getCurrentFocusKey();
    const resolvedKey = currentFocusKey && focusOrder.includes(currentFocusKey)
      ? currentFocusKey
      : fallbackKey;
    const currentIndex = focusOrder.indexOf(resolvedKey);
    if (currentIndex === -1) return true;

    for (
      let nextIndex = currentIndex + step;
      nextIndex >= 0 && nextIndex < focusOrder.length;
      nextIndex += step
    ) {
      const nextKey = focusOrder[nextIndex];
      if (doesFocusableExist(nextKey)) {
        setFocus(nextKey);
        return false;
      }
    }

    return true;
  }, [focusOrder]);

  return (
    <>
      <SettingsSection title="Java 运行环境" icon={<span className="font-minecraft font-bold">J</span>}>
        {isInstance && (
          <FormRow
            label="跟随全局 Java 设定"
            description="启用后，该实例将使用启动器全局配置的 Java 路径。"
            control={
              <OreSwitch
                focusKey="java-entry-point"
                checked={config.useGlobalJava}
                onChange={(value) => handleChange('useGlobalJava', value)}
                onArrowPress={handleLinearArrow('java-entry-point')}
              />
            }
          />
        )}

        <div className={`transition-opacity duration-300 ${isInstance && config.useGlobalJava ? 'pointer-events-none opacity-40' : 'opacity-100'}`}>
          <FormRow
            label="Java 运行时路径"
            description="请确保 Java 版本和当前 Minecraft 版本匹配。"
            control={
              <JavaSelector
                value={config.javaPath}
                onChange={(value) => handleChange('javaPath', value)}
                disabled={isInstance && config.useGlobalJava}
                onArrowPress={handleLinearArrow('java-input-path')}
              />
            }
          />
        </div>
      </SettingsSection>

      <div className="mt-8">
        <SettingsSection title="内存与参数分配" icon={<span className="font-minecraft font-bold">M</span>}>
          {isInstance && (
            <FormRow
              label="跟随全局内存设定"
              description="启用后，该实例将使用全局内存和 JVM 参数配置。"
              control={
                <OreSwitch
                  focusKey="java-switch-global-memory"
                  checked={config.useGlobalMemory}
                  onChange={(value) => handleChange('useGlobalMemory', value)}
                  onArrowPress={handleLinearArrow('java-switch-global-memory')}
                />
              }
            />
          )}

          <div className={`divide-y-2 divide-[#1E1E1F] transition-opacity duration-300 ${isInstance && config.useGlobalMemory ? 'pointer-events-none opacity-40' : 'opacity-100'}`}>
            <FormRow
              label="最大内存分配"
              description="动态调整游戏可用 RAM，建议保留系统余量。"
              control={
                <MemorySlider
                  maxMemory={config.maxMemory}
                  onChange={(value) => handleChange('maxMemory', value)}
                  disabled={isInstance && config.useGlobalMemory}
                  onArrowPress={handleLinearArrow('java-slider-memory')}
                />
              }
            />
            <FormRow
              label="JVM 附加参数"
              description="高级选项。可添加额外启动参数用于优化或调试。"
              control={
                <JVMParamsEditor
                  value={config.jvmArgs}
                  onChange={(value) => handleChange('jvmArgs', value)}
                  disabled={isInstance && config.useGlobalMemory}
                  onArrowPress={handleLinearArrow('java-input-jvm')}
                />
              }
            />
          </div>
        </SettingsSection>
      </div>
    </>
  );
};
