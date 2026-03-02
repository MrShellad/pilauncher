// /src/utils/formatters.ts

/**
 * 格式化数字 (如 96.8M, 24.2K)
 */
export const formatNumber = (num?: number) => {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

/**
 * 格式化 ISO 日期为 YYYY-MM-DD
 */
export const formatDate = (dateStr?: string) => {
  if (!dateStr) return '未知时间';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};