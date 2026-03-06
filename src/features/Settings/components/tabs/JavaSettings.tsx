// src/features/Settings/components/tabs/JavaSettings.tsx
import React from 'react';
import { Coffee, Cpu } from 'lucide-react';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';

import { JavaSelector } from '../../../runtime/components/JavaSelector';
import { MemorySlider } from '../../../runtime/components/MemorySlider';
import { JVMParamsEditor } from '../../../runtime/components/JVMParamsEditor';

import { useSettingsStore } from '../../../../store/useSettingsStore';

export const JavaSettings: React.FC = () => {
  const { settings, updateJavaSetting } = useSettingsStore();
  
  // ✅ 结构已被 Store 深度合并保证，直接安全使用
  const java = settings.java;

  return (
    <SettingsPageLayout title="Java 运行环境" subtitle="Global Java & Runtime Allocation">
      
      <SettingsSection title="环境配置" icon={<Coffee size={18} />}>
        <FormRow 
          label="自动检测 Java 环境" 
          description="启动游戏时，若未指定路径，自动匹配对应版本最适合的 JDK。"
          control={
            <OreSwitch 
              checked={java.autoDetect} 
              onChange={(v) => {
                const isChecked = typeof v === 'boolean' ? v : (v as any).target?.checked;
                updateJavaSetting('autoDetect', isChecked);
                // 💡 联动优化：如果开启了自动检测，顺手把已有的手动路径清空
                if (isChecked) {
                  updateJavaSetting('javaPath', '');
                }
              }} 
            />
          }
        />

        <FormRow 
          label="全局 Java 运行时路径" 
          description="为所有未开启独立 Java 设置的实例提供默认的运行环境。"
          vertical={true}
          control={
            <div className="w-full relative">
              <JavaSelector 
                value={java.javaPath} 
                onChange={(v) => {
                  updateJavaSetting('javaPath', v);
                  // 💡 联动优化：如果用户手动选择了一个具体路径，就自动关闭“自动检测”
                  if (v) {
                    updateJavaSetting('autoDetect', false);
                  }
                }} 
                // 💡 视觉防呆：当自动检测开启且路径为空时，让它看起来是禁用或被接管的状态
                disabled={java.autoDetect} 
              />
              {/* 💡 给用户一个视觉提示 */}
              {java.autoDetect && (
                <div className="absolute inset-0 z-10 cursor-not-allowed" title="自动检测已开启，无需手动指定" />
              )}
            </div>
          }
        />
      </SettingsSection>

      <SettingsSection title="全局内存与参数" icon={<Cpu size={18} />}>
        <div className="px-6 py-4 bg-[#141415]/50">
          <p className="font-minecraft text-sm text-ore-text-muted leading-relaxed">
            默认情况下新创建的实例会继承此处的内存与参数设置。若实例开启了独立配置，则以实例设置为准。
          </p>
        </div>

        <FormRow 
          label="全局最大内存分配" 
          description="动态调整游戏可用的最大 RAM，系统会根据当前空闲内存给出智能推荐。"
          vertical={true}
          control={
            <div className="w-full">
              <MemorySlider 
                maxMemory={java.maxMemory} 
                onChange={(v) => updateJavaSetting('maxMemory', v)} 
                disabled={false} 
              />
            </div>
          }
        />

        <FormRow 
          label="全局 JVM 附加参数" 
          description="高级选项。添加额外的启动参数以优化游戏性能，将应用到所有继承全局设置的实例。"
          vertical={true}
          control={
            <div className="w-full">
              <JVMParamsEditor 
                value={java.jvmArgs} 
                onChange={(v) => updateJavaSetting('jvmArgs', v)} 
                disabled={false}
              />
            </div>
          }
        />
      </SettingsSection>
      
    </SettingsPageLayout>
  );
};