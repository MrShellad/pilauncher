import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { formatDiagnosisReport, type CrashDiagnosis } from '../logic/crashAnalyzer';
import type { GameState } from '../stores/useGameLogStore';
import { useExportService } from './useExportService';
import { useGameProcessService } from './useGameProcessService';
import { useLogShare } from './useLogShare';

interface UseGameLogSidebarActionsOptions {
  currentInstanceId: string | null;
  logs: string[];
  gameState: GameState;
  crashDiagnosis: CrashDiagnosis | null;
  crashReason: string | null;
}

export const useGameLogSidebarActions = ({
  currentInstanceId,
  logs,
  gameState,
  crashDiagnosis,
  crashReason
}: UseGameLogSidebarActionsOptions) => {
  const [copiedDiag, setCopiedDiag] = useState(false);
  const [exportedZipPath, setExportedZipPath] = useState<string | null>(null);
  const [showExportError, setShowExportError] = useState<string | null>(null);
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const [isLogShareOpen, setIsLogShareOpen] = useState(false);
  const [sanitizeBeforeShare, setSanitizeBeforeShare] = useState(true);
  const [includeAiAnalysis, setIncludeAiAnalysis] = useState(false);

  const { killCurrentGame } = useGameProcessService();
  const { isExporting, copiedAll, handleCopyAll, handleShareZip } = useExportService({
    currentInstanceId,
    logs
  });
  const {
    isSharing,
    report: shareReport,
    error: shareError,
    copiedShareUrl,
    shareLogs,
    copyShareUrl,
    openShareUrl,
    resetShare
  } = useLogShare();

  const handleCopyDiagnosis = useCallback(() => {
    const reportText = crashDiagnosis
      ? formatDiagnosisReport(crashDiagnosis)
      : String(crashReason);
    void navigator.clipboard.writeText(reportText);
    setCopiedDiag(true);
    setTimeout(() => setCopiedDiag(false), 2000);
  }, [crashDiagnosis, crashReason]);

  const handleGenerateDiagnostics = async () => {
    try {
      const path = await handleShareZip();
      setExportedZipPath(path);
    } catch (error: unknown) {
      setShowExportError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleOpenZipFolder = useCallback(() => {
    if (exportedZipPath) {
      invoke('open_path_in_file_manager', { path: exportedZipPath })
        .then(() => setExportedZipPath(null))
        .catch((error) => setShowExportError(String(error)));
    }
  }, [exportedZipPath]);

  const handleOpenLogShare = useCallback(() => {
    resetShare();
    setIncludeAiAnalysis(gameState === 'crashed');
    setIsLogShareOpen(true);
  }, [gameState, resetShare]);

  const handleShareLogs = useCallback(() => {
    void shareLogs(logs, {
      sanitize: sanitizeBeforeShare,
      includeInsights: true,
      includeAiAnalysis,
      logType: gameState === 'crashed' ? 'crash' : 'game'
    });
  }, [gameState, includeAiAnalysis, logs, sanitizeBeforeShare, shareLogs]);

  const handleConfirmKill = () => {
    killCurrentGame();
    setShowKillConfirm(false);
  };

  return {
    copiedDiag,
    copiedAll,
    isExporting,
    exportedZipPath,
    showExportError,
    showKillConfirm,
    isLogShareOpen,
    sanitizeBeforeShare,
    includeAiAnalysis,
    isSharing,
    shareReport,
    shareError,
    copiedShareUrl,
    handleCopyDiagnosis,
    handleCopyAll,
    handleGenerateDiagnostics,
    handleOpenZipFolder,
    handleOpenLogShare,
    handleShareLogs,
    copyShareUrl,
    openShareUrl,
    setSanitizeBeforeShare,
    setIncludeAiAnalysis,
    closeLogShare: () => setIsLogShareOpen(false),
    openKillConfirm: () => setShowKillConfirm(true),
    closeKillConfirm: () => setShowKillConfirm(false),
    handleConfirmKill,
    closeExportSuccess: () => setExportedZipPath(null),
    closeExportError: () => setShowExportError(null)
  };
};
