// src/features/Settings/components/tabs/DownloadSettings.tsx
import React, { useCallback, useMemo } from 'react';
import { Globe, Zap, ShieldCheck, Network, AlertTriangle } from 'lucide-react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreSlider } from '../../../../ui/primitives/OreSlider';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreToggleButton } from '../../../../ui/primitives/OreToggleButton';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';

import { useSettingsStore } from '../../../../store/useSettingsStore';
import { DEFAULT_SETTINGS } from '../../../../types/settings';
import downloadConfig from '../../../../assets/config/downloadsource.json';

type SourceCategoryKey = 'vanilla' | 'forge' | 'fabric' | 'neoforge';

export const DownloadSettings: React.FC = () => {
  const { settings, updateDownloadSetting } = useSettingsStore();
  const download = settings.download || DEFAULT_SETTINGS.download;

  const sourceCategories = useMemo(() => [
    { key: 'vanilla' as SourceCategoryKey, label: '原版核心下载源', data: downloadConfig.sources.vanilla },
    { key: 'forge' as SourceCategoryKey, label: 'Forge 下载源', data: downloadConfig.sources.forge },
    { key: 'fabric' as SourceCategoryKey, label: 'Fabric 下载源', data: downloadConfig.sources.fabric },
    { key: 'neoforge' as SourceCategoryKey, label: 'NeoForge 下载源', data: downloadConfig.sources.neoforge }
  ], []);

  const proxyOptions = useMemo(() => [
    { label: '直连 (不使用代理)', value: 'none' },
    { label: 'HTTP 代理', value: 'http' },
    { label: 'HTTPS 代理', value: 'https' },
    { label: 'SOCKS5 代理', value: 'socks5' }
  ], []);

  // 严格线性焦点序：只包含“当前可见”控件，避免跳入隐藏控件黑洞
  const focusOrder = useMemo(() => {
    const keys: string[] = [];

    sourceCategories.forEach(({ key }) => {
      const sourceValue = (download as any)[`${key}Source`] || 'official';
      keys.push(`settings-download-source-${key}`);
      if (sourceValue === 'custom') {
        keys.push(`settings-download-url-${key}`);
      }
    });

    keys.push(
      'settings-download-auto-latency',
      'settings-download-speed-unit-0',
      'settings-download-speed-unit-1',
      'settings-download-speed-limit',
      'settings-download-concurrency',
      'settings-download-timeout',
      'settings-download-retry',
      'settings-download-verify-hash',
      'settings-download-proxy-type'
    );

    if (download.proxyType !== 'none') {
      keys.push('settings-download-proxy-host', 'settings-download-proxy-port');
    }

    return keys;
  }, [sourceCategories, download]);

  const handleLinearArrow = useCallback((direction: string) => {
    if (direction !== 'up' && direction !== 'down') return true;

    const availableKeys = focusOrder.filter((k) => doesFocusableExist(k));
    if (availableKeys.length === 0) return true;

    const currentKey = getCurrentFocusKey();
    const index = availableKeys.indexOf(currentKey);

    if (index < 0) {
      setFocus(availableKeys[0]);
      return false;
    }

    const nextIndex = direction === 'down'
      ? Math.min(availableKeys.length - 1, index + 1)
      : Math.max(0, index - 1);

    if (nextIndex !== index) {
      setFocus(availableKeys[nextIndex]);
    }

    return false;
  }, [focusOrder]);

  return (
    <SettingsPageLayout title="下载与网络" subtitle="Download & Network Configurations">
      <SettingsSection title="组件下载源" icon={<Globe size={18} />}>
        {sourceCategories.map((category) => {
          const sourceKey = `${category.key}Source` as keyof typeof download;
          const urlKey = `${category.key}SourceUrl` as keyof typeof download;

          const options = category.data.map((s) => ({ label: s.name, value: s.id }));
          options.push({ label: '自定义源 (Custom)', value: 'custom' });

          const currentSourceValue = (download as any)[sourceKey] || 'official';
          const currentUrlValue = (download as any)[urlKey] || '';

          return (
            <React.Fragment key={category.key}>
              <FormRow
                label={category.label}
                control={
                  <OreDropdown
                    options={options}
                    value={currentSourceValue}
                    focusKey={`settings-download-source-${category.key}`}
                    onArrowPress={handleLinearArrow}
                    onChange={(val) => {
                      if (val === 'custom') {
                        const ok = window.confirm(
                          `⚠️ 警告：\n\n您正在修改 [${category.label}]。\n使用未知的自定义源可能导致下载到被篡改的文件。\n\n请确认您了解风险。`
                        );
                        if (!ok) return;
                        updateDownloadSetting(sourceKey, val as any);
                        updateDownloadSetting(urlKey, '' as any);
                        return;
                      }

                      const target = category.data.find((s) => s.id === val);
                      if (target) updateDownloadSetting(urlKey, target.url as any);
                      updateDownloadSetting(sourceKey, val as any);
                    }}
                    className="w-56"
                  />
                }
              />

              {currentSourceValue === 'custom' && (
                <div className="mb-2">
                  <div className="bg-red-500/10 border-l-4 border-red-500 p-3 mb-2 rounded-r-sm flex items-start">
                    <AlertTriangle size={16} className="text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="text-red-400 font-minecraft text-sm font-bold mb-1">危险操作提示</h4>
                      <p className="text-red-400/80 text-xs">
                        您正在使用不受支持的自定义 API，请确保地址可信且使用 HTTPS。
                      </p>
                    </div>
                  </div>

                  <FormRow
                    label={`${category.key.toUpperCase()} API 地址`}
                    control={
                      <OreInput
                        focusKey={`settings-download-url-${category.key}`}
                        onArrowPress={handleLinearArrow}
                        value={currentUrlValue}
                        onChange={(e) => updateDownloadSetting(urlKey, e.target.value as any)}
                        placeholder={`https://your-${category.key}-mirror.com`}
                        className="w-64 font-mono text-xs"
                      />
                    }
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}

        <div className="mt-4 pt-4 border-t border-white/5">
          <FormRow
            label="动态测速与自动切换"
            description="下载前自动对可用节点进行延迟检测，并优先选择低延迟节点。"
            control={
              <OreSwitch
                focusKey="settings-download-auto-latency"
                onArrowPress={handleLinearArrow}
                checked={download.autoCheckLatency}
                onChange={(v) => updateDownloadSetting('autoCheckLatency', v)}
              />
            }
          />
        </div>
      </SettingsSection>

      <SettingsSection title="速度与并发" icon={<Zap size={18} />}>
        <FormRow
          label="速度显示单位"
          description="MB/s 与 Mbps 两种展示模式。"
          vertical={true}
          control={
            <div className="w-full max-w-sm mt-2">
              <OreToggleButton
                focusKeyPrefix="settings-download-speed-unit"
                onArrowPress={handleLinearArrow}
                options={[
                  { label: <span className="font-minecraft tracking-wider">MB/s</span>, value: 'MB/s' },
                  { label: <span className="font-minecraft tracking-wider">Mbps</span>, value: 'Mbps' }
                ]}
                value={download.speedUnit}
                onChange={(v) => updateDownloadSetting('speedUnit', v as any)}
                size="sm"
              />
            </div>
          }
        />

        <FormRow
          label="全局下载限速"
          description="设置为 0 表示不限速。"
          control={
            <div className="flex items-center space-x-2">
              <OreInput
                focusKey="settings-download-speed-limit"
                onArrowPress={handleLinearArrow}
                type="number"
                value={download.speedLimit}
                onChange={(e) => updateDownloadSetting('speedLimit', Number(e.target.value))}
                className="w-24 text-center font-bold text-ore-green"
                min={0}
              />
              <span className="text-ore-text-muted font-minecraft text-sm">MB/s</span>
            </div>
          }
        />

        <FormRow
          label="最大并发任务数"
          description="并发越高速度可能越快，但也会增加网络和系统压力。"
          vertical={true}
          control={
            <div className="w-full flex flex-col">
              <div className="flex justify-end font-minecraft text-sm mb-2">
                <span className="text-ore-green font-bold">{download.concurrency} 线程</span>
              </div>
              <OreSlider
                focusKey="settings-download-concurrency"
                onArrowPress={handleLinearArrow}
                value={download.concurrency}
                min={1}
                max={128}
                step={1}
                onChange={(v) => updateDownloadSetting('concurrency', v)}
              />
            </div>
          }
        />
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
                onChange={(e) => updateDownloadSetting('timeout', Number(e.target.value))}
                className="w-20 text-center"
                min={5}
                max={120}
              />
              <span className="text-ore-text-muted font-minecraft text-sm">秒</span>
            </div>
          }
        />

        <FormRow
          label="失败重试次数"
          description="单文件下载失败后的自动重试次数。"
          vertical={true}
          control={
            <div className="w-full max-w-sm flex flex-col">
              <div className="flex justify-end font-minecraft text-sm mb-2">
                <span className="text-ore-green font-bold">{download.retryCount} 次</span>
              </div>
              <OreSlider
                focusKey="settings-download-retry"
                onArrowPress={handleLinearArrow}
                value={download.retryCount}
                min={0}
                max={10}
                step={1}
                onChange={(v) => updateDownloadSetting('retryCount', v)}
              />
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
              onChange={(v) => updateDownloadSetting('verifyAfterDownload', v)}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="代理服务器" icon={<Network size={18} />}>
        <FormRow
          label="代理模式"
          description="仅影响下载与 API 请求，不影响游戏联机。"
          control={
            <OreDropdown
              focusKey="settings-download-proxy-type"
              onArrowPress={handleLinearArrow}
              options={proxyOptions}
              value={download.proxyType}
              onChange={(val) => updateDownloadSetting('proxyType', val as any)}
              className="w-48"
            />
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
                  onChange={(e) => updateDownloadSetting('proxyHost', e.target.value)}
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
                  onChange={(e) => updateDownloadSetting('proxyPort', e.target.value)}
                  placeholder="7890"
                  className="w-24 text-center"
                />
              }
            />
          </div>
        )}
      </SettingsSection>
    </SettingsPageLayout>
  );
};
