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
      <SettingsSection title="组件下载源" icon={<Globe size={18} />}>
        <FormRow
          label="Minecraft 版本元数据源"
          description="用于获取 version_manifest_v2 版本列表。"
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
              label={category.label}
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
            label="动态测速与自动切换"
            description="下载前自动检查可用节点延迟，并优先选择低延迟节点。"
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

      <SettingsSection title="速度与并发" icon={<Zap size={18} />}>
        <FormRow
          label="速度显示单位"
          description="MB/s 与 Mbps 两种显示模式。"
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
          label="最大并发任务数"
          description="并发越高速度可能越快，但也会增加网络和系统压力。"
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
            label="单文件分块下载"
            description="对支持 Range 的大文件启用多连接下载，提升单文件速度，不影响文件并发数。"
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
            label="分块线程数"
            description="单个文件同时建立的下载连接数量。"
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
            label="分块阈值"
            description="仅对达到该大小的文件启用分块下载，单位 MB。"
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

      <SettingsSection title="容错与校验" icon={<ShieldCheck size={18} />}>
        <FormRow
          label="连接超时"
          description="超过该时间未收到服务器响应时自动中断并重试。"
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
          label="失败重试次数"
          description="单个文件下载失败后的自动重试次数。"
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
          label="下载后校验 (Hash)"
          description="下载完成后执行完整性校验，确保文件未损坏。"
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

      <SettingsSection title="代理服务器" icon={<Network size={18} />}>
        <FormRow
          label="代理模式"
          description="仅影响下载与 API 请求，不影响游戏联机。"
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
              label="主机地址 (Host)"
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
              label="端口 (Port)"
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
