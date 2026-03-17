// src/features/Settings/components/tabs/DownloadSettings.tsx
import React, { useCallback, useMemo } from 'react';
import { Globe, Zap, ShieldCheck, Network, AlertTriangle, Activity, RefreshCw, CheckCircle2, XCircle, Info, Cpu, Monitor, Wifi } from 'lucide-react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreSlider } from '../../../../ui/primitives/OreSlider';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreToggleButton } from '../../../../ui/primitives/OreToggleButton';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { FocusItem } from '../../../../ui/focus/FocusItem';

import { useSettingsStore } from '../../../../store/useSettingsStore';
import { DEFAULT_SETTINGS } from '../../../../types/settings';
import downloadConfig from '../../../../assets/config/downloadsource.json';

type SourceCategoryKey = 'vanilla' | 'forge' | 'fabric' | 'neoforge';

interface DomainTestResult {
  domain: string;
  dns: boolean;
  dns_info: string;
  tcp: boolean;
  tls: boolean;
  http: boolean;
  latency: number;
}

interface SystemInfo {
  os: string;
  arch: string;
  cpu: string;
  memory: string;
}

interface NetworkInfo {
  local_ip: string;
  dns_servers: string[];
}

interface NetworkTestReport {
  domains: DomainTestResult[];
  system: SystemInfo;
  network: NetworkInfo;
  timestamp: string;
  qrcode_uri?: string;
}

