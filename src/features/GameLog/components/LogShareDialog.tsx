import React from 'react';
import { AlertTriangle, Check, Copy, ExternalLink, Loader2, Share2, ShieldCheck, Sparkles } from 'lucide-react';

import { FocusItem } from '../../../ui/focus/FocusItem';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreModal } from '../../../ui/primitives/OreModal';
import type { LogShareReport } from '../../../services/mclogsService';

interface LogShareDialogProps {
  isOpen: boolean;
  logCount: number;
  report: LogShareReport | null;
  error: string | null;
  isSharing: boolean;
  sanitize: boolean;
  includeAiAnalysis: boolean;
  copiedShareUrl: boolean;
  onSanitizeChange: (value: boolean) => void;
  onIncludeAiAnalysisChange: (value: boolean) => void;
  onShare: () => void;
  onCopyUrl: () => void;
  onOpenUrl: () => void;
  onClose: () => void;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const getString = (record: UnknownRecord | null, keys: string[]) => {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }

  return null;
};

const getInsightAnalysis = (insights: unknown): UnknownRecord | null => {
  if (!isRecord(insights)) return null;
  const analysis = insights.analysis;
  return isRecord(analysis) ? analysis : insights;
};

const getInsightIssues = (insights: unknown): unknown[] => {
  const analysis = getInsightAnalysis(insights);
  return Array.isArray(analysis?.issues) ? analysis.issues : [];
};

const getAiText = (aiAnalysis: unknown) => {
  if (typeof aiAnalysis === 'string') return aiAnalysis;
  if (!isRecord(aiAnalysis)) return null;
  return getString(aiAnalysis, ['analysis', 'message', 'result', 'content']);
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
};

const renderIssueText = (issue: unknown, index: number) => {
  if (typeof issue === 'string') return issue;
  if (!isRecord(issue)) return `问题 ${index + 1}`;
  return getString(issue, ['message', 'title', 'name', 'description', 'summary']) ?? `问题 ${index + 1}`;
};

const ToggleRow: React.FC<{
  focusKey: string;
  checked: boolean;
  title: string;
  description: string;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}> = ({ focusKey, checked, title, description, disabled = false, onChange }) => (
  <FocusItem focusKey={focusKey} disabled={disabled} onEnter={() => onChange(!checked)}>
    {({ ref, focused }) => (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`flex w-full items-start gap-3 rounded-sm border p-3 text-left transition-colors ${
          focused ? 'border-ore-green bg-ore-green/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border ${
            checked ? 'border-ore-green bg-ore-green text-black' : 'border-white/25 bg-black/20'
          }`}
        >
          {checked && <Check size={14} strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm text-white">{title}</span>
          <span className="mt-1 block text-xs leading-relaxed text-ore-text-muted">{description}</span>
        </span>
      </button>
    )}
  </FocusItem>
);

