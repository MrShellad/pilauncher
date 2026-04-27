import React from 'react';
import { CheckCircle2, Loader2, RefreshCw, Trash2 } from 'lucide-react';

import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreConfirmDialog } from '../../../../../../ui/primitives/OreConfirmDialog';
import { OreModal } from '../../../../../../ui/primitives/OreModal';
import type { LogShareHistoryRecord } from '../types';
import { formatUnixSeconds } from '../types';

interface RemoteLogsModalProps {
  isOpen: boolean;
  records: LogShareHistoryRecord[];
  isLoading: boolean;
  error: string;
  nowUnixSeconds: number;
  deletingUuid: string | null;
  pendingDelete: LogShareHistoryRecord | null;
  deletedLogId: string | null;
  onClose: () => void;
  onReload: () => Promise<void>;
  onRequestDelete: (record: LogShareHistoryRecord) => void;
  onCloseDeleteConfirm: () => void;
  onConfirmDelete: () => Promise<void>;
  onCloseDeleteSuccess: () => void;
}

export const RemoteLogsModal: React.FC<RemoteLogsModalProps> = ({
  isOpen,
  records,
  isLoading,
  error,
  nowUnixSeconds,
  deletingUuid,
  pendingDelete,
  deletedLogId,
  onClose,
  onReload,
  onRequestDelete,
  onCloseDeleteConfirm,
  onConfirmDelete,
  onCloseDeleteSuccess
}) => (
  <>
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title="远端日志历史"
      defaultFocusKey="remote-logs-refresh"
      className="w-[760px]"
      contentClassName="p-0 overflow-hidden"
      actions={
        <div className="flex flex-row gap-3 justify-end">
          <OreButton
            variant="secondary"
            onClick={() => void onReload()}
            focusKey="remote-logs-refresh"
            className="min-w-[110px] justify-center whitespace-nowrap"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <RefreshCw size={16} className="mr-2" />}
            刷新
          </OreButton>
          <OreButton
            variant="primary"
            onClick={onClose}
            focusKey="remote-logs-close"
            className="min-w-[110px] justify-center whitespace-nowrap"
          >
            完成
          </OreButton>
        </div>
      }
    >
      <div className="flex h-[430px] flex-col">
        <div className="grid grid-cols-[1.2fr_1fr_1fr_110px] gap-3 border-b-[3px] border-[var(--ore-border-color)] bg-black/20 px-4 py-3 text-xs text-ore-text-muted">
          <div>日志 ID</div>
          <div>生成时间</div>
          <div>过期时间</div>
          <div className="text-right">操作</div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-ore-text-muted">
              <Loader2 size={32} className="animate-spin text-ore-green" />
              <div className="text-sm">正在读取远端日志历史...</div>
            </div>
          )}

          {!isLoading && error && (
            <div className="m-4 rounded-sm border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {!isLoading && !error && records.length === 0 && (
            <div className="flex h-full items-center justify-center text-sm text-ore-text-muted">
              当前没有已记录的远端日志。
            </div>
          )}

          {!isLoading && !error && records.map((record, index) => {
            const isDeleting = deletingUuid === record.uuid;
            const isExpired = nowUnixSeconds > 0 && record.expiresAt <= nowUnixSeconds;

            return (
              <div
                key={record.uuid}
                className="grid grid-cols-[1.2fr_1fr_1fr_110px] items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-white" title={record.logId}>{record.logId}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-ore-text-muted">{record.logType}</div>
                </div>
                <div className="text-xs text-ore-text-muted">{formatUnixSeconds(record.createdAt)}</div>
                <div className={`text-xs ${isExpired ? 'text-yellow-300' : 'text-ore-text-muted'}`}>
                  {formatUnixSeconds(record.expiresAt)}
                </div>
                <div className="flex justify-end">
                  <OreButton
                    variant="danger"
                    size="auto"
                    focusKey={`remote-log-delete-${index}`}
                    className="h-9 min-w-[96px] justify-center whitespace-nowrap px-3 text-sm"
                    disabled={isDeleting}
                    onClick={() => onRequestDelete(record)}
                  >
                    {isDeleting ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Trash2 size={14} className="mr-1.5" />}
                    删除
                  </OreButton>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </OreModal>

    <OreConfirmDialog
      isOpen={!!pendingDelete}
      onClose={onCloseDeleteConfirm}
      onConfirm={() => void onConfirmDelete()}
      title="删除远端日志"
      headline="确定要删除这条远端日志吗？"
      description={
        <div className="space-y-2">
          <p className="font-mono text-xs bg-black/30 px-3 py-2 rounded break-all">
            {pendingDelete?.logId}
          </p>
          <p>删除时会使用本地保存的 token 请求 LogShare.CN，并在成功后清理本地历史记录。</p>
        </div>
      }
      confirmLabel="删除"
      cancelLabel="取消"
      confirmVariant="danger"
      tone="danger"
      dialogIcon={<Trash2 size={32} className="text-red-500" />}
      isConfirming={!!deletingUuid}
      closeOnOutsideClick={!deletingUuid}
    />

    <OreConfirmDialog
      isOpen={!!deletedLogId}
      onClose={onCloseDeleteSuccess}
      onConfirm={onCloseDeleteSuccess}
      title="删除成功"
      headline="远端日志已删除"
      description={
        <div className="space-y-2">
          <p className="font-mono text-xs bg-black/30 px-3 py-2 rounded break-all">
            {deletedLogId}
          </p>
          <p>本地历史记录也已清理。</p>
        </div>
      }
      confirmLabel="完成"
      confirmVariant="primary"
      tone="info"
      dialogIcon={<CheckCircle2 size={32} className="text-ore-green" />}
      hideCancelButton
    />
  </>
);
