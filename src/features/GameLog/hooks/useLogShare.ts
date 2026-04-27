import { useCallback, useState } from 'react';

import { mclogsService, type LogShareOptions, type LogShareReport } from '../../../services/mclogsService';
import { useToastStore } from '../../../store/useToastStore';
import { openExternalLink } from '../../../utils/openExternalLink';

export const useLogShare = () => {
  const [isSharing, setIsSharing] = useState(false);
  const [report, setReport] = useState<LogShareReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  const resetShare = useCallback(() => {
    setReport(null);
    setError(null);
    setCopiedShareUrl(false);
  }, []);

  const shareLogs = useCallback(async (logs: string[], options: LogShareOptions) => {
    const content = logs.join('\n').trim();
    if (!content) {
      const message = '暂无可上传的日志内容';
      setError(message);
      addToast('warning', message);
      return null;
    }

    setIsSharing(true);
    setError(null);
    setCopiedShareUrl(false);

    try {
      const nextReport = await mclogsService.shareLog(content, options);
      setReport(nextReport);
      addToast('success', '日志已上传到 LogShare.CN');
      return nextReport;
    } catch (shareError) {
      const message = shareError instanceof Error ? shareError.message : String(shareError);
      setError(message);
      addToast('error', message);
      return null;
    } finally {
      setIsSharing(false);
    }
  }, [addToast]);

  const copyShareUrl = useCallback(async () => {
    const url = report?.upload.url;
    if (!url) return;

    await navigator.clipboard.writeText(url);
    setCopiedShareUrl(true);
    addToast('success', '分享链接已复制');
    window.setTimeout(() => setCopiedShareUrl(false), 2000);
  }, [addToast, report?.upload.url]);

  const openShareUrl = useCallback(() => {
    void openExternalLink(report?.upload.url);
  }, [report?.upload.url]);

  return {
    isSharing,
    report,
    error,
    copiedShareUrl,
    shareLogs,
    copyShareUrl,
    openShareUrl,
    resetShare
  };
};