export const DownloadSettings: React.FC = () => {
  const { settings, updateDownloadSetting } = useSettingsStore();
  const [report, setReport] = React.useState<NetworkTestReport | null>(null);
  const [testing, setTesting] = React.useState(false);
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

    keys.push('settings-download-run-diagnostics');

    if (report) {
      report.domains.forEach((d) => {
        keys.push(`settings-download-diagnostic-result-${d.domain}`);
      });
      if (report.qrcode_uri) {
        keys.push('settings-download-diagnostic-qr');
      }
    }

    return keys;
  }, [sourceCategories, download, report]);

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

  const runNetworkTest = async () => {
    setTesting(true);
    setReport(null);
    try {
      const res = await invoke<NetworkTestReport>('run_network_test');
      setReport(res);
    } catch (err) {
      console.error('Network test failed:', err);
      alert('网络测试失败，请检查网络连接后重试。');
    } finally {
      setTesting(false);
    }
  };

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

      <SettingsSection title="网络诊断与测试" icon={<Activity size={18} />}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-white font-minecraft text-base mb-1">网络可用性检测</h4>
              <p className="text-ore-text-muted text-xs">
                测试启动器所需核心域名的连接质量，包括 DNS、TCP、TLS 与 HTTP 层级。
              </p>
            </div>
            <OreButton
              focusKey="settings-download-run-diagnostics"
              onArrowPress={handleLinearArrow}
              onClick={runNetworkTest}
              disabled={testing}
              variant="primary"
              className="px-6"
            >
              {testing ? (
                <div className="flex items-center">
                  <RefreshCw size={14} className="mr-2 animate-spin" />
                  正在测试...
                </div>
              ) : '开始全面诊断'}
            </OreButton>
          </div>

          <AnimatePresence mode="wait">
            {report ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* 域名测试结果列表 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {report.domains.map((d) => (
                    <FocusItem
                      key={d.domain}
                      focusKey={`settings-download-diagnostic-result-${d.domain}`}
                      onArrowPress={handleLinearArrow}
                    >
                      {({ ref, focused }) => (
                        <div 
                          ref={ref}
                          className={`bg-black/20 border rounded-lg p-4 flex flex-col justify-between hover:bg-black/30 transition-colors ${
                            focused ? 'border-ore-green shadow-[0_0_10px_rgba(56,133,39,0.3)]' : 'border-white/5'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex flex-col">
                              <span className="text-white font-mono text-sm truncate max-w-[200px]" title={d.domain}>
                                {d.domain}
                              </span>
                              <span className="text-[10px] text-ore-text-muted mt-0.5">{d.dns_info}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                d.latency < 100 ? 'bg-green-500/20 text-green-400' : 
                                d.latency < 300 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                              }`}>
                                {d.latency}ms
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-auto">
                            <div className="flex space-x-3">
                              <StatusBadge label="DNS" success={d.dns} />
                              <StatusBadge label="TCP" success={d.tcp} />
                              <StatusBadge label="TLS" success={d.tls} />
                              <StatusBadge label="HTTP" success={d.http} />
                            </div>
                          </div>
                        </div>
                      )}
                    </FocusItem>
                  ))}
                </div>

                {/* 系统信息与二维码 */}
                <div className="flex flex-col lg:flex-row gap-6 border-t border-white/5 pt-6">
                  <div className="flex-1 space-y-4">
                    <h5 className="text-white font-minecraft text-sm flex items-center">
                      <Info size={14} className="mr-2 text-ore-green" /> 系统与网络状态
                    </h5>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoItem icon={<Monitor size={14} />} label="操作系统" value={report.system.os} />
                      <InfoItem icon={<Cpu size={14} />} label="处理器架构" value={report.system.arch} />
                      <InfoItem icon={<Wifi size={14} />} label="本地 IP" value={report.network.local_ip} />
                      <InfoItem icon={<Activity size={14} />} label="测试时间" value={new Date(report.timestamp).toLocaleString()} />
                    </div>
                    <div className="bg-white/5 rounded p-3">
                      <span className="text-[10px] text-ore-text-muted block mb-1 uppercase tracking-wider">CPU 型号</span>
                      <span className="text-xs text-white/80 font-mono truncate block">{report.system.cpu}</span>
                    </div>
                  </div>

                  {report.qrcode_uri && (
                    <FocusItem
                      focusKey="settings-download-diagnostic-qr"
                      onArrowPress={handleLinearArrow}
                    >
                      {({ ref, focused }) => (
                        <div 
                          ref={ref}
                          className={`flex flex-col items-center justify-center bg-white/5 p-4 rounded-lg border transition-all w-full lg:w-48 shrink-0 ${
                            focused ? 'border-ore-green bg-white/10' : 'border-white/10'
                          }`}
                        >
                          <div className="bg-white p-2 rounded relative overflow-hidden">
                            <img src={report.qrcode_uri} alt="Diagnostic QR" className="w-32 h-32" />
                          </div>
                          <p className="text-[10px] text-ore-text-muted mt-3 text-center leading-relaxed">
                            扫描上方二维码<br />获取 Base64 诊断报告数据
                          </p>
                        </div>
                      )}
                    </FocusItem>
                  )}
                </div>
              </motion.div>
            ) : testing ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 flex flex-col items-center justify-center space-y-4"
              >
                <RefreshCw size={32} className="text-ore-green animate-spin" />
                <p className="text-sm text-ore-text-muted font-minecraft">正在深入抓取网络包并分析连通性...</p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-12 border-2 border-dashed border-white/5 rounded-lg flex flex-col items-center justify-center bg-black/10"
              >
                <Activity size={40} className="text-white/10 mb-4" />
                <p className="text-sm text-ore-text-muted">点击上方按钮开始测试网络连接状况</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SettingsSection>
    </SettingsPageLayout>
  );
};

interface StatusBadgeProps {
  label: string;
  success: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ label, success }) => (
  <div className="flex flex-col items-center">
    <span className="text-[9px] text-ore-text-muted mb-1 uppercase font-bold">{label}</span>
    {success ? (
      <CheckCircle2 size={12} className="text-green-500" />
    ) : (
      <XCircle size={12} className="text-red-500" />
    )}
  </div>
);

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const InfoItem: React.FC<InfoItemProps> = ({ icon, label, value }) => (
  <div className="flex flex-col">
    <div className="flex items-center text-[10px] text-ore-text-muted mb-1">
      {icon}
      <span className="ml-1.5 uppercase tracking-wider">{label}</span>
    </div>
    <span className="text-xs text-white/80 font-medium truncate" title={value}>{value}</span>
  </div>
);
