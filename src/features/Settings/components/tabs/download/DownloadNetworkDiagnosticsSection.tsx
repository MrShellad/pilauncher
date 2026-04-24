import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  CheckCircle2,
  Cpu,
  Download,
  Info,
  Monitor,
  RefreshCw,
  Wifi,
  XCircle
} from 'lucide-react';

import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { SettingsSection } from '../../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../../ui/primitives/OreButton';

import type {
  DownloadBenchmarkReport,
  DownloadBenchmarkResult,
  NetworkTestReport
} from './downloadSettings.types';
import {
  DOWNLOAD_BENCHMARK_TRIGGER_FOCUS_KEY
} from './useDownloadBenchmarkController';
import {
  NETWORK_DIAGNOSTICS_QR_FOCUS_KEY,
  NETWORK_DIAGNOSTICS_TRIGGER_FOCUS_KEY
} from './useNetworkDiagnosticsController';

interface DownloadNetworkDiagnosticsSectionProps {
  report: NetworkTestReport | null;
  testing: boolean;
  downloadBenchmarkReport: DownloadBenchmarkReport | null;
  downloadBenchmarkTesting: boolean;
  onArrowPress: (direction: string) => boolean;
  onRunNetworkTest: () => void;
  onRunDownloadBenchmark: () => void;
}

export const DownloadNetworkDiagnosticsSection: React.FC<
  DownloadNetworkDiagnosticsSectionProps
