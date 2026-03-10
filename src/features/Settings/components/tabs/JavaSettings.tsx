// src/features/Settings/components/tabs/JavaSettings.tsx
import React, { useState } from 'react';
import { Coffee, Cpu, Loader2 } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';

import { JavaSelector } from '../../../runtime/components/JavaSelector';
import { MemorySlider } from '../../../runtime/components/MemorySlider';
import { JVMParamsEditor } from '../../../runtime/components/JVMParamsEditor';

import { useSettingsStore } from '../../../../store/useSettingsStore';
// ✅ 引入 Java 检测引擎
import { validateCachedJava, scanJava } from '../../../runtime/logic/javaDetector';

export const JavaSettings: React.FC = () => {
  const { settings, updateJavaSetting } = useSettingsStore();
  // ✅ 新增状态：用于在自动检测时展示 Loading 动画防抖
  const [isDetecting, setIsDetecting] = useState(false);
  
  const java = settings.java;

  // ✅ 核心修复：重写 Switch 的 onChange 逻辑
  const handleAutoDetectToggle = async (v: boolean | React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = typeof v === 'boolean' ? v : (v as any).target?.checked;
    updateJavaSetting('autoDetect', isChecked);
    
    // 如果开启了自动检测，去抓取最新的 Java 填入输入框
    if (isChecked) {
      setIsDetecting(true);
      try {
        // 先尝试从缓存中快速读取有效列表
        let { valid } = await validateCachedJava();
        
        // 如果缓存彻底空了，自动触发一次深扫
        if (valid.length === 0) {
          valid = await scanJava();
        }
        
        if (valid.length > 0) {
          // 按照版本号降序排列，拿到最新的 JDK
          const sorted = valid.sort((a, b) => b.version.localeCompare(a.version));
          updateJavaSetting('javaPath', sorted[0].path);
        }
      } catch (e) {
        console.error("自动回填 Java 路径失败:", e);
      } finally {
        setIsDetecting(false);
      }
    }
  };

  return (
    <SettingsPageLayout title="Java 运行环境" subtitle="Global Java & Runtime Allocation">
      
      <SettingsSection title="环境配置" icon={<Coffee size={18} />}>
        <FormRow 
          label={
            <div className="flex items-center gap-2">
              自动检测 Java 环境
              {isDetecting && <Loader2 size={14} className="animate-spin text-ore-green" />}
            </div>
          } 
          description="启动游戏时，自动匹配对应版本最适合的 JDK。开启后将自动扫描并回填本机最新的 Java 路径。"
          control={
            <OreSwitch 
              focusKey="settings-java-autodetect"
              checked={java.autoDetect} 
              onChange={handleAutoDetectToggle} 
              disabled={isDetecting}
              onArrowPress={(direction) => {
                if (direction !== 'down') return true;
                setFocus(java.autoDetect ? 'java-slider-memory' : 'java-input-path');
                return false;
              }}
            />
          }
        />

        <FormRow 
          label="全局 Java 运行时路径" 
          description="为所有未开启独立 Java 设置的实例提供默认的运行环境。点击选择可扫描或手动浏览本机目录。"
          vertical={true}
          control={
            <div className="w-full relative">
              <JavaSelector 
                value={java.javaPath} 
                onChange={(v) => {
                  updateJavaSetting('javaPath', v);
                  // 手动修改路径后，自动关闭“自动检测”开关
                  if (v) updateJavaSetting('autoDetect', false);
                }} 
                // 检测期间也临时禁用，防止冲突
                disabled={java.autoDetect || isDetecting} 
              />
              {java.autoDetect && (
                <div className="absolute inset-0 z-10 cursor-not-allowed" title="自动检测已开启，已锁定最佳路径" />
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
