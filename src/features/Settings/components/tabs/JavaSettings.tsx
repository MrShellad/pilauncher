// src/features/Settings/components/tabs/JavaSettings.tsx
import React, { useState } from 'react';
import { Coffee, Cpu, Loader2, Download } from 'lucide-react';

import { invoke } from '@tauri-apps/api/core';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';

import { JavaSelector } from '../../../runtime/components/JavaSelector';
import { MemorySlider } from '../../../runtime/components/MemorySlider';
import { JVMParamsEditor } from '../../../runtime/components/JVMParamsEditor';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
import downloadSource from '../../../../assets/config/downloadsource.json';

import { useSettingsStore } from '../../../../store/useSettingsStore';
// ✅ 引入 Java 检测引擎 (仅保留类型或不必要的引用已移除)
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';

export const JavaSettings: React.FC = () => {
  const { settings, updateJavaSetting, triggerJavaAutoDetect } = useSettingsStore();
  // ✅ 新增状态：用于在自动检测时展示 Loading 动画防抖
  const [isDetecting, setIsDetecting] = useState(false);

  // Java 下载状态
  const [javaVersion, setJavaVersion] = useState('21');
  const [javaProvider, setJavaProvider] = useState(downloadSource.sources.java[0]?.id || 'adoptium');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const java = settings.java;

  const JAVA_OPTIONS = [
    { label: 'Java 25 (适用于较新版本)', value: '25' },
    { label: 'Java 21 (适用于 MC 1.21+)', value: '21' },
    { label: 'Java 17 (适用于 MC 1.18 - 1.20)', value: '17' },
    { label: 'Java 16 (适用于 MC 1.17)', value: '16' },
    { label: 'Java 8  (适用于 MC 1.7 - 1.16)', value: '8' },
  ];

  const PROVIDER_OPTIONS = downloadSource.sources.java.map((source: any) => ({
    label: source.name,
    value: source.id
  }));

  const focusOrder = React.useMemo(() => {
    const keys = [
      'settings-java-download-version',
      'settings-java-download-provider',
      'settings-java-btn-download',
      'settings-java-autodetect'
    ];
    if (!java.autoDetect && !isDetecting) {
      keys.push('java-input-path', 'java-btn-browse');
    }
    keys.push('java-slider-memory', 'java-btn-recommend', 'java-input-jvm');
    return keys;
  }, [java.autoDetect, isDetecting]);

  const { handleLinearArrow } = useLinearNavigation(focusOrder);

  // ✅ 自动触发逻辑：页面打开时，如果开启了自动检测，则跑一次扫描
  React.useEffect(() => {
    if (settings.java.autoDetect) {
      setIsDetecting(true);
      triggerJavaAutoDetect().finally(() => setIsDetecting(false));
    }
  }, []);

  // ✅ 核心修复：重写 Switch 的 onChange 逻辑，委托给 store Action
  const handleAutoDetectToggle = async (v: boolean | React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = typeof v === 'boolean' ? v : (v as any).target?.checked;
    updateJavaSetting('autoDetect', isChecked);

    if (isChecked) {
      setIsDetecting(true);
      triggerJavaAutoDetect().finally(() => setIsDetecting(false));
    }
  };

  const handleDownloadJava = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await invoke('download_java_env', {
        version: parseInt(javaVersion),
        provider: javaProvider
      });
      // 触发一次检测更新 (静默回填各分类)
      setTimeout(async () => {
         await triggerJavaAutoDetect();
      }, 3000);
    } catch (err: any) {
      setDownloadError(String(err));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <SettingsPageLayout adaptiveScale>

      <SettingsSection title="自动下载获取" icon={<Download size={18} />}>
        <div className="px-6 py-4 bg-[#141415]/50 flex flex-col gap-4">
          <p className="font-minecraft text-sm text-ore-text-muted leading-relaxed">
            选择需要的 Java 版本和下载源，点击下载后将自动安装到本地 <code className="bg-black/30 px-1 rounded">runtime/Java</code> 目录。
          </p>

          {/* ✅ 核心修改：改为 12 栅格的 Grid 布局，严格控制比例 */}
          <div className="grid grid-cols-12 gap-4 items-end w-full">

            {/* Java 版本占据 5/12 宽度 */}
            <div className="col-span-12 sm:col-span-5 relative">
              <label className="text-xs text-ore-text-muted mb-1 block truncate">目标 Java 版本：</label>
              <div className="w-full [&>button]:w-full [&>div]:w-full">
                <OreDropdown
                  focusKey="settings-java-download-version"
                  onArrowPress={handleLinearArrow}
                  options={JAVA_OPTIONS}
                  value={javaVersion}
                  onChange={setJavaVersion}
                  disabled={isDownloading}
                />
              </div>
            </div>

            <div className="col-span-12 sm:col-span-4 relative">
              <label className="text-xs text-ore-text-muted mb-1 block truncate">下载源：</label>
              <div className="w-full [&>button]:w-full [&>div]:w-full">
                <OreDropdown
                  focusKey="settings-java-download-provider"
                  onArrowPress={handleLinearArrow}
                  options={PROVIDER_OPTIONS}
                  value={javaProvider}
                  onChange={setJavaProvider}
                  disabled={isDownloading}
                />
              </div>
            </div>
            <div className="col-span-12 sm:col-span-3">
              <OreButton
                focusKey="settings-java-btn-download"
                onArrowPress={handleLinearArrow}
                onClick={handleDownloadJava}
                disabled={isDownloading}
                variant="primary"
                className="w-full flex justify-center items-center"
              >
                {isDownloading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Download size={16} className="mr-2" />}
                {isDownloading ? '正在下载...' : '一键下载'}
              </OreButton>
            </div>
          </div>
          {downloadError && (
            <div className="text-red-400 text-sm mt-2">{downloadError}</div>
          )}
        </div>
      </SettingsSection>

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
              onArrowPress={handleLinearArrow}
              checked={java.autoDetect}
              onChange={handleAutoDetectToggle}
              disabled={isDetecting}
            />
          }
        />

        <FormRow
          label="全局 Java 运行时路径 (兜底方案)"
          description="若下方具体版本的路径为空，将使用此路径作为默认运行环境。"
          vertical={true}
          control={
            <div className="w-full relative">
              <JavaSelector
                onArrowPress={handleLinearArrow}
                value={(java.autoDetect && !java.javaPath) ? '缺少Java环境' : (java.javaPath || '')}
                onChange={(v) => {
                  updateJavaSetting('javaPath', v);
                  if (v) updateJavaSetting('autoDetect', false);
                }}
                disabled={java.autoDetect || isDetecting}
                isError={java.autoDetect && !java.javaPath}
              />
              {java.autoDetect && (
                <div className="absolute inset-0 z-10 cursor-not-allowed" />
              )}
            </div>
          }
        />

        <div className="px-6 py-2">
           <div className="h-[1px] bg-white/5 w-full my-2" />
           <p className="text-xs text-ore-text-muted mb-4 uppercase tracking-wider font-bold">版本化全局配置 (推荐)</p>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {[
                { id: '8', label: 'Java 8', desc: '适用于 1.16.5 及更早版本' },
                { id: '16', label: 'Java 16', desc: '专门用于 1.17 / 1.17.1' },
                { id: '17', label: 'Java 17', desc: '适用于 1.18 - 1.20.4' },
                { id: '21', label: 'Java 21', desc: '适用于 1.20.5 及更新版本' },
              ].map((item) => (
                <div key={item.id} className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-minecraft">{item.label}</span>
                    <span className="text-[10px] text-ore-text-muted">{item.desc}</span>
                  </div>
                  <JavaSelector
                    onArrowPress={handleLinearArrow}
                    value={(java.autoDetect && !java.majorJavaPaths[item.id]) ? '缺少Java环境' : (java.majorJavaPaths[item.id] || '')}
                    onChange={(v) => {
                      const newPaths = { ...java.majorJavaPaths, [item.id]: v };
                      updateJavaSetting('majorJavaPaths', newPaths);
                      if (v) updateJavaSetting('autoDetect', false);
                    }}
                    disabled={java.autoDetect || isDetecting}
                    isError={java.autoDetect && !java.majorJavaPaths[item.id]}
                  />
                </div>
              ))}
           </div>
        </div>
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
          control={
            <MemorySlider
              onArrowPress={handleLinearArrow}
              maxMemory={java.maxMemory}
              onChange={(v) => updateJavaSetting('maxMemory', v)}
              disabled={false}
            />
          }
        />

        <FormRow
          label="全局 JVM 附加参数"
          description="高级选项。添加额外的启动参数以优化游戏性能，将应用到所有继承全局设置的实例。"
          vertical={true}
          control={
            <div className="w-full">
              <JVMParamsEditor
                onArrowPress={handleLinearArrow}
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
