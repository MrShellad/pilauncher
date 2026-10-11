import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import {
  saveService,
  type SaveBackupMetadata,
  type SaveRestoreCheckResult,
} from '../logic/saveService';

interface UseSaveRestoreControllerOptions {
  instanceId: string;
  backupMeta: SaveBackupMetadata;
  onConfirmRestore: (payload: { backupId: string; restoreConfigs: boolean }) => Promise<void>;
}

export function useSaveRestoreController({
  instanceId,
  backupMeta,
  onConfirmRestore,
}: UseSaveRestoreControllerOptions) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [verifyResult, setVerifyResult] = useState<SaveRestoreCheckResult | null>(null);
  const [restoreConfigs, setRestoreConfigs] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let focusTimer: number | undefined;

    saveService
      .verifyRestore(instanceId, backupMeta.backupId)
      .then((result) => {
        if (cancelled) return;
        setVerifyResult(result);
        focusTimer = window.setTimeout(() => {
          if (result.canRestoreConfigs) {
            setFocus('save-restore-toggle-configs');
            return;
          }

          setFocus(result.warnings.length > 0 ? 'btn-cancel-restore' : 'btn-confirm-restore');
        }, 60);
      })
      .catch((error) => {
        if (cancelled) return;
        setErrorMessage(String(error));
      })
      .finally(() => {
        if (!cancelled) {
          setIsVerifying(false);
        }
      });

    return () => {
      cancelled = true;
      if (focusTimer !== undefined) {
        window.clearTimeout(focusTimer);
      }
    };
  }, [backupMeta.backupId, instanceId]);

  useEffect(() => {
    let frameId = 0;

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const activeGamepad = gamepads.find((gamepad): gamepad is Gamepad => gamepad !== null);
      const scrollElement = scrollRef.current;

      if (activeGamepad && scrollElement) {
        const rightStickY = activeGamepad.axes[3] ?? 0;
        const deadZone = 0.12;

        if (Math.abs(rightStickY) > deadZone) {
          const scrollSpeed = Math.min(32, Math.max(14, window.innerHeight * 0.016));
          scrollElement.scrollTop += rightStickY * scrollSpeed;
        }
      }

      frameId = window.requestAnimationFrame(pollGamepad);
    };

    frameId = window.requestAnimationFrame(pollGamepad);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  const focusOrder = useMemo(() => {
    if (!verifyResult?.canRestoreConfigs) {
      return ['btn-cancel-restore', 'btn-confirm-restore'];
    }

    return ['save-restore-toggle-configs', 'btn-cancel-restore', 'btn-confirm-restore'];
  }, [verifyResult]);

  const toggleRestoreConfigs = useCallback(() => {
    setRestoreConfigs((value) => !value);
  }, []);

  const handleRestore = useCallback(async () => {
    setErrorMessage(null);

    try {
      await onConfirmRestore({
        backupId: backupMeta.backupId,
        restoreConfigs,
      });
    } catch (error) {
      setErrorMessage(String(error));
    }
  }, [backupMeta.backupId, onConfirmRestore, restoreConfigs]);

  return {
    scrollRef,
    isVerifying,
    verifyResult,
    restoreConfigs,
    errorMessage,
    focusOrder,
    toggleRestoreConfigs,
    handleRestore,
  };
}
