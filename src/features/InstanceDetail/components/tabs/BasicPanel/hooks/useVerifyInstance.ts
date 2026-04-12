import { useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';

import type {
  MissingRuntime,
  VerifyInstanceRuntimeResult,
} from '../../../../../../hooks/pages/InstanceDetail/useInstanceDetail';

export interface VerifyProgressEventPayload {
  instance_id: string;
  stage: string;
  current: number;
  total: number;
  message?: string;
}

export type VerifyDialogState =
  | 'idle'
  | 'verifying'
  | 'repair'
  | 'repairing'
  | 'clean'
  | 'queued'
  | 'error';

export const useVerifyInstance = (
  instanceId: string,
  onVerifyFiles: () => Promise<VerifyInstanceRuntimeResult>,
  onRepairFiles: (repair: MissingRuntime) => Promise<void>
) => {
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
  const [verifyState, setVerifyState] = useState<VerifyDialogState>('idle');
  const [verifyProgress, setVerifyProgress] = useState({ current: 0, total: 1, message: '' });
  const [verifyResult, setVerifyResult] = useState<VerifyInstanceRuntimeResult | null>(null);
  const [verifyError, setVerifyError] = useState('');

  const resetVerifyDialog = useCallback(() => {
    setVerifyState('idle');
    setVerifyProgress({ current: 0, total: 1, message: '' });
    setVerifyResult(null);
    setVerifyError('');
  }, []);

  const canCloseVerifyDialog = verifyState !== 'verifying' && verifyState !== 'repairing';

  const handleCloseVerifyDialog = useCallback(() => {
    if (!canCloseVerifyDialog) return;
    setIsVerifyDialogOpen(false);
    resetVerifyDialog();
  }, [canCloseVerifyDialog, resetVerifyDialog]);

  const handleStartVerify = useCallback(async () => {
    if (verifyState === 'verifying' || verifyState === 'repairing') return;

    setIsVerifyDialogOpen(true);
    setVerifyState('verifying');
    setVerifyResult(null);
    setVerifyError('');
    setVerifyProgress({ current: 0, total: 1, message: '正在准备校验...' });

    let unlisten: (() => void) | null = null;

    try {
      unlisten = await listen<VerifyProgressEventPayload>('instance-runtime-verify-progress', (event) => {
        const payload = event.payload;
        if (payload.instance_id !== instanceId) return;

        setVerifyProgress({
          current: payload.current ?? 0,
          total: Math.max(payload.total ?? 1, 1),
          message: payload.message || '正在校验文件...',
        });
      });

      const result = await onVerifyFiles();
      setVerifyResult(result);
      setVerifyState(result.needs_repair ? 'repair' : 'clean');
    } catch (error) {
      setVerifyError(error instanceof Error ? error.message : String(error));
      setVerifyState('error');
    } finally {
      if (unlisten) unlisten();
    }
  }, [instanceId, onVerifyFiles, verifyState]);

  const handleConfirmVerifyDialog = useCallback(async () => {
    if (verifyState === 'repair') {
      if (!verifyResult?.repair) {
        setVerifyError('校验结果缺少补全参数，无法继续。');
        setVerifyState('error');
        return;
      }

      try {
        setVerifyState('repairing');
        await onRepairFiles(verifyResult.repair);
        setVerifyState('queued');
      } catch (error) {
        setVerifyError(error instanceof Error ? error.message : String(error));
        setVerifyState('error');
      }
      return;
    }

    if (verifyState === 'clean' || verifyState === 'queued' || verifyState === 'error') {
      handleCloseVerifyDialog();
    }
  }, [verifyState, verifyResult, onRepairFiles, handleCloseVerifyDialog]);

  const verifyBusy = verifyState === 'verifying' || verifyState === 'repairing';
  const verifyPercent = Math.max(
    0,
    Math.min(100, Math.round((verifyProgress.current / Math.max(verifyProgress.total, 1)) * 100))
  );
  const verifyIssues = verifyResult?.issues ?? [];

  return {
    isVerifyDialogOpen,
    verifyState,
    verifyProgress,
    verifyResult,
    verifyError,
    canCloseVerifyDialog,
    verifyBusy,
    verifyPercent,
    verifyIssues,
    handleStartVerify,
    handleCloseVerifyDialog,
    handleConfirmVerifyDialog,
  };
};