> = ({
  report,
  testing,
  downloadBenchmarkReport,
  downloadBenchmarkTesting,
  onArrowPress,
  onRunNetworkTest,
  onRunDownloadBenchmark
}) => (
    <SettingsSection title="网络诊断与测速" icon={<Activity size={18} />}>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h4 className="mb-1 font-minecraft text-base text-white">网络可用性检测</h4>
            <p className="text-xs text-ore-text-muted">
              测试启动器依赖域名的连通质量，覆盖 DNS、TCP、TLS 和 HTTP 四层。
            </p>
          </div>
          <OreButton
            focusKey={NETWORK_DIAGNOSTICS_TRIGGER_FOCUS_KEY}
            onArrowPress={onArrowPress}
            onClick={onRunNetworkTest}
            disabled={testing}
            variant="primary"
            className="px-6"
          >
            {testing ? (
              <div className="flex items-center">
                <RefreshCw size={14} className="mr-2 animate-spin" />
                正在测试...
              </div>
            ) : (
              '开始全面诊断'
            )}
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
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {report.domains.map((domainResult) => (
                  <FocusItem
                    key={domainResult.domain}
                    focusKey={`settings-download-diagnostic-result-${domainResult.domain}`}
                    onArrowPress={onArrowPress}
                  >
                    {({ ref, focused }) => (
                      <div
                        ref={ref}
                        className={`flex flex-col justify-between rounded-lg border bg-black/20 p-4 transition-colors hover:bg-black/30 ${focused
                            ? 'border-ore-green shadow-[0_0_10px_rgba(56,133,39,0.3)]'
                            : 'border-white/5'
                          }`}
                      >
                        <div className="mb-3 flex items-start justify-between">
                          <div className="flex flex-col">
                            <span
                              className="break-all pr-2 font-mono text-sm text-white"
                              title={domainResult.domain}
                            >
                              {domainResult.domain}
                            </span>
                            <span className="mt-0.5 text-[12px] text-ore-text-muted">
                              {domainResult.dns_info}
                            </span>
                          </div>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[12px] font-medium ${domainResult.latency < 100
                                ? 'bg-green-500/20 text-green-400'
                                : domainResult.latency < 300
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}
                          >
                            {domainResult.latency}ms
                          </span>
                        </div>

                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex space-x-3">
                            <StatusBadge label="DNS" success={domainResult.dns} />
                            <StatusBadge label="TCP" success={domainResult.tcp} />
                            <StatusBadge label="TLS" success={domainResult.tls} />
                            <StatusBadge label="HTTP" success={domainResult.http} />
                          </div>
                        </div>
                      </div>
                    )}
                  </FocusItem>
                ))}
              </div>

              <div className="flex flex-col gap-6 border-t border-white/5 pt-6 lg:flex-row">
                <div className="flex-1 space-y-4">
                  <h5 className="flex items-center text-sm font-minecraft text-white">
                    <Info size={14} className="mr-2 text-ore-green" />
                    系统与网络状态
                  </h5>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoItem icon={<Monitor size={14} />} label="操作系统" value={report.system.os} />
                    <InfoItem icon={<Cpu size={14} />} label="处理器架构" value={report.system.arch} />
                    <InfoItem icon={<Wifi size={14} />} label="本地 IP" value={report.network.local_ip} />
                    <InfoItem
                      icon={<Activity size={14} />}
                      label="测试时间"
                      value={new Date(report.timestamp).toLocaleString()}
                    />
                  </div>
                  <div className="rounded bg-white/5 p-3">
                    <span className="mb-1 block text-[10px] uppercase tracking-wider text-ore-text-muted">
                      CPU 型号
                    </span>
                    <span
                      className="block truncate font-mono text-xs text-white/80"
                      title={report.system.cpu}
                    >
                      {report.system.cpu}
                    </span>
                  </div>
                </div>

                {report.qrcode_uri && (
                  <FocusItem focusKey={NETWORK_DIAGNOSTICS_QR_FOCUS_KEY} onArrowPress={onArrowPress}>
                    {({ ref, focused }) => (
                      <div
                        ref={ref}
                        className={`flex w-full shrink-0 flex-col items-center justify-center rounded-lg border p-4 transition-all lg:w-48 ${focused ? 'border-ore-green bg-white/10' : 'border-white/10 bg-white/5'
                          }`}
                      >
                        <div className="relative overflow-hidden rounded bg-white p-2">
                          <img src={report.qrcode_uri} alt="Diagnostic QR" className="h-32 w-32" />
                        </div>
                        <p className="mt-3 text-center text-[10px] leading-relaxed text-ore-text-muted">
                          扫描上方二维码
                          <br />
                          获取 Base64 诊断报告数据
                        </p>
                      </div>
                    )}
                  </FocusItem>
                )}
              </div>

              <div className="border-t border-white/5 pt-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h5 className="mb-1 flex items-center text-sm font-minecraft text-white">
                      <Download size={14} className="mr-2 text-ore-green" />
                      下载测试
                    </h5>
                    <p className="text-xs text-ore-text-muted">
                      对 Assets、Java、Loader 源做 200KB 下载测试，输出 TTFB、速度、Range 和并发结果。
                    </p>
                  </div>
                  <OreButton
                    focusKey={DOWNLOAD_BENCHMARK_TRIGGER_FOCUS_KEY}
                    onArrowPress={onArrowPress}
                    onClick={onRunDownloadBenchmark}
                    disabled={downloadBenchmarkTesting}
                    variant="secondary"
                    className="px-5"
                  >
                    {downloadBenchmarkTesting ? (
                      <div className="flex items-center">
                        <RefreshCw size={14} className="mr-2 animate-spin" />
                        正在下载测试...
                      </div>
                    ) : (
                      '开始下载测试'
                    )}
                  </OreButton>
                </div>

                {downloadBenchmarkReport ? (
                  <div className="space-y-5">
                    <div className="rounded-lg border border-white/10 bg-black/15 px-4 py-3 text-xs text-ore-text-muted">
                      采样大小 {formatBytes(downloadBenchmarkReport.sample_size_bytes)}，并发流数{' '}
                      {downloadBenchmarkReport.concurrency_streams}，测试时间{' '}
                      {new Date(downloadBenchmarkReport.timestamp).toLocaleString()}
                    </div>

                    <BenchmarkGroup
                      title="Assets 下载测试"
                      prefix="assets"
                      entries={downloadBenchmarkReport.assets}
                      onArrowPress={onArrowPress}
                    />
                    <BenchmarkGroup
                      title="Java 下载测试"
                      prefix="java"
                      entries={downloadBenchmarkReport.java}
                      onArrowPress={onArrowPress}
                    />
                    <BenchmarkGroup
                      title="Loader 下载测试"
                      prefix="loader"
                      entries={downloadBenchmarkReport.loader}
                      onArrowPress={onArrowPress}
                    />
                  </div>
                ) : downloadBenchmarkTesting ? (
                  <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border border-white/10 bg-black/10 py-14">
                    <RefreshCw size={28} className="animate-spin text-ore-green" />
                    <p className="text-sm text-ore-text-muted">正在执行多源下载测试与测速...</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-white/10 bg-black/10 px-4 py-8 text-center text-sm text-ore-text-muted">
                    网络测试完成后，可在这里继续执行下载测试。
                  </div>
                )}
              </div>
            </motion.div>
          ) : testing ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center space-y-4 py-20"
            >
              <RefreshCw size={32} className="animate-spin text-ore-green" />
              <p className="font-minecraft text-sm text-ore-text-muted">
                正在抓取网络包并分析连通性...
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/5 bg-black/10 py-12"
            >
              <Activity size={40} className="mb-4 text-white/10" />
              <p className="text-sm text-ore-text-muted">点击上方按钮开始测试网络连接状态</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SettingsSection>
  );

