import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Coffee, Cpu, Download, Loader2, RotateCcw, TestTube2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

import downloadSource from '../../../../assets/config/downloadsource.json';
import { DEFAULT_SETTINGS } from '../../../../types/settings';
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

const JAVA_VERSIONS = ['25', '21', '17', '16', '8'] as const;
const MAJOR_ITEM_IDS = ['25', '8', '16', '17', '21'] as const;

export const JavaSettings: React.FC = () => {
  const { t } = useTranslation();
  const { settings, updateJavaSetting, triggerJavaAutoDetect } = useSettingsStore();
  const java = settings.java;

  const [isDetecting, setIsDetecting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [javaVersion, setJavaVersion] = useState('21');
  const [javaProvider, setJavaProvider] = useState(downloadSource.sources.java[0]?.id || 'adoptium');

  const { testingKey, dialog, closeDialog, runJavaTest } = useJavaRuntimeTestDialog();

  const handleGlobalMemoryChange = (nextValue: {
    memoryAllocationMode: typeof java.memoryAllocationMode;
    maxMemory: number;
    minMemory: number;
  }) => {
    if (java.memoryAllocationMode !== nextValue.memoryAllocationMode) {
      updateJavaSetting('memoryAllocationMode', nextValue.memoryAllocationMode);
    }
    if (java.maxMemory !== nextValue.maxMemory) {
      updateJavaSetting('maxMemory', nextValue.maxMemory);
    }
    if (java.minMemory !== nextValue.minMemory) {
      updateJavaSetting('minMemory', nextValue.minMemory);
    }
  };

  const javaOptions = useMemo(
    () =>
      JAVA_VERSIONS.map((version) => ({
        label: t(`settings.java.versions.${version}`),
        value: version
      })),
    [t]
  );

  const majorItems = useMemo(
    () =>
      MAJOR_ITEM_IDS.map((id) => ({
        id,
        label: `Java ${id}`,
        desc: t(`settings.java.majorDescriptions.${id}`)
      })),
    [t]
  );

  const providerOptions = useMemo(
    () =>
      downloadSource.sources.java.map((source: any) => ({
        label: t(`settings.java.providers.${source.id}`, { defaultValue: source.name }),
        value: source.id
      })),
    [t]
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
      majorItems.forEach((item) => {
        keys.push(`settings-java-${item.id}-btn-browse`, `settings-java-${item.id}-btn-test`);
      });
    }

    keys.push('java-memory-mode', 'java-slider-memory', 'java-btn-recommend', 'java-input-jvm', 'java-btn-reset-jvm');
    return keys;
  }, [isDetecting, java.autoDetect, majorItems]);

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
      <SettingsSection title={t('settings.java.sections.autoDownload')} icon={<Download size={18} />}>
        <div className="px-6 py-4 bg-[#141415]/50 flex flex-col gap-4">
          <p className="font-minecraft text-sm text-ore-text-muted leading-relaxed" dangerouslySetInnerHTML={{ __html: t('settings.java.autoDownloadDesc') }} />

          <div className="grid grid-cols-12 gap-4 items-end w-full">
            <div className="col-span-12 sm:col-span-5">
              <label className="text-xs text-ore-text-muted mb-1 block truncate">{t('settings.java.targetVersion')}</label>
              <div className="w-full [&>button]:w-full [&>div]:w-full">
                <OreDropdown
                  focusKey="settings-java-download-version"
                  onArrowPress={handleLinearArrow}
                  options={javaOptions}
                  value={javaVersion}
                  onChange={setJavaVersion}
                  disabled={isDownloading}
                />
              </div>
            </div>

            <div className="col-span-12 sm:col-span-4">
              <label className="text-xs text-ore-text-muted mb-1 block truncate">{t('settings.java.provider')}</label>
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
                size="auto"
                className="w-full !min-w-0 !h-10 !px-3 !justify-center gap-1 whitespace-nowrap overflow-hidden"
              >
                {isDownloading ? (
                  <Loader2 size={16} className="animate-spin shrink-0" />
                ) : (
                  <Download size={16} className="shrink-0" />
                )}
                <span className="truncate">
                  {isDownloading ? t('settings.java.downloading') : t('settings.java.btnDownload')}
                </span>
              </OreButton>
            </div>
          </div>

          {downloadError && <div className="text-red-400 text-sm mt-2">{downloadError}</div>}
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.java.sections.environment')} icon={<Coffee size={18} />}>
        <FormRow
          label={
            <div className="flex items-center gap-2">
              {t('settings.java.autoDetect')}
              {isDetecting && <Loader2 size={14} className="animate-spin text-ore-green" />}
            </div>
          }
          description={t('settings.java.autoDetectDesc')}
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
          label={t('settings.java.globalPath')}
          description={t('settings.java.globalPathDesc')}
          vertical={true}
          control={
            <div className="w-full relative">
              <div className="flex w-full items-stretch gap-2">
                <div className="min-w-0 flex-1">
                  <JavaSelector
                    focusKeyPrefix="settings-java-global"
                    onArrowPress={handleLinearArrow}
                    value={java.autoDetect && !java.javaPath ? t('settings.java.missingAuth') : java.javaPath || ''}
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
                  onClick={() =>
                    runJavaTest({
                      key: 'global',
                      label: t('settings.java.testTargets.global'),
                      javaPath: java.javaPath
                    })
                  }
                  disabled={java.autoDetect || isDetecting || !java.javaPath?.trim() || testingKey !== null}
                  className="shrink-0 !min-w-[7.5rem] !h-10 !px-4 !justify-center gap-1 whitespace-nowrap"
                >
                  {testingKey === 'global' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <TestTube2 size={14} />
                  )}
                  {t('settings.java.btnTest')}
                </OreButton>
              </div>

              {java.autoDetect && <div className="absolute inset-0 z-10 cursor-not-allowed" />}
            </div>
          }
        />

        <div className="px-6 py-2">
          <div className="h-[1px] bg-white/5 w-full my-2" />
          <p className="text-xs text-ore-text-muted mb-4 uppercase tracking-wider font-bold">
            {t('settings.java.majorConfig')}
          </p>

          <div className="flex flex-col gap-4">
            {majorItems.map((item) => {
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
                        value={java.autoDetect && !path ? t('settings.java.missingAuth') : path}
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
                      className="shrink-0 !min-w-[7.5rem] !h-10 !px-4 !justify-center gap-1 whitespace-nowrap"
                    >
                      {testingKey === testKey ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <TestTube2 size={14} />
                      )}
                      {t('settings.java.btnTest')}
                    </OreButton>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.java.sections.memory')} icon={<Cpu size={18} />}>
        <div className="px-6 py-4 bg-[#141415]/50">
          <p className="font-minecraft text-sm text-ore-text-muted leading-relaxed">
            {t('settings.java.memoryDesc')}
          </p>
        </div>

        <FormRow
          label={t('settings.java.maxMemory')}
          description={t('settings.java.maxMemoryDesc')}
          controlClassName="w-full lg:w-[36rem]"
          control={
            <MemorySlider
              onArrowPress={handleLinearArrow}
              value={{
                memoryAllocationMode: java.memoryAllocationMode,
                maxMemory: java.maxMemory,
                minMemory: java.minMemory,
              }}
              onChange={handleGlobalMemoryChange}
              disabled={false}
            />
          }
        />

        <FormRow
          label={t('settings.java.jvmArgs')}
          description={t('settings.java.jvmArgsDesc')}
          vertical
          control={
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 w-full flex-1">
                <JVMParamsEditor
                  onArrowPress={handleLinearArrow}
                  value={java.jvmArgs}
                  onChange={(value) => updateJavaSetting('jvmArgs', value)}
                  disabled={false}
                />
              </div>
              <OreButton
                focusKey="java-btn-reset-jvm"
                onArrowPress={handleLinearArrow}
                size="auto"
                variant="secondary"
                onClick={() => updateJavaSetting('jvmArgs', DEFAULT_SETTINGS.java.jvmArgs)}
                disabled={java.jvmArgs === DEFAULT_SETTINGS.java.jvmArgs}
                className="shrink-0 !min-w-[7.5rem] !h-10 !px-4 !justify-center gap-1 whitespace-nowrap"
              >
                <RotateCcw size={15} className="mr-1.5" />
                {t('settings.java.jvmArgsResetDefault')}
              </OreButton>
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
