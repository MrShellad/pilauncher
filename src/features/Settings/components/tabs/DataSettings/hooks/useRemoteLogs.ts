import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { message } from '@tauri-apps/plugin-dialog';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import type { LogShareHistoryRecord } from '../types';

export const useRemoteLogs = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [records, setRecords] = useState<LogShareHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [nowUnixSeconds, setNowUnixSeconds] = useState(0);
  const [deletingUuid, setDeletingUuid] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LogShareHistoryRecord | null>(null);
  const [deletedLogId, setDeletedLogId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setNowUnixSeconds(Math.floor(Date.now() / 1000));

    try {
      const history = await invoke<LogShareHistoryRecord[]>('get_logshare_history');
      setRecords(history);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    void load();
  }, [load]);

  const close = useCallback(() => {
    setIsOpen(false);
    setError('');
    setDeletingUuid(null);
    setPendingDelete(null);
    setDeletedLogId(null);
    setTimeout(() => setFocus('settings-data-remote-logs'), 50);
  }, []);

  const requestDelete = useCallback((record: LogShareHistoryRecord) => {
    setPendingDelete(record);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    if (!deletingUuid) {
      setPendingDelete(null);
    }
  }, [deletingUuid]);

  const closeDeleteSuccess = useCallback(() => {
    setDeletedLogId(null);
    setTimeout(() => setFocus('remote-logs-refresh'), 50);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;

    const record = pendingDelete;
    setDeletingUuid(record.uuid);

    try {
      await invoke('delete_logshare_history', { uuid: record.uuid });
      setRecords(current => current.filter(item => item.uuid !== record.uuid));
      setPendingDelete(null);
      setDeletedLogId(record.logId);
    } catch (e) {
      await message(`删除远端日志失败：${String(e)}`, { title: '删除失败', kind: 'error' });
    } finally {
      setDeletingUuid(null);
    }
  }, [pendingDelete]);

  return {
    isOpen,
    records,
    isLoading,
    error,
    nowUnixSeconds,
    deletingUuid,
    pendingDelete,
    deletedLogId,
    load,
    open,
    close,
    requestDelete,
    closeDeleteConfirm,
    closeDeleteSuccess,
    confirmDelete
  };
};
