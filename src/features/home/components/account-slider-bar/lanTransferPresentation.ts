import type { TransferProgressEvent, TransferRecord } from '../../../../hooks/useLan';

export const normalizeDeviceId = (value?: string) => (value || '').trim().toLowerCase();

export const formatTransferTimestamp = (timestamp?: number | null) => {
  if (!timestamp) {
    return '刚刚';
  }

  const value = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMinutes < 1) {
    return '刚刚';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} 天前`;
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getTransferKindLabel = (transferType: string) =>
  transferType === 'save' ? '存档' : '实例';

export const getTransferStatusMeta = (status: string) => {
  switch (status) {
    case 'packing':
      return { label: '打包中', className: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    case 'sending':
      return { label: '发送中', className: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    case 'receiving':
      return { label: '接收中', className: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    case 'received':
      return { label: '已接收', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'applying':
      return { label: '部署中', className: 'bg-amber-500/15 text-amber-200 border-amber-500/30' };
    case 'applied':
      return { label: '已导入', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'rejected':
      return { label: '已拒绝', className: 'bg-amber-500/15 text-amber-200 border-amber-500/30' };
    case 'failed':
      return { label: '失败', className: 'bg-red-500/15 text-red-300 border-red-500/30' };
    default:
      return { label: status || '未知', className: 'bg-white/10 text-gray-300 border-white/15' };
  }
};

export const getTransferProgressPercent = (progress?: TransferProgressEvent | null) => {
  if (!progress) {
    return 0;
  }
  if (progress.total > 0) {
    return Math.max(0, Math.min(100, Math.round((progress.current / progress.total) * 100)));
  }
  if (['RECEIVED', 'REJECTED', 'FAILED', 'APPLIED'].includes(progress.stage)) {
    return 100;
  }
  return 0;
};

export const upsertTransferRecord = (list: TransferRecord[], record: TransferRecord) => {
  const next = list.filter((item) => item.transferId !== record.transferId);
  next.push(record);
  next.sort((a, b) => a.createdAt - b.createdAt);
  return next;
};
