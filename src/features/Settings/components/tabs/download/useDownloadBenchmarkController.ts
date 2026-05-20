import { useCallback, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import type { DownloadBenchmarkReport } from './downloadSettings.types';

export const DOWNLOAD_BENCHMARK_TRIGGER_FOCUS_KEY = 'settings-download-run-benchmark';

export const getDownloadBenchmarkFocusKeys = (
  report: DownloadBenchmarkReport | null
) => {
  const keys = [DOWNLOAD_BENCHMARK_TRIGGER_FOCUS_KEY];

  if (!report) {
    return keys;
  }

  report.assets.forEach((_, index) => {
    keys.push(`settings-download-benchmark-assets-${index}`);
  });
  report.java.forEach((_, index) => {
    keys.push(`settings-download-benchmark-java-${index}`);
  });
  report.loader.forEach((_, index) => {
    keys.push(`settings-download-benchmark-loader-${index}`);
  });

  return keys;
};

export const useDownloadBenchmarkController = () => {
  const [report, setReport] = useState<DownloadBenchmarkReport | null>(null);
  const [testing, setTesting] = useState(false);

  const runDownloadBenchmark = useCallback(async () => {
    setTesting(true);
    setReport(null);

    try {
      const result = await invoke<DownloadBenchmarkReport>('run_download_benchmark');
      setReport(result);
    } catch (error) {
      console.error('Download benchmark failed:', error);
      alert('下载测试失败，请检查网络连接或下载源配置后重试。');
    } finally {
      setTesting(false);
    }
  }, []);

  const focusKeys = useMemo(() => getDownloadBenchmarkFocusKeys(report), [report]);

  return {
    report,
    testing,
    focusKeys,
    runDownloadBenchmark
  };
};
