import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface UseExportServiceProps {
  currentInstanceId: string | null;
  logs: string[];
}

export const useExportService = ({ currentInstanceId, logs }: UseExportServiceProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleCopyAll = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleExportTxt = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PiLauncher-Log-${new Date().getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleShareZip = async (): Promise<string> => {
    if (!currentInstanceId) throw new Error("No Instance ID");
    try {
      setIsExporting(true);
      const zipPath = await invoke<string>('export_diagnostics', {
        instanceId: currentInstanceId,
        launcherLogs: logs
      });
      return zipPath;
    } finally {
      setIsExporting(false);
    }
  };

  return { isExporting, copiedAll, handleCopyAll, handleExportTxt, handleShareZip };
};