export const LogShareDialog: React.FC<LogShareDialogProps> = ({
  isOpen,
  logCount,
  report,
  error,
  isSharing,
  sanitize,
  includeAiAnalysis,
  copiedShareUrl,
  onSanitizeChange,
  onIncludeAiAnalysisChange,
  onShare,
  onCopyUrl,
  onOpenUrl,
  onClose
}) => {
  const analysis = getInsightAnalysis(report?.insights);
  const software = getString(analysis, ['software', 'loader', 'type']);
  const version = getString(analysis, ['version', 'minecraftVersion', 'gameVersion']);
  const issues = getInsightIssues(report?.insights);
  const aiText = getAiText(report?.aiAnalysis);
  const canShare = logCount > 0 && !isSharing;

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title="日志分享"
      className="w-[620px]"
      defaultFocusKey={report ? 'logshare-copy-url' : 'logshare-confirm'}
      actions={
        report ? (
          <>
            <OreButton
              focusKey="logshare-copy-url"
              variant="secondary"
              size="auto"
              onClick={onCopyUrl}
              disabled={!report.upload.url}
            >
              {copiedShareUrl ? <Check size={16} className="mr-2 text-ore-green" /> : <Copy size={16} className="mr-2" />}
              {copiedShareUrl ? '已复制' : '复制链接'}
            </OreButton>
            <OreButton
              focusKey="logshare-open-url"
              variant="secondary"
              size="auto"
              onClick={onOpenUrl}
              disabled={!report.upload.url}
            >
              <ExternalLink size={16} className="mr-2" />
              打开页面
            </OreButton>
            <OreButton focusKey="logshare-close" variant="primary" size="auto" onClick={onClose}>
              完成
            </OreButton>
          </>
        ) : (
          <>
            <OreButton focusKey="logshare-cancel" variant="secondary" size="auto" onClick={onClose}>
              取消
            </OreButton>
            <OreButton
              focusKey="logshare-confirm"
              variant="primary"
              size="auto"
              onClick={onShare}
              disabled={!canShare}
            >
              {isSharing ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Share2 size={16} className="mr-2" />}
              {isSharing ? '上传中...' : '上传日志'}
            </OreButton>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-sm border border-sky-500/20 bg-sky-500/10 p-3">
          <Share2 size={18} className="mt-0.5 shrink-0 text-sky-300" />
          <div className="min-w-0">
            <div className="text-sm text-white">LogShare.CN</div>
            <div className="mt-1 text-xs leading-relaxed text-ore-text-muted">
              当前准备上传 {logCount} 行日志。上传前会在后端执行大小校验和可选脱敏。
            </div>
          </div>
        </div>

        {!report && (
          <div className="space-y-3">
            <ToggleRow
              focusKey="logshare-sanitize-toggle"
              checked={sanitize}
              title="脱敏敏感信息"
              description="替换常见 token、授权头和本机用户路径。"
              disabled={isSharing}
              onChange={onSanitizeChange}
            />
            <ToggleRow
              focusKey="logshare-ai-toggle"
              checked={includeAiAnalysis}
              title="请求 AI 诊断"
              description="上传成功后附加拉取智能诊断，可能比普通分享更慢。"
              disabled={isSharing}
              onChange={onIncludeAiAnalysisChange}
            />
          </div>
        )}

        {isSharing && (
          <div className="flex items-center rounded-sm border border-white/10 bg-white/[0.03] p-3 text-sm text-ore-text-muted">
            <Loader2 size={16} className="mr-2 animate-spin text-ore-green" />
            正在上传并获取分析结果...
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-sm border border-red-500/25 bg-red-500/10 p-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
            <div className="text-sm leading-relaxed text-red-200">{error}</div>
          </div>
        )}

        {report && (
          <div className="space-y-4">
            <div className="rounded-sm border border-ore-green/25 bg-ore-green/10 p-3">
              <div className="flex items-center gap-2 text-sm text-ore-green">
                <ShieldCheck size={16} />
                上传成功
              </div>
              <div className="mt-2 break-all font-mono text-xs text-white/90">{report.upload.url}</div>
              <div className="mt-2 text-xs text-ore-text-muted">
                {report.lineCount} 行 / {formatBytes(report.byteCount)} / {report.sanitized ? '已脱敏' : '未脱敏'}
              </div>
              {report.history && (
                <div className="mt-2 text-xs text-ore-green">
                  已记录远端日志删除凭据，过期时间会用于后续数据管理。
                </div>
              )}
              {report.historyError && (
                <div className="mt-2 text-xs text-yellow-200">
                  历史记录保存失败：{report.historyError}
                </div>
              )}
            </div>

            {(software || version || issues.length > 0 || report.insightsError) && (
              <div className="rounded-sm border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 text-sm text-white">基础洞察</div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-ore-text-muted">软件类型</div>
                    <div className="mt-1 text-white">{software ?? '未识别'}</div>
                  </div>
                  <div>
                    <div className="text-ore-text-muted">版本</div>
                    <div className="mt-1 text-white">{version ?? '未识别'}</div>
                  </div>
                </div>
                {issues.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {issues.slice(0, 5).map((issue, index) => (
                      <div key={index} className="rounded-sm border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
                        {renderIssueText(issue, index)}
                      </div>
                    ))}
                  </div>
                )}
                {report.insightsError && (
                  <div className="mt-3 text-xs text-yellow-200">洞察获取失败：{report.insightsError}</div>
                )}
              </div>
            )}

            {(aiText || report.aiAnalysisError) && (
              <div className="rounded-sm border border-purple-400/20 bg-purple-400/10 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm text-white">
                  <Sparkles size={16} className="text-purple-300" />
                  AI 诊断
                </div>
                {aiText && (
                  <div className="max-h-52 overflow-y-auto whitespace-pre-wrap rounded-sm bg-black/25 p-3 text-xs leading-relaxed text-purple-50 custom-scrollbar">
                    {aiText}
                  </div>
                )}
                {report.aiAnalysisError && (
                  <div className="text-xs text-yellow-200">AI 诊断获取失败：{report.aiAnalysisError}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </OreModal>
  );
};
