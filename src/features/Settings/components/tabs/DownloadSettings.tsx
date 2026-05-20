import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Network, ShieldCheck, Zap } from 'lucide-react';

import { FormRow } from '../../../../ui/layout/FormRow';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreSlider } from '../../../../ui/primitives/OreSlider';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreToggleButton } from '../../../../ui/primitives/OreToggleButton';

import { DownloadNetworkDiagnosticsSection } from './download/DownloadNetworkDiagnosticsSection';
import { useDownloadBenchmarkController } from './download/useDownloadBenchmarkController';
import { useDownloadSettingsController } from './download/useDownloadSettingsController';
import { useNetworkDiagnosticsController } from './download/useNetworkDiagnosticsController';

export const DownloadSettings: React.FC = () => {
  const { t } = useTranslation();
  const networkDiagnostics = useNetworkDiagnosticsController();
  const downloadBenchmark = useDownloadBenchmarkController();
  const {
    download,
    minecraftMetaSource,
    sourceCategories,
    proxyOptions,
    updateDownloadSetting,
    handleLinearArrow
  } = useDownloadSettingsController([
    ...networkDiagnostics.focusKeys,
    ...downloadBenchmark.focusKeys
  ]);

  return (
    <SettingsPageLayout adaptiveScale>
      <SettingsSection title={t('settings.download.sections.source')} icon={<Globe size={18} />}>
        <FormRow
          label={t('settings.download.metaSource')}
          description={t('settings.download.metaSourceDesc')}
          className="!lg:items-center"
          control={
            <div className="w-[320px]">
              <OreToggleButton
                focusKeyPrefix="settings-download-minecraft-meta-source"
                onArrowPress={handleLinearArrow}
                options={[
                  {
                    label: <span className="font-minecraft tracking-wider">BMCLAPI</span>,
                    value: 'bangbang93'
                  },
                  {
                    label: <span className="font-minecraft tracking-wider">Official</span>,
                    value: 'official'
                  }
                ]}
                value={minecraftMetaSource}
                onChange={(value) => updateDownloadSetting('minecraftMetaSource', value as any)}
                size="sm"
              />
            </div>
          }
        />

        {sourceCategories.map((category) => {
          const sourceKey = `${category.key}Source` as keyof typeof download;
          const urlKey = `${category.key}SourceUrl` as keyof typeof download;
          const sourceIds = category.data.map((source) => source.id);
          const rawSourceValue = (download as any)[sourceKey] as string;
          const currentSourceValue = sourceIds.includes(rawSourceValue)
            ? rawSourceValue
            : (sourceIds[0] ?? '');

          return (
            <FormRow
              key={category.key}
              label={t(`settings.download.sources.${category.key}`)}
              className="!lg:items-center"
              control={
                <div className="w-[320px]">
                  <OreToggleButton
                    focusKeyPrefix={`settings-download-source-${category.key}`}
                    onArrowPress={handleLinearArrow}
                    options={category.data.map((source) => ({
                      label: (
                        <span className="font-minecraft tracking-wider">{source.name}</span>
                      ),
                      value: source.id
                    }))}
                    value={currentSourceValue}
                    onChange={(value) => {
                      const target = category.data.find((source) => source.id === value);
                      if (!target) {
                        return;
                      }

                      updateDownloadSetting(sourceKey, value as any);
                      updateDownloadSetting(urlKey, target.url as any);
                    }}
                    size="sm"
                  />
                </div>
              }
            />
          );
        })}

        <div className="mt-4 border-t border-white/5 pt-4">
          <FormRow
            label={t('settings.download.autoLatency')}
            description={t('settings.download.autoLatencyDesc')}
            control={
              <OreSwitch
                focusKey="settings-download-auto-latency"
                onArrowPress={handleLinearArrow}
                checked={download.autoCheckLatency}
                onChange={(value) => updateDownloadSetting('autoCheckLatency', value)}
              />
            }
          />
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.download.sections.speed')} icon={<Zap size={18} />}>
        <FormRow
          label={t('settings.download.speedUnit')}
          description={t('settings.download.speedUnitDesc')}
          className="!lg:items-center"
          control={
            <div className="w-[320px]">
              <OreToggleButton
                focusKeyPrefix="settings-download-speed-unit"
                onArrowPress={handleLinearArrow}
                options={[
                  { label: <span className="font-minecraft tracking-wider">MB/s</span>, value: 'MB/s' },
                  { label: <span className="font-minecraft tracking-wider">Mbps</span>, value: 'Mbps' }
                ]}
                value={download.speedUnit}
                onChange={(value) => updateDownloadSetting('speedUnit', value as any)}
                size="sm"
              />
            </div>
          }
        />

        <FormRow
          label={t('settings.download.speedLimit')}
          description={t('settings.download.speedLimitDesc')}
          control={
            <div className="flex items-center space-x-2">
              <OreInput
                focusKey="settings-download-speed-limit"
                onArrowPress={handleLinearArrow}
                type="number"
                value={download.speedLimit}
                onChange={(event) =>
                  updateDownloadSetting('speedLimit', Number(event.target.value))
                }
                className="w-24 text-center font-bold text-ore-green"
                min={0}
              />
              <span className="font-minecraft text-sm text-ore-text-muted">MB/s</span>
            </div>
          }
        />

        <FormRow
          label={t('settings.download.concurrency')}
          description={t('settings.download.concurrencyDesc')}
          className="!lg:items-center"
          control={
            <div className="flex w-[320px] items-center gap-3">
              <OreSlider
                className="flex-1"
                focusKey="settings-download-concurrency"
                onArrowPress={handleLinearArrow}
                value={download.concurrency}
                min={1}
                max={8}
                step={1}
                onChange={(value) => updateDownloadSetting('concurrency', value)}
              />
              <span className="min-w-[68px] text-right font-minecraft text-sm font-bold text-ore-green">
                {download.concurrency}
              </span>
            </div>
          }
        />

        <div className="mt-4 border-t border-white/5 pt-4">
          <FormRow
            label={t('settings.download.chunkedEnable')}
            description={t('settings.download.chunkedEnableDesc')}
            control={
              <OreSwitch
                focusKey="settings-download-chunked-enable"
                onArrowPress={handleLinearArrow}
                checked={download.chunkedDownloadEnabled}
                onChange={(value) => updateDownloadSetting('chunkedDownloadEnabled', value)}
              />
            }
          />

          <FormRow
            label={t('settings.download.chunkedThreads')}
            description={t('settings.download.chunkedThreadsDesc')}
            className="!lg:items-center"
            control={
              <div className="flex w-[320px] items-center gap-3">
                <OreSlider
                  className="flex-1"
                  focusKey="settings-download-chunked-threads"
                  onArrowPress={handleLinearArrow}
                  value={download.chunkedDownloadThreads}
                  min={2}
                  max={8}
                  step={1}
                  disabled={!download.chunkedDownloadEnabled}
                  onChange={(value) =>
                    updateDownloadSetting('chunkedDownloadThreads', value)
                  }
                />
                <span className="min-w-[68px] text-right font-minecraft text-sm font-bold text-ore-green">
                  {download.chunkedDownloadThreads}
                </span>
              </div>
            }
          />

          <FormRow
            label={t('settings.download.chunkedThreshold')}
            description={t('settings.download.chunkedThresholdDesc')}
            control={
              <div className="flex items-center space-x-2">
                <OreInput
                  focusKey="settings-download-chunked-threshold"
                  onArrowPress={handleLinearArrow}
                  type="number"
                  value={download.chunkedDownloadMinSizeMb}
                  onChange={(event) =>
                    updateDownloadSetting(
                      'chunkedDownloadMinSizeMb',
                      Math.max(1, Number(event.target.value) || 1)
                    )
                  }
                  className="w-24 text-center font-bold text-ore-green"
                  min={1}
                  max={1024}
                />
                <span className="font-minecraft text-sm text-ore-text-muted">MB</span>
              </div>
            }
          />
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.download.sections.faultTolerance')} icon={<ShieldCheck size={18} />}>
        <FormRow
          label={t('settings.download.timeout')}
          description={t('settings.download.timeoutDesc')}
          control={
            <div className="flex items-center space-x-2">
              <OreInput
                focusKey="settings-download-timeout"
                onArrowPress={handleLinearArrow}
                type="number"
                value={download.timeout}
                onChange={(event) =>
                  updateDownloadSetting('timeout', Number(event.target.value))
                }
                className="w-20 text-center"
                min={5}
                max={120}
              />
              <span className="font-minecraft text-sm text-ore-text-muted">秒</span>
            </div>
          }
        />

        <FormRow
          label={t('settings.download.retry')}
          description={t('settings.download.retryDesc')}
          className="!lg:items-center"
          control={
            <div className="flex w-[320px] items-center gap-3">
              <OreSlider
                className="flex-1"
                focusKey="settings-download-retry"
                onArrowPress={handleLinearArrow}
                value={download.retryCount}
                min={0}
                max={10}
                step={1}
                onChange={(value) => updateDownloadSetting('retryCount', value)}
              />
              <span className="min-w-[68px] text-right font-minecraft text-sm font-bold text-ore-green">
                {download.retryCount}
              </span>
            </div>
          }
        />

        <FormRow
          label={t('settings.download.verifyHash')}
          description={t('settings.download.verifyHashDesc')}
          control={
            <OreSwitch
              focusKey="settings-download-verify-hash"
              onArrowPress={handleLinearArrow}
              checked={download.verifyAfterDownload}
              onChange={(value) => updateDownloadSetting('verifyAfterDownload', value)}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title={t('settings.download.sections.proxy')} icon={<Network size={18} />}>
        <FormRow
          label={t('settings.download.proxyMode')}
          description={t('settings.download.proxyModeDesc')}
          className="!lg:items-center"
          control={
            <div className="w-[420px]">
              <OreToggleButton
                focusKeyPrefix="settings-download-proxy-type"
                onArrowPress={handleLinearArrow}
                options={proxyOptions.map((option) => ({
                  label: (
                    <span className="whitespace-normal text-center font-minecraft leading-tight tracking-wider">
                      {option.label}
                    </span>
                  ),
                  value: option.value
                }))}
                value={download.proxyType}
                onChange={(value) => updateDownloadSetting('proxyType', value as any)}
                size="sm"
                className="[&>.ore-toggle-btn-item]:!h-[40px]"
                buttonClassName="!whitespace-normal !leading-tight"
              />
            </div>
          }
        />

        {download.proxyType !== 'none' && (
          <div className="divide-y-2 divide-[#1E1E1F] bg-[#141415]/30">
            <FormRow
              label={t('settings.download.proxyHost')}
              control={
                <OreInput
                  focusKey="settings-download-proxy-host"
                  onArrowPress={handleLinearArrow}
                  value={download.proxyHost}
                  onChange={(event) =>
                    updateDownloadSetting('proxyHost', event.target.value)
                  }
                  placeholder="127.0.0.1"
                  className="w-48"
                />
              }
            />

            <FormRow
              label={t('settings.download.proxyPort')}
              control={
                <OreInput
                  focusKey="settings-download-proxy-port"
                  onArrowPress={handleLinearArrow}
                  value={download.proxyPort}
                  onChange={(event) =>
                    updateDownloadSetting('proxyPort', event.target.value)
                  }
                  placeholder="7890"
                  className="w-24 text-center"
                />
              }
            />
          </div>
        )}
      </SettingsSection>

      <DownloadNetworkDiagnosticsSection
        report={networkDiagnostics.report}
        testing={networkDiagnostics.testing}
        downloadBenchmarkReport={downloadBenchmark.report}
        downloadBenchmarkTesting={downloadBenchmark.testing}
        onArrowPress={handleLinearArrow}
        onRunNetworkTest={networkDiagnostics.runNetworkTest}
        onRunDownloadBenchmark={downloadBenchmark.runDownloadBenchmark}
      />
    </SettingsPageLayout>
  );
};
