import React, { useMemo, useState } from 'react';
import { Coffee, Cpu, Download, Loader2, TestTube2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

import downloadSource from '../../../../assets/config/downloadsource.json';
import { useSettingsStore } from '../../../../store/useSettingsStore';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { FormRow } from '../../../../ui/layout/FormRow';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { JavaSelector } from '../../../runtime/components/JavaSelector';
import { JavaTestResultDialog } from '../../../runtime/components/JavaTestResultDialog';
import { JVMParamsEditor } from '../../../runtime/components/JVMParamsEditor';
import { MemorySlider } from '../../../runtime/components/MemorySlider';
import { useJavaRuntimeTestDialog } from '../../../runtime/hooks/useJavaRuntimeTestDialog';

const JAVA_OPTIONS = [
  { label: 'Java 25 (适用于较新版本)', value: '25' },
  { label: 'Java 21 (适用于 MC 1.21+)', value: '21' },
  { label: 'Java 17 (适用于 MC 1.18 - 1.20)', value: '17' },
  { label: 'Java 16 (适用于 MC 1.17)', value: '16' },
  { label: 'Java 8 (适用于 MC 1.7 - 1.16)', value: '8' }
];

const MAJOR_ITEMS = [
  { id: '25', label: 'Java 25', desc: '适用于 1.26+ 与新快照' },
  { id: '8', label: 'Java 8', desc: '适用于 1.16.5 及更早版本' },
  { id: '16', label: 'Java 16', desc: '专门用于 1.17 / 1.17.1' },
  { id: '17', label: 'Java 17', desc: '适用于 1.18 - 1.20.4' },
  { id: '21', label: 'Java 21', desc: '适用于 1.20.5 及更新版本' }
];

export const JavaSettings: React.FC = () => {
  const { settings, updateJavaSetting, triggerJavaAutoDetect } = useSettingsStore();
  const java = settings.java;

  const [isDetecting, setIsDetecting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [javaVersion, setJavaVersion] = useState('21');
  const [javaProvider, setJavaProvider] = useState(downloadSource.sources.java[0]?.id || 'adoptium');

  const { testingKey, dialog, closeDialog, runJavaTest } = useJavaRuntimeTestDialog();

  const providerOptions = useMemo(
    () =>
      downloadSource.sources.java.map((source: any) => ({
        label: source.name,
        value: source.id
      })),
    []
  );

  const focusOrder = useMemo(() => {
    const keys = [
      'settings-java-download-version',
      'settings-java-download-provider',
      'settings-java-btn-download',
      'settings-java-autodetect'
    ];

    if (!java.autoDetect && !isDetecting) {
      keys.push('settings-java-global-btn-browse', 'settings-java-global-btn-test');
      MAJOR_ITEMS.forEach((item) => {
        keys.push(`settings-java-${item.id}-btn-browse`, `settings-java-${item.id}-btn-test`);
      });
    }

    keys.push('java-slider-memory', 'java-btn-recommend', 'java-input-jvm');
    return keys;
  }, [isDetecting, java.autoDetect]);

  const { handleLinearArrow } = useLinearNavigation(focusOrder);

  const runAutoDetect = async (source: 'toggle' | 'download') => {
    setIsDetecting(true);
    try {
      await triggerJavaAutoDetect({ source });
    } finally {
      setIsDetecting(false);
    }
  };

  const handleAutoDetectToggle = async (value: boolean | React.ChangeEvent<HTMLInputElement>) => {
    const nextChecked = typeof value === 'boolean' ? value : !!value.target?.checked;
    updateJavaSetting('autoDetect', nextChecked);

    if (nextChecked) {
      await runAutoDetect('toggle');
    }
  };

  const handleDownloadJava = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await invoke('download_java_env', {
        version: parseInt(javaVersion, 10),
        provider: javaProvider
      });

      if (java.autoDetect) {
        await runAutoDetect('download');
      }
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
            选择需要的 Java 版本和下载源，点击下载后将自动安装到本地
            <code className="bg-black/30 px-1 rounded ml-1">runtime/Java</code> 目录。
          </p>

          <div className="grid grid-cols-12 gap-4 items-end w-full">
            <div className="col-span-12 sm:col-span-5">
              <label className="text-xs text-ore-text-muted mb-1 block truncate">目标 Java 版本</label>
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

            <div className="col-span-12 sm:col-span-4">
              <label className="text-xs text-ore-text-muted mb-1 block truncate">下载源</label>
              <div className="w-full [&>button]:w-full [&>div]:w-full">
                <OreDropdown
                  focusKey="settings-java-download-provider"
                  onArrowPress={handleLinearArrow}
                  options={providerOptions}
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
                {isDownloading ? (
                  <Loader2 size={16} className="animate-spin mr-2" />
                ) : (
                  <Download size={16} className="mr-2" />
                )}
                {isDownloading ? '正在下载...' : '一键下载'}
              </OreButton>
            </div>
          </div>

          {downloadError && <div className="text-red-400 text-sm mt-2">{downloadError}</div>}
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
          description="开启后会在启动器启动时扫描一次并自动回填版本化 Java 路径。"
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
          label="全局 Java 运行时路径（兜底）"
          description="默认 Java 路径。当版本映射关闭或手动设置时可使用。"
          vertical={true}
          control={
            <div className="w-full relative">
              <div className="flex w-full items-stretch gap-2">
                <div className="min-w-0 flex-1">
                  <JavaSelector
                    focusKeyPrefix="settings-java-global"
                    onArrowPress={handleLinearArrow}
                    value={java.autoDetect && !java.javaPath ? '缺少Java环境' : java.javaPath || ''}
                    onChange={(value) => {
                      updateJavaSetting('javaPath', value);
                      if (value) updateJavaSetting('autoDetect', false);
                    }}
                    disabled={java.autoDetect || isDetecting}
                    isError={java.autoDetect && !java.javaPath}
                  />
                </div>

                <OreButton
                  focusKey="settings-java-global-btn-test"
                  onArrowPress={handleLinearArrow}
                  variant="secondary"
                  size="auto"
                  onClick={() => runJavaTest({ key: 'global', label: '全局 Java', javaPath: java.javaPath })}
                  disabled={java.autoDetect || isDetecting || !java.javaPath?.trim() || testingKey !== null}
                  className="shrink-0 !min-w-[7.5rem] !h-10 !px-4 !justify-center gap-1"
                >
                  {testingKey === 'global' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <TestTube2 size={14} />
                  )}
                  测试
                </OreButton>
              </div>

              {java.autoDetect && <div className="absolute inset-0 z-10 cursor-not-allowed" />}
            </div>
          }
        />

        <div className="px-6 py-2">
          <div className="h-[1px] bg-white/5 w-full my-2" />
          <p className="text-xs text-ore-text-muted mb-4 uppercase tracking-wider font-bold">
            版本化全局配置（推荐）
          </p>

          <div className="flex flex-col gap-4">
            {MAJOR_ITEMS.map((item) => {
              const path = java.majorJavaPaths[item.id] || '';
              const testKey = `major-${item.id}`;
              return (
                <div key={item.id} className="flex w-full flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-minecraft">{item.label}</span>
                    <span className="text-[10px] text-ore-text-muted">{item.desc}</span>
                  </div>

                  <div className="flex w-full items-stretch gap-2">
                    <div className="min-w-0 flex-1">
                      <JavaSelector
                        focusKeyPrefix={`settings-java-${item.id}`}
                        onArrowPress={handleLinearArrow}
                        value={java.autoDetect && !path ? '缺少Java环境' : path}
                        onChange={(value) => {
                          const newPaths = { ...java.majorJavaPaths, [item.id]: value };
                          updateJavaSetting('majorJavaPaths', newPaths);
                          if (value) updateJavaSetting('autoDetect', false);
                        }}
                        disabled={java.autoDetect || isDetecting}
                        isError={java.autoDetect && !path}
                      />
                    </div>

                    <OreButton
                      focusKey={`settings-java-${item.id}-btn-test`}
                      onArrowPress={handleLinearArrow}
                      variant="secondary"
                      size="auto"
                      onClick={() => runJavaTest({ key: testKey, label: item.label, javaPath: path })}
                      disabled={java.autoDetect || isDetecting || !path.trim() || testingKey !== null}
                      className="shrink-0 !min-w-[7.5rem] !h-10 !px-4 !justify-center gap-1"
                    >
                      {testingKey === testKey ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <TestTube2 size={14} />
                      )}
                      测试
                    </OreButton>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="全局内存与参数" icon={<Cpu size={18} />}>
        <div className="px-6 py-4 bg-[#141415]/50">
          <p className="font-minecraft text-sm text-ore-text-muted leading-relaxed">
            默认情况下新建实例会继承这里的内存与参数配置；若实例开启了独立配置，则以实例设置为准。
          </p>
        </div>

        <FormRow
          label="全局最大内存分配"
          description="动态调整游戏可用的最大 RAM。"
          control={
            <MemorySlider
              onArrowPress={handleLinearArrow}
              maxMemory={java.maxMemory}
              onChange={(value) => updateJavaSetting('maxMemory', value)}
              disabled={false}
            />
          }
        />

        <FormRow
          label="全局 JVM 附加参数"
          description="高级选项。会应用到继承全局设置的实例。"
          vertical={true}
          control={
            <div className="w-full">
              <JVMParamsEditor
                onArrowPress={handleLinearArrow}
                value={java.jvmArgs}
                onChange={(value) => updateJavaSetting('jvmArgs', value)}
                disabled={false}
              />
            </div>
          }
        />
      </SettingsSection>

      <JavaTestResultDialog
        state={dialog}
        onClose={closeDialog}
        focusKeyPrefix="settings-java-test-dialog"
      />
    </SettingsPageLayout>
  );
};
