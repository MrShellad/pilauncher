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

import type { TFunction } from 'i18next';

/**
 * 格式化 ISO 日期为 YYYY-MM-DD
 */
export const formatDate = (dateStr?: string) => {
  if (!dateStr) return '未知时间';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 格式化游玩时长 (秒 -> 结合 i18n 输出可读文本)
 */
export const formatPlayTime = (seconds: number | undefined | null, t: TFunction) => {
  if (!seconds || seconds <= 0) return `0${t('home.playTimeUnit', { defaultValue: 'H' })}`;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}${t('home.playTimeUnit', { defaultValue: 'H' })} ${minutes}m`;
    }
    return `${hours}${t('home.playTimeUnit', { defaultValue: 'H' })}`;
  }
  return `${Math.max(1, minutes)}m`;
};

/**
 * 格式化上次游玩时间 (相对时间表示法)
 */
export const formatRelativeTime = (dateStr: string | undefined | null, t: TFunction) => {
  if (!dateStr) return t('download.time.unknown', { defaultValue: '未知时间' });
  
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return t('download.time.today', { defaultValue: '今天' });
  if (diffDays < 30) return t('download.time.daysAgo', { count: diffDays, defaultValue: '{{count}} 天前' });
  if (diffDays < 365) return t('download.time.monthsAgo', { count: Math.floor(diffDays / 30), defaultValue: '{{count}} 个月前' });
  return t('download.time.yearsAgo', { count: Math.floor(diffDays / 365), defaultValue: '{{count}} 年前' });
};