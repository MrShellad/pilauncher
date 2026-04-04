import { useCallback, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import type { NetworkTestReport } from './downloadSettings.types';

export const NETWORK_DIAGNOSTICS_TRIGGER_FOCUS_KEY =
  'settings-download-run-diagnostics';
export const NETWORK_DIAGNOSTICS_QR_FOCUS_KEY = 'settings-download-diagnostic-qr';

export const getNetworkDiagnosticsFocusKeys = (
  report: NetworkTestReport | null
) => {
  const keys = [NETWORK_DIAGNOSTICS_TRIGGER_FOCUS_KEY];

  if (!report) {
    return keys;
  }

  report.domains.forEach((domain) => {
    keys.push(`settings-download-diagnostic-result-${domain.domain}`);
  });

  if (report.qrcode_uri) {
    keys.push(NETWORK_DIAGNOSTICS_QR_FOCUS_KEY);
  }

  return keys;
};

export const useNetworkDiagnosticsController = () => {
  const [report, setReport] = useState<NetworkTestReport | null>(null);
  const [testing, setTesting] = useState(false);

  const runNetworkTest = useCallback(async () => {
    setTesting(true);
    setReport(null);

    try {
      const result = await invoke<NetworkTestReport>('run_network_test');
      setReport(result);
    } catch (error) {
      console.error('Network test failed:', error);
      alert('网络测试失败，请检查网络连接后重试。');
    } finally {
      setTesting(false);
    }
  }, []);

  const focusKeys = useMemo(() => getNetworkDiagnosticsFocusKeys(report), [report]);

  return {
    report,
    testing,
    focusKeys,
    runNetworkTest
  };
};
