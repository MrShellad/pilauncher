// src/features/Settings/components/tabs/JavaSettings.tsx
import React, { useState } from 'react';
import { Coffee, Cpu, Loader2, Download } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
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
// ✅ 引入 Java 检测引擎
import { validateCachedJava, scanJava } from '../../../runtime/logic/javaDetector';

export const JavaSettings: React.FC = () => {
  const { settings, updateJavaSetting } = useSettingsStore();
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

  const handleDownloadJava = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await invoke('download_java_env', {
        version: parseInt(javaVersion),
        provider: javaProvider
      });
      // 触发一次检测更新
      setTimeout(async () => {
        const valid = await scanJava();
        if (valid.length > 0 && java.autoDetect) {
          const sorted = valid.sort((a, b) => b.version.localeCompare(a.version));
          updateJavaSetting('javaPath', sorted[0].path);
        }
      }, 3000);
    } catch (err: any) {
      setDownloadError(String(err));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <SettingsPageLayout title="Java 运行环境" subtitle="Global Java & Runtime Allocation">

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