interface BenchmarkGroupProps {
  title: string;
  prefix: string;
  entries: DownloadBenchmarkResult[];
  onArrowPress: (direction: string) => boolean;
}

const BenchmarkGroup: React.FC<BenchmarkGroupProps> = ({
  title,
  prefix,
  entries,
  onArrowPress
}) => (
  <div className="space-y-3">
    <div className="text-sm font-minecraft text-white">{title}</div>
    {entries.length === 0 ? (
      <div className="rounded-lg border border-white/10 bg-black/10 px-4 py-5 text-sm text-ore-text-muted">
        当前没有可用测试源。
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {entries.map((entry, index) => (
          <FocusItem
            key={`${prefix}-${index}-${entry.source_id}`}
            focusKey={`settings-download-benchmark-${prefix}-${index}`}
            onArrowPress={onArrowPress}
          >
            {({ ref, focused }) => (
              <div
                ref={ref}
                className={`rounded-lg border p-4 transition-colors ${focused
                    ? 'border-ore-green bg-black/30 shadow-[0_0_10px_rgba(56,133,39,0.3)]'
                    : 'border-white/10 bg-black/15'
                  }`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-minecraft text-white">
                      {entry.source_name}
                    </div>
                    <div className="mt-1 text-[11px] text-ore-text-muted">
                      {entry.target}
                    </div>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] ${entry.ok
                        ? 'bg-green-500/15 text-green-400'
                        : 'bg-red-500/15 text-red-400'
                      }`}
                  >
                    {entry.ok ? '成功' : '失败'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <MetricItem label="TTFB" value={formatNullableMs(entry.ttfb_ms)} />
                  <MetricItem
                    label="下载速度"
                    value={formatNullableSpeed(entry.download_speed_mbps)}
                  />
                  <MetricItem
                    label="并发速度"
                    value={formatNullableSpeed(entry.concurrent_speed_mbps)}
                  />
                  <MetricItem
                    label="测试大小"
                    value={formatBytes(entry.bytes_tested || entry.content_length || 0)}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill label={entry.range_supported ? 'Range 支持' : 'Range 不支持'} />
                  <Pill label={entry.temp_cleared ? '临时文件已清理' : '临时文件清理失败'} />
                </div>

                <div className="mt-3 truncate font-mono text-[11px] text-white/60" title={entry.url}>
                  {entry.url}
                </div>

                {entry.error && (
                  <div className="mt-3 rounded bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                    {entry.error}
                  </div>
                )}
              </div>
            )}
          </FocusItem>
        ))}
      </div>
    )}
  </div>
);

interface StatusBadgeProps {
  label: string;
  success: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ label, success }) => (
  <div className="flex flex-col items-center">
    <span className="mb-1 text-[9px] font-bold uppercase text-ore-text-muted">{label}</span>
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
    <div className="mb-1 flex items-center text-[10px] text-ore-text-muted">
      {icon}
      <span className="ml-1.5 uppercase tracking-wider">{label}</span>
    </div>
    <span className="truncate text-xs font-medium text-white/80" title={value}>
      {value}
    </span>
  </div>
);

const MetricItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded bg-white/5 px-3 py-2">
    <div className="mb-1 text-[10px] uppercase tracking-wider text-ore-text-muted">{label}</div>
    <div className="text-sm text-white">{value}</div>
  </div>
);

const Pill: React.FC<{ label: string }> = ({ label }) => (
  <span className="rounded bg-white/8 px-2 py-1 text-[11px] text-ore-text-muted">
    {label}
  </span>
);

const formatBytes = (bytes: number) => {
  if (!bytes) {
    return '0 B';
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
};

const formatNullableMs = (value?: number | null) =>
  typeof value === 'number' ? `${value} ms` : '--';

const formatNullableSpeed = (value?: number | null) =>
  typeof value === 'number' ? `${value.toFixed(2)} Mbps` : '--';
