import React, { useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FolderPlus,
  Loader2,
} from 'lucide-react';

import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import type {
  ImportLogEntry,
  ImportState,
} from '../../../../hooks/pages/Instances/useThirdPartyImport';
import { formatInstanceStatus } from './ThirdPartyImportPanel';

const formatLogLevel = (entry: ImportLogEntry) => {
  switch (entry.level) {
    case 'success':
      return { label: 'OK', className: 'text-emerald-300' };
    case 'warning':
      return { label: 'WARN', className: 'text-amber-300' };
    case 'error':
      return { label: 'ERR', className: 'text-red-300' };
    default:
      return { label: 'INFO', className: 'text-sky-300' };
  }
};

const formatLogTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? '--:--:--'
    : date.toLocaleTimeString([], { hour12: false });
};

export interface ThirdPartyImportModalProps {
  importState: ImportState;
  isImporting: boolean;
  closeImportModal: () => void;
  confirmDownloadMissing: () => void;
}

export const ThirdPartyImportModal: React.FC<ThirdPartyImportModalProps> = ({
  importState,
  isImporting,
  closeImportModal,
  confirmDownloadMissing,
}) => {
  const importProgressPercent = useMemo(() => {
    if (importState.progressTotal <= 0) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(100, Math.round((importState.progressCurrent / importState.progressTotal) * 100))
    );
  }, [importState.progressCurrent, importState.progressTotal]);

  const importModalTitle = useMemo(() => {
    if (importState.status === 'importing') {
      return '正在导入';
    }

    if (importState.status === 'error') {
      return importState.added > 0 ? '部分导入完成' : '导入失败';
    }

    if (importState.status === 'partial_missing') {
      return '导入完成（需补全）';
    }

    if (importState.status === 'empty') {
      return '未发现可导入实例';
    }

    return '导入完成';
  }, [importState.added, importState.status]);

  if (!importState.isOpen) return null;

  return (
    <OreModal
      isOpen={importState.isOpen}
      onClose={isImporting ? () => {} : closeImportModal}
      title={importModalTitle}
      className="!w-[760px]"
      actions={
        <div className="flex w-full justify-end gap-3">
          {!isImporting && (
            <OreButton variant="ghost" size="sm" onClick={closeImportModal} focusKey="import-close">
              关闭
            </OreButton>
          )}
          {!isImporting && importState.missing.length > 0 && (
            <OreButton
              variant="primary"
              size="sm"
              onClick={() => void confirmDownloadMissing()}
              focusKey="import-download"
            >
              前往下载补全
            </OreButton>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-4 rounded-[2px] border border-white/10 bg-[#0F0F10] p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              {importState.status === 'importing' ? (
                <Loader2 size={30} className="mt-0.5 animate-spin text-ore-green" />
              ) : importState.status === 'error' ? (
                <AlertCircle size={30} className="mt-0.5 text-red-400" />
              ) : importState.status === 'partial_missing' ? (
                <AlertTriangle size={30} className="mt-0.5 text-amber-300" />
              ) : importState.status === 'empty' ? (
                <FolderPlus size={30} className="mt-0.5 text-ore-text-muted" />
              ) : (
                <CheckCircle2 size={30} className="mt-0.5 text-emerald-300" />
              )}

              <div>
                <p className="font-minecraft text-lg tracking-wider text-white">
                  {importState.sourceLabel || '第三方启动器库'}
                </p>
                <p className="break-all text-sm leading-relaxed text-ore-text-muted">
                  {importState.currentMessage ||
                    '识别完成后会在这里显示导入进度、成功项与跳过原因。'}
                </p>
              </div>
            </div>

            <div className="grid min-w-[15rem] grid-cols-3 gap-2">
              <div className="rounded-[2px] border border-white/10 bg-white/[0.04] px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ore-text-muted">新增</p>
                <p className="font-minecraft text-lg text-white">{importState.added}</p>
              </div>
              <div className="rounded-[2px] border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-amber-200/80">跳过</p>
                <p className="font-minecraft text-lg text-amber-100">{importState.skipped}</p>
              </div>
              <div className="rounded-[2px] border border-red-500/20 bg-red-500/10 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-red-200/80">失败</p>
                <p className="font-minecraft text-lg text-red-100">{importState.failed}</p>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-ore-text-muted">
              <span>{importState.progressPhase || 'WAITING'}</span>
              <span>
                {importState.progressCurrent}/{Math.max(importState.progressTotal, 1)} · {importProgressPercent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-sky-300 transition-all duration-300"
                style={{ width: `${importProgressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-[2px] border border-white/10 bg-[#0F0F10] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-minecraft text-sm tracking-wider text-white">导入日志</p>
            <p className="text-xs text-ore-text-muted">{importState.logs.length} 条</p>
          </div>

          <div className="max-h-[18rem] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {importState.logs.length === 0 ? (
              <p className="text-sm text-ore-text-muted">等待后端返回导入日志...</p>
            ) : (
              importState.logs.map((entry) => {
                const levelMeta = formatLogLevel(entry);
                return (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[3.5rem_4rem_1fr] items-start gap-3 rounded-[2px] border border-white/5 bg-white/[0.03] px-3 py-2 text-xs"
                  >
                    <span className="text-ore-text-muted">{formatLogTime(entry.timestamp)}</span>
                    <span className={`font-semibold ${levelMeta.className}`}>{levelMeta.label}</span>
                    <div className="min-w-0">
                      <p className="break-words text-white/90">{entry.message}</p>
                      <p className="pt-1 text-[11px] uppercase tracking-[0.18em] text-ore-text-muted">
                        {entry.phase}
                        {entry.instanceId ? ` · ${entry.instanceId}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {!isImporting && (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-[2px] border border-white/10 bg-[#0F0F10] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-minecraft text-sm tracking-wider text-white">成功导入</p>
                <p className="text-xs text-ore-text-muted">{importState.importedInstances.length} 项</p>
              </div>
              <div className="max-h-[14rem] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {importState.importedInstances.length === 0 ? (
                  <p className="text-sm text-ore-text-muted">本次没有新增实例。</p>
                ) : (
                  importState.importedInstances.map((instance) => {
                    const statusMeta = formatInstanceStatus(instance);
                    return (
                      <div
                        key={`imported-${instance.id}`}
                        className="flex items-center justify-between gap-3 rounded-[2px] border border-white/5 bg-white/[0.03] px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-white">{instance.name}</p>
                          <p className="truncate text-xs text-ore-text-muted">
                            {instance.mcVersion}
                            {instance.loaderType !== 'vanilla'
                              ? ` · ${instance.loaderType} ${instance.loaderVersion || ''}`
                              : ' · vanilla'}
                          </p>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-[11px] ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-[2px] border border-white/10 bg-[#0F0F10] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-minecraft text-sm tracking-wider text-white">跳过 / 失败</p>
                <p className="text-xs text-ore-text-muted">
                  {importState.skippedInstances.length + importState.failedInstances.length} 项
                </p>
              </div>
              <div className="max-h-[14rem] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {importState.skippedInstances.map((instance) => {
                  const statusMeta = formatInstanceStatus(instance);
                  return (
                    <div
                      key={`skipped-${instance.id}-${instance.status}`}
                      className="flex items-center justify-between gap-3 rounded-[2px] border border-white/5 bg-white/[0.03] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">{instance.name}</p>
                        <p className="truncate text-xs text-ore-text-muted">{instance.path}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[11px] ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                  );
                })}

                {importState.failedInstances.map((failure) => (
                  <div
                    key={`failed-${failure.instanceId}`}
                    className="rounded-[2px] border border-red-500/20 bg-red-500/10 px-3 py-2"
                  >
                    <p className="text-sm text-red-100">{failure.instanceId}</p>
                    <p className="pt-1 text-xs text-red-200/80">{failure.reason}</p>
                  </div>
                ))}

                {importState.skippedInstances.length === 0 &&
                  importState.failedInstances.length === 0 && (
                    <p className="text-sm text-ore-text-muted">没有跳过或失败的实例。</p>
                  )}
              </div>
            </div>
          </div>
        )}

        {!isImporting && importState.missing.length > 0 && (
          <div className="rounded-[2px] border border-amber-500/20 bg-amber-500/10 p-4">
            <div className="mb-2 flex items-center gap-2 text-amber-100">
              <AlertTriangle size={18} />
              <p className="font-minecraft text-sm tracking-wider">运行时尚未补全</p>
            </div>
            <p className="mb-3 text-sm leading-relaxed text-amber-50/90">
              这些实例已经导入成功，但当前启动器本地缺少对应版本核心、Loader 或依赖文件。
            </p>
            <div className="space-y-2">
              {importState.missing.map((item) => (
                <div
                  key={`${item.instance_id}-${item.mc_version}-${item.loader_type}-${item.loader_version}`}
                  className="rounded-[2px] border border-amber-500/20 bg-black/20 px-3 py-2 text-sm text-amber-50/90"
                >
                  {item.instance_id} · {item.mc_version}
                  {item.loader_type !== 'vanilla'
                    ? ` · ${item.loader_type} ${item.loader_version || ''}`
                    : ' · vanilla'}
                </div>
              ))}
            </div>
          </div>
        )}

        {importState.status === 'error' && importState.errorMsg && (
          <div className="rounded-[2px] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
            <div className="mb-2 flex items-center gap-2">
              <AlertCircle size={18} />
              <span className="font-minecraft tracking-wider">错误详情</span>
            </div>
            <p className="break-words leading-relaxed">{importState.errorMsg}</p>
          </div>
        )}

        {importState.status === 'empty' && (
          <div className="rounded-[2px] border border-dashed border-white/10 bg-[#0F0F10] p-4 text-sm leading-relaxed text-ore-text-muted">
            没有在所选目录里识别到隔离实例。请优先选择 `.minecraft` 根目录、`versions`
            目录，或包含 `{`{版本名}.json`}` 的实例目录。
          </div>
        )}
      </div>
    </OreModal>
  );
};
