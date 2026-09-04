import React, { useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Terminal,
  Loader2,
  AlertTriangle,
  Bug,
  Activity,
  Check,
  Share2,
  ChevronRight,
  Power,
  Copy,
  FolderOpen,
  X,
  Maximize2,
  Minimize2,
  Trash2,
  Package,
  Lightbulb
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { OreConfirmDialog } from '../../../ui/primitives/OreConfirmDialog';

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useInputAction } from '../../../ui/focus/InputDriver';

import { useGameLogStore } from '../../../store/useGameLogStore';
import { useDownloadStore } from '../../../store/useDownloadStore';
import { OreButton } from '../../../ui/primitives/OreButton';

import { useFocusManager } from '../hooks/useFocusManager';
import { useGameProcessService } from '../hooks/useGameProcessService';
import { useExportService } from '../hooks/useExportService';
import { useLogShare } from '../hooks/useLogShare';
import { TelemetryPanel } from './TelemetryPanel';
import { LogView } from './LogView';
import { LogShareDialog } from './LogShareDialog';
import { formatDiagnosisReport } from '../logic/crashAnalyzer';
import { useScreenDensity } from '../../../hooks/ui/useScreenDensity';

const EMPTY_LOGS: string[] = [];

// Note: useLogService has been moved to <GameLogService /> (always mounted in App.tsx).
// This component only handles UI; focus restoration is done via the isOpen watcher below.

