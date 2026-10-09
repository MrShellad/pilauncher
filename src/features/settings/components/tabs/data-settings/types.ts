import type { AppSettings } from '../../../../../types/settings';
import type {
  WebDavFavoriteSyncResult,
  WebDavSaveBackupSyncResult,
  WebDavSkinSyncResult,
  WebDavSyncResult,
} from '../../../../../types/webdav';

export interface LogShareHistoryRecord {
  uuid: string;
  logId: string;
  logType: string;
  url: string;
  rawUrl?: string | null;
  createdAt: number;
  expiresAt: number;
}

export type {
  WebDavFavoriteSyncResult,
  WebDavSaveBackupSyncResult,
  WebDavSkinSyncResult,
  WebDavSyncResult
};

export type CleanLogsPhase = 'idle' | 'confirm' | 'cleaning' | 'done' | 'error';

export type UpdateGeneralSetting = <K extends keyof AppSettings['general']>(
  key: K,
  value: AppSettings['general'][K]
) => void;

export type ArrowPressHandler = (direction: string) => boolean | void;

export const formatUnixSeconds = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '-';
  return new Date(value * 1000).toLocaleString();
};
