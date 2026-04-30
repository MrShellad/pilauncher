import { useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';

import type {
  MissingRuntime,
  VerifyDialogState,
  VerifyProgressEventPayload,
  VerifyInstanceRuntimeResult,
} from '../schemas/basicPanelSchemas';
import {
  canCloseVerifyState,
  createInitialVerifyProgress,
  createPreparingVerifyProgress,
  getVerifyIssues,
  getVerifyPercent,
  isVerifyStateBusy,
  normalizeVerifyProgress,
} from '../utils/verifyInstanceUtils';

export const useVerifyInstance = (
  instanceId: string,
  onVerifyFiles: () => Promise<VerifyInstanceRuntimeResult>,
  onRepairFiles: (repair: MissingRuntime) => Promise<void>
) => {
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
  const [verifyState, setVerifyState] = useState<VerifyDialogState>('idle');
  const [verifyProgress, setVerifyProgress] = useState(createInitialVerifyProgress);
  const [verifyResult, setVerifyResult] = useState<VerifyInstanceRuntimeResult | null>(null);
  const [verifyError, setVerifyError] = useState('');

  const resetVerifyDialog = useCallback(() => {
    setVerifyState('idle');
    setVerifyProgress(createInitialVerifyProgress());
    setVerifyResult(null);
    setVerifyError('');
  }, []);

  const canCloseVerifyDialog = canCloseVerifyState(verifyState);

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
    setVerifyProgress(createPreparingVerifyProgress());

    let unlisten: (() => void) | null = null;

    try {
      unlisten = await listen<VerifyProgressEventPayload>('instance-runtime-verify-progress', (event) => {
        const payload = event.payload;
        if (payload.instance_id !== instanceId) return;

        setVerifyProgress(normalizeVerifyProgress(
          payload.current,
          payload.total,
          payload.message,
        ));
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

  const verifyBusy = isVerifyStateBusy(verifyState);
  const verifyPercent = getVerifyPercent(verifyProgress);
  const verifyIssues = getVerifyIssues(verifyResult);

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