export const GameLogSidebar: React.FC = () => {
  const { t } = useTranslation();
  const density = useScreenDensity();
  const isCompact = density === 'compact';
  const isOpen = useGameLogStore((state) => state.isOpen);
  const setOpen = useGameLogStore((state) => state.setOpen);
  const currentInstanceId = useGameLogStore((state) => state.currentInstanceId);
  const gameState = useGameLogStore((state) => state.gameState);
  const crashReason = useGameLogStore((state) => state.crashReason);
  const crashDiagnosis = useGameLogStore((state) => state.crashDiagnosis);
  const telemetry = useGameLogStore((state) => state.telemetry);
  const clearLogs = useGameLogStore((state) => state.clearLogs);
  // Keep the always-mounted shell independent of high-frequency log batches while closed.
  const logs = useGameLogStore((state) => (isOpen ? state.logs : EMPTY_LOGS));
  const hasDownloadTasks = useDownloadStore((state) => Object.keys(state.tasks).length > 0);
  const isDownloadPopupOpen = useDownloadStore((state) => state.isPopupOpen);
  const isGameTerminated = gameState === 'crashed' || gameState === 'idle';

  const [isMaximized, setIsMaximized] = useState(false);
  const [copiedDiag, setCopiedDiag] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [exportedZipPath, setExportedZipPath] = useState<string | null>(null);
  const [showExportError, setShowExportError] = useState<string | null>(null);
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const [isLogShareOpen, setIsLogShareOpen] = useState(false);
  const [sanitizeBeforeShare, setSanitizeBeforeShare] = useState(true);
  const [includeAiAnalysis, setIncludeAiAnalysis] = useState(false);

  const { restoreFocusToCurrentPage } = useFocusManager(isOpen);
  const { killCurrentGame } = useGameProcessService();

  const closeSidebarAndRestoreFocus = useCallback(() => {
    setOpen(false);
    if (gameState === 'crashed' || gameState === 'idle') {
      clearLogs();
    }
    setTimeout(() => restoreFocusToCurrentPage(), 80);
  }, [restoreFocusToCurrentPage, setOpen, gameState, clearLogs]);

  const openSidebar = useCallback(() => {
    setOpen(true);
  }, [setOpen]);

  // Restore focus when the sidebar is closed externally (e.g. by GameLogService on game-stop).
  const prevIsOpenRef = React.useRef(isOpen);
  useEffect(() => {
    if (prevIsOpenRef.current && !isOpen) {
      setTimeout(() => restoreFocusToCurrentPage(), 80);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, restoreFocusToCurrentPage]);

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

  const onGenerateDiag = async () => {
    try {
      const path = await handleShareZip();
      setExportedZipPath(path);
    } catch (e: unknown) {
      setShowExportError(e instanceof Error ? e.message : String(e));
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

  const onConfirmKill = () => {
    killCurrentGame();
    setShowKillConfirm(false);
  };

  // Y 键直驱：无论焦点在哪里，只要面板打开，按 Y 键直接切换遥测抽屉
  useInputAction('ACTION_Y', () => {
    if (isOpen) setShowTelemetry((prev) => !prev);
  });

  const telemetryItems = [
    { label: 'jvm_uptime', value: telemetry.jvmUptime, desc: t('gameLog.telemetry.jvm', 'JVM 启动时间') },
    { label: 'mod_loader', value: telemetry.loaderInit, desc: t('gameLog.telemetry.mod', 'Mod 加载时间') },
    { label: 'resource', value: telemetry.resourceLoad, desc: t('gameLog.telemetry.resource', '资源加载时间') },
    { label: 'render', value: telemetry.renderInit, desc: t('gameLog.telemetry.render', '渲染初始化时间') },
    { label: 'total', value: telemetry.totalStartup, desc: t('gameLog.telemetry.total', '总计耗时') },
  ];

  const shouldShowFloatingLogButton =
    !isOpen &&
    !isDownloadPopupOpen &&
    (gameState === 'launching' || gameState === 'running' || gameState === 'crashed');

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed top-0 right-0 h-full bg-[#141415] border-l-[3px] border-[#1E1E1F] shadow-2xl z-[90] flex flex-col font-minecraft transition-all duration-200 ${
              isMaximized
                ? 'w-screen'
                : isCompact
                ? 'w-screen'
                : 'w-[min(1080px,94vw)] xl:w-[min(1240px,88vw)] 2xl:w-[min(1420px,82vw)]'
            }`}
          >
            <FocusBoundary
              id="game-log-sidebar"
              trapFocus={isOpen}
              onEscape={closeSidebarAndRestoreFocus}
              className="flex flex-col h-full min-h-0 outline-none"
            >
              {/* Header */}
              <div
                onDoubleClick={() => !isCompact && setIsMaximized((prev) => !prev)}
                className="h-13 bg-[#1E1E1F] border-b border-white/[0.08] flex items-center justify-between px-4 shrink-0 shadow-sm z-20 select-none cursor-default"
              >
                <div className="flex items-center text-white">
                  <Terminal size={18} className="mr-2 text-ore-green" />
                  <span className="font-bold tracking-wide">{t('gameLog.sidebar.title', '控制台与日志')}</span>
                  <div className="ml-4 flex items-center">
                    {gameState === 'launching' && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-sm flex items-center">
                        <Loader2 size={12} className="mr-1 animate-spin" /> {t('gameLog.sidebar.initializing', '初始化中')}
                      </span>
                    )}
                    {gameState === 'running' && (
                      <span className="text-xs bg-ore-green/20 text-ore-green px-2 py-0.5 rounded-sm flex items-center">
                        <span className="w-1.5 h-1.5 bg-ore-green rounded-full mr-1.5 animate-pulse" /> {t('gameLog.sidebar.running', '运行中')}
                      </span>
                    )}
                    {gameState === 'crashed' && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-sm flex items-center">
                        <Bug size={12} className="mr-1" /> {t('gameLog.sidebar.crashed', '已崩溃')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <FocusItem focusKey="log-btn-telemetry" onEnter={() => setShowTelemetry(!showTelemetry)}>
                    {({ ref, focused }) => (
                      <button
                        ref={ref as React.Ref<HTMLButtonElement>}
                        type="button"
                        onClick={() => setShowTelemetry(!showTelemetry)}
                        className={`flex items-center outline-none text-xs px-2 py-1.5 rounded-sm transition-colors ${
                          showTelemetry ? 'bg-white/10 text-white' : 'text-ore-text-muted hover:text-white hover:bg-white/5'
                        } ${focused ? 'ring-2 ring-white scale-105 bg-white/10' : ''}`}
                      >
                        <Activity size={14} className="mr-1.5" />
                        <span className="[.intent-controller_&]:hidden">{t('gameLog.sidebar.telemetry', '性能遥测')}</span>
                        <span className="hidden [.intent-controller_&]:flex items-center gap-1.5">
                          {t('gameLog.sidebar.telemetry', '性能遥测')}{' '}
                          <div className="w-3.5 h-3.5 rounded-full bg-[#EAB308] text-black flex items-center justify-center text-[9px] font-bold">
                            Y
                          </div>
                        </span>
                      </button>
                    )}
                  </FocusItem>

                  {!isCompact && (
                    <FocusItem focusKey="log-btn-maximize" onEnter={() => setIsMaximized((prev) => !prev)}>
                      {({ ref, focused }) => (
                        <button
                          ref={ref as React.Ref<HTMLButtonElement>}
                          type="button"
                          aria-label={isMaximized ? t('gameLog.sidebar.restore', '还原') : t('gameLog.sidebar.maximize', '最大化')}
                          title={isMaximized ? t('gameLog.sidebar.restore', '还原') : t('gameLog.sidebar.maximize', '最大化')}
                          onClick={() => setIsMaximized((prev) => !prev)}
                          className={`flex h-8 w-8 items-center justify-center rounded-sm text-ore-text-muted outline-none transition-colors hover:bg-white/5 hover:text-white ${
                            focused ? 'ring-2 ring-white scale-105 bg-white/10 text-white' : ''
                          }`}
                        >
                          {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                      )}
                    </FocusItem>
                  )}

                  <FocusItem focusKey="log-btn-close" onEnter={closeSidebarAndRestoreFocus}>
                    {({ ref, focused }) => (
                      <button
                        ref={ref as React.Ref<HTMLButtonElement>}
                        type="button"
                        aria-label={t('common.close', '关闭')}
                        title={t('common.close', '关闭')}
                        onClick={closeSidebarAndRestoreFocus}
                        className={`flex h-8 w-8 items-center justify-center rounded-sm text-ore-text-muted outline-none transition-colors hover:bg-white/5 hover:text-white ${
                          focused ? 'ring-2 ring-white scale-105 bg-white/10 text-white' : ''
                        }`}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </FocusItem>
                </div>
              </div>

              {/* Main log content area */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
                <TelemetryPanel showTelemetry={showTelemetry} telemetryItems={telemetryItems} />

                <AnimatePresence>
                  {gameState === 'launching' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="relative shrink-0 w-full bg-blue-600/10 border-b border-blue-500/30 overflow-hidden z-10"
                    >
                      <div className="p-2 flex items-center justify-center text-blue-400 text-xs bg-[#0F172A]/80">
                        <Loader2 size={14} className="mr-2 animate-spin" />
                        {t('gameLog.sidebar.pipelineWait', '建立日志管道并启动虚拟机，请稍候...')}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {gameState === 'crashed' && (crashDiagnosis || crashReason) && (
                  <div className="shrink-0 bg-gradient-to-r from-red-950/70 via-red-950/45 to-[#141415] border-b border-red-900/60 p-4 relative z-10 select-text">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-sm bg-red-900/40 border border-red-700/50 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                          <AlertTriangle size={18} className="text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-red-300 font-bold text-sm tracking-wide">
                              {crashDiagnosis ? crashDiagnosis.title : t('gameLog.sidebar.autoDiag', '自动诊断报告')}
                            </h4>
                            {crashDiagnosis?.category && (
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-xs bg-red-900/60 text-red-200 border border-red-700/50">
                                {crashDiagnosis.category}
                              </span>
                            )}
                            {crashDiagnosis?.extractedDetail && (
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded-xs bg-amber-500/15 text-amber-200 border border-amber-500/30 truncate max-w-[320px]">
                                {crashDiagnosis.extractedDetail}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-red-200/90 leading-relaxed break-words">
                            {crashDiagnosis ? crashDiagnosis.description : crashReason}
                          </p>

                          {crashDiagnosis?.solution && (
                            <div className="mt-2 flex items-start gap-2 p-2.5 rounded-sm bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs leading-relaxed">
                              <Lightbulb size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold text-emerald-300 mr-1.5">建议排查方案:</span>
                                <span>{crashDiagnosis.solution}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <OreButton
                        focusKey="log-btn-copy-diag"
                        variant={copiedDiag ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => {
                          const reportText = crashDiagnosis
                            ? formatDiagnosisReport(crashDiagnosis)
                            : String(crashReason);
                          void navigator.clipboard.writeText(reportText);
                          setCopiedDiag(true);
                          setTimeout(() => setCopiedDiag(false), 2000);
                        }}
                        className="shrink-0 text-xs mt-0.5 min-w-[96px] justify-center transition-all"
                      >
                        {copiedDiag ? <Check size={13} className="mr-1 shrink-0" /> : <Copy size={13} className="mr-1 shrink-0" />}
                        <span>{copiedDiag ? t('gameLog.sidebar.diagCopied', '已复制') : t('gameLog.sidebar.copyDiag', '复制诊断')}</span>
                      </OreButton>
                    </div>
                  </div>
                )}

                <LogView logs={logs} isOpen={isOpen} />
              </div>

              {/* Bottom footer bar */}
              <div className="h-14 bg-[#1E1E1F] border-t border-white/[0.08] flex items-center justify-between px-4 shrink-0 shadow-sm z-20">
                <div className="text-xs text-ore-text-muted flex items-center select-none font-mono">
                  <span className="inline-block w-2 h-2 rounded-full bg-ore-green animate-pulse mr-2" />
                  {t('gameLog.sidebar.linesCaptured', '{{count}} Lines captured', { count: logs.length })}
                </div>
                <div className="flex items-center space-x-2">
                  <OreButton
                    focusKey="log-btn-copyall"
                    variant={copiedAll ? 'primary' : 'secondary'}
                    size="sm"
                    disabled={logs.length === 0}
                    onClick={handleCopyAll}
                    className="min-w-[102px] justify-center transition-all"
                  >
                    {copiedAll ? <Check size={14} className="mr-1 shrink-0" /> : <Copy size={14} className="mr-1 shrink-0" />}
                    <span>{copiedAll ? t('gameLog.sidebar.copied', '已复制') : t('gameLog.sidebar.copyAll', '复制全部')}</span>
                  </OreButton>

                  <OreButton
                    focusKey="log-btn-clear"
                    variant="secondary"
                    size="sm"
                    disabled={logs.length === 0}
                    onClick={clearLogs}
                    title={t('gameLog.sidebar.clear', '清屏')}
                  >
                    <Trash2 size={14} className="mr-1" />
                    {t('gameLog.sidebar.clear', '清屏')}
                  </OreButton>

                  <OreButton
                    focusKey="log-btn-share-online"
                    variant={gameState === 'crashed' ? 'primary' : 'secondary'}
                    size="sm"
                    disabled={logs.length === 0 || isSharing}
                    onClick={handleOpenLogShare}
                  >
                    {isSharing ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Share2 size={14} className="mr-1" />}
                    {isSharing ? t('gameLog.shareDialog.uploading', '上传中...') : t('gameLog.shareDialog.upload', '上传日志')}
                  </OreButton>

                  <OreButton
                    focusKey="log-btn-zip"
                    variant="secondary"
                    size="sm"
                    disabled={isExporting}
                    onClick={onGenerateDiag}
                  >
                    {isExporting ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Package size={14} className="mr-1" />}
                    {isExporting ? t('gameLog.sidebar.packing', '打包中...') : t('gameLog.sidebar.diagPack', '诊断包')}
                  </OreButton>

                  {(gameState === 'launching' || gameState === 'running') && (
                    <OreButton
                      focusKey="log-btn-kill"
                      variant="danger"
                      size="sm"
                      onClick={() => setShowKillConfirm(true)}
                    >
                      <Power size={14} className="mr-1" /> {t('gameLog.sidebar.killProcess', '结束进程')}
                    </OreButton>
                  )}

                  <div className="w-px h-4 bg-white/10 mx-1" />

                  <OreButton
                    focusKey={isGameTerminated ? 'log-btn-close-panel' : 'log-btn-hide-panel'}
                    variant="primary"
                    size="md"
                    onClick={closeSidebarAndRestoreFocus}
                  >
                    {isGameTerminated ? (
                      <>
                        {t('gameLog.sidebar.closePanel', '关闭面板')} <X size={16} className="ml-1" />
                      </>
                    ) : (
                      <>
                        {t('gameLog.sidebar.hidePanel', '隐藏面板')} <ChevronRight size={16} className="ml-1" />
                      </>
                    )}
                  </OreButton>
                </div>
              </div>
            </FocusBoundary>
          </motion.div>
        )}
      </AnimatePresence>

      <GameLogFloatingButton
        isVisible={shouldShowFloatingLogButton}
        hasDownloadTasks={hasDownloadTasks}
        gameState={gameState}
        logCount={logs.length}
        onClick={openSidebar}
        title={t('gameLog.sidebar.title', '控制台与日志')}
      />

      <LogShareDialog
        isOpen={isLogShareOpen}
        logCount={logs.length}
        report={shareReport}
        error={shareError}
        isSharing={isSharing}
        sanitize={sanitizeBeforeShare}
        includeAiAnalysis={includeAiAnalysis}
        copiedShareUrl={copiedShareUrl}
        onSanitizeChange={setSanitizeBeforeShare}
        onIncludeAiAnalysisChange={setIncludeAiAnalysis}
        onShare={handleShareLogs}
        onCopyUrl={() => {
          void copyShareUrl();
        }}
        onOpenUrl={openShareUrl}
        onClose={() => setIsLogShareOpen(false)}
      />

      <OreConfirmDialog
        isOpen={!!exportedZipPath}
        onClose={() => setExportedZipPath(null)}
        onConfirm={() => setExportedZipPath(null)}
        title={t('gameLog.sidebar.exportSuccessTitle', '生成成功')}
        headline={t('gameLog.sidebar.exportSuccessHeadline', '完整的诊断包已成功生成')}
        description={<div className="break-all">{exportedZipPath}</div>}
        confirmLabel={t('common.finish', '完成')}
        confirmVariant="primary"
        tone="info"
        hideCancelButton
        tertiaryAction={{
          label: t('gameLog.sidebar.openFolder', '打开所在目录'),
          onClick: handleOpenZipFolder,
          icon: <FolderOpen size={16} className="mr-1" />,
          variant: 'secondary'
        }}
      />

      <OreConfirmDialog
        isOpen={!!showExportError}
        onClose={() => setShowExportError(null)}
        onConfirm={() => setShowExportError(null)}
        title={t('gameLog.sidebar.exportFailTitle', '生成失败')}
        headline={t('gameLog.sidebar.exportFailHeadline', '诊断包打包发生异常')}
        description={showExportError}
        confirmLabel={t('common.ok', '确定')}
        confirmVariant="primary"
        tone="danger"
        hideCancelButton
      />

      <OreConfirmDialog
        isOpen={showKillConfirm}
        onClose={() => setShowKillConfirm(false)}
        onConfirm={onConfirmKill}
        title={t('gameLog.sidebar.killWarnTitle', '安全警告')}
        headline={t('gameLog.sidebar.killWarnHeadline', '确定要强制终止游戏吗？')}
        description={t('gameLog.sidebar.killWarnDesc', '强行关闭进程可能导致当前游戏世界的存档损坏，或者造成未保存的数据丢失。仅在游戏完全无响应（卡死）时使用此功能。')}
        confirmLabel={t('gameLog.sidebar.killConfirm', '强制结束')}
        cancelLabel={t('gameLog.sidebar.killCancel', '取消')}
        confirmVariant="danger"
        tone="danger"
      />
    </>
  );
};

interface GameLogFloatingButtonProps {
  isVisible: boolean;
  hasDownloadTasks: boolean;
  gameState: 'idle' | 'launching' | 'running' | 'crashed';
  logCount: number;
  title: string;
  onClick: () => void;
}

const GameLogFloatingButton: React.FC<GameLogFloatingButtonProps> = ({
  isVisible,
  hasDownloadTasks,
  gameState,
  logCount,
  title,
  onClick,
}) => {
  const bottomOffset = hasDownloadTasks
    ? 'calc(clamp(1rem, 2vw, 1.5rem) + clamp(4.75rem, 5vw, 5.75rem))'
    : 'clamp(1rem, 2vw, 1.5rem)';
  const stateClass =
    gameState === 'crashed'
      ? 'border-red-500 text-red-100 hover:border-red-400'
      : gameState === 'launching'
        ? 'border-blue-500 text-blue-100 hover:border-blue-400'
        : 'border-ore-green text-white hover:border-ore-green';
  const badgeClass =
    gameState === 'crashed'
      ? 'bg-red-500 text-white'
      : gameState === 'launching'
        ? 'bg-blue-500 text-white'
        : 'bg-ore-green text-[#1E1E1F]';

  return (
    <AnimatePresence>
      {isVisible && (
        <FocusItem focusKey="btn-floating-game-log" onEnter={onClick} autoScroll={false}>
          {({ ref, focused }) => (
            <motion.button
              ref={ref as React.RefObject<HTMLButtonElement>}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              aria-label={title}
              title={title}
              onClick={onClick}
              className={`fixed right-[clamp(1rem,2vw,1.5rem)] z-[998] flex h-[clamp(3.5rem,4vw,4.5rem)] w-[clamp(3.5rem,4vw,4.5rem)] items-center justify-center rounded-full border-[0.125rem] bg-[#1E1E1F] shadow-lg outline-none transition-all ${stateClass} ${
                focused ? 'scale-105 ring-4 ring-white shadow-[0_0_20px_rgba(255,255,255,0.28)]' : ''
              }`}
              style={{ bottom: bottomOffset }}
            >
              {gameState === 'crashed' ? (
                <Bug className="h-[1.5rem] w-[1.5rem] sm:h-[1.625rem] sm:w-[1.625rem]" />
              ) : gameState === 'launching' ? (
                <Loader2 className="h-[1.5rem] w-[1.5rem] animate-spin sm:h-[1.625rem] sm:w-[1.625rem]" />
              ) : (
                <Terminal className="h-[1.5rem] w-[1.5rem] sm:h-[1.625rem] sm:w-[1.625rem]" />
              )}

              {logCount > 0 && (
                <span className={`absolute -right-[0.25rem] -top-[0.25rem] flex min-h-[1.375rem] min-w-[1.375rem] items-center justify-center rounded-full px-[0.25rem] text-[0.6875rem] font-bold ${badgeClass}`}>
                  {logCount > 999 ? '999+' : logCount}
                </span>
              )}
            </motion.button>
          )}
        </FocusItem>
      )}
    </AnimatePresence>
  );
};
