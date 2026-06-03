import React, { useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Loader2, AlertTriangle, Bug, Activity, Check, Share2, ChevronRight, Power, Copy, FolderOpen, X } from 'lucide-react';
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

// Note: useLogService has been moved to <GameLogService /> (always mounted in App.tsx).
// This component only handles UI; focus restoration is done via the isOpen watcher below.

export const GameLogSidebar: React.FC = () => {
  const { t } = useTranslation();
  const { isOpen, setOpen, currentInstanceId, logs, gameState, crashReason, telemetry, clearLogs } = useGameLogStore();
  const hasDownloadTasks = useDownloadStore((state) => Object.keys(state.tasks).length > 0);
  const isDownloadPopupOpen = useDownloadStore((state) => state.isPopupOpen);
  const isGameTerminated = gameState === 'crashed' || gameState === 'idle';

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
    if (isOpen) setShowTelemetry(prev => !prev);
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
            initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-[820px] bg-[#141415] border-l-[3px] border-[#1E1E1F] shadow-2xl z-[90] flex flex-col font-minecraft"
          >
            <FocusBoundary id="game-log-sidebar" trapFocus={isOpen} onEscape={closeSidebarAndRestoreFocus} className="flex flex-col h-full outline-none">

            <div className="h-14 bg-[#1E1E1F] flex items-center justify-between px-4 shrink-0 shadow-sm z-20">
              <div className="flex items-center text-white">
                <Terminal size={18} className="mr-2 text-ore-green" />
                <span className="font-bold tracking-wide">{t('gameLog.sidebar.title', '控制台与日志')}</span>
                <div className="ml-4 flex items-center">
                  {gameState === 'launching' && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-sm flex items-center"><Loader2 size={12} className="mr-1 animate-spin"/> {t('gameLog.sidebar.initializing', '初始化中')}</span>}
                  {gameState === 'running' && <span className="text-xs bg-ore-green/20 text-ore-green px-2 py-0.5 rounded-sm flex items-center"><span className="w-1.5 h-1.5 bg-ore-green rounded-full mr-1.5 animate-pulse"/> {t('gameLog.sidebar.running', '运行中')}</span>}
                  {gameState === 'crashed' && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-sm flex items-center"><Bug size={12} className="mr-1"/> {t('gameLog.sidebar.crashed', '已崩溃')}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <FocusItem focusKey="log-btn-telemetry" onEnter={() => setShowTelemetry(!showTelemetry)}>
                  {({ ref, focused }) => (
                    <button
                      ref={ref as React.Ref<HTMLButtonElement>}
                      onClick={() => setShowTelemetry(!showTelemetry)}
                      className={`flex items-center outline-none text-xs px-2 py-1.5 rounded-sm transition-colors ${showTelemetry ? 'bg-white/10 text-white' : 'text-ore-text-muted hover:text-white hover:bg-white/5'} ${focused ? 'ring-2 ring-white scale-105 bg-white/10' : ''}`}
                    >
                      <Activity size={14} className="mr-1.5" />
                      <span className="[.intent-controller_&]:hidden">{t('gameLog.sidebar.telemetry', '性能遥测')}</span>
                      <span className="hidden [.intent-controller_&]:flex items-center gap-1.5">
                        {t('gameLog.sidebar.telemetry', '性能遥测')} <div className="w-3.5 h-3.5 rounded-full bg-[#EAB308] text-black flex items-center justify-center text-[9px] font-bold">Y</div>
                      </span>
                    </button>
                  )}
                </FocusItem>

                <FocusItem focusKey="log-btn-close" onEnter={closeSidebarAndRestoreFocus}>
                  {({ ref, focused }) => (
                    <button
                      ref={ref as React.Ref<HTMLButtonElement>}
                      type="button"
                      aria-label={t('common.close', '关闭')}
                      title={t('common.close', '关闭')}
                      onClick={closeSidebarAndRestoreFocus}
                      className={`flex h-8 w-8 items-center justify-center rounded-sm text-ore-text-muted outline-none transition-colors hover:bg-white/5 hover:text-white ${focused ? 'ring-2 ring-white scale-105 bg-white/10 text-white' : ''}`}
                    >
                      <X size={16} />
                    </button>
                  )}
                </FocusItem>
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden relative">
              <TelemetryPanel showTelemetry={showTelemetry} telemetryItems={telemetryItems} />

              <AnimatePresence>
                {gameState === 'launching' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="relative shrink-0 w-full bg-blue-600/10 border-b border-blue-500/30 overflow-hidden z-10"
                  >
                    <div className="p-2 flex items-center justify-center text-blue-400 text-xs bg-[#0F172A]/80">
                      <Loader2 size={14} className="mr-2 animate-spin" />
                      {t('gameLog.sidebar.pipelineWait', '建立日志管道并启动虚拟机，请稍候...')}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {gameState === 'crashed' && crashReason && (
                <div className="shrink-0 bg-red-950/40 border-b border-red-900/50 p-4 relative z-10">
                  <div className="flex items-start">
                    <AlertTriangle size={24} className="text-red-500 mr-3 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-red-400 font-bold mb-1">{t('gameLog.sidebar.autoDiag', '自动诊断报告')}</h4>
                      <p className="text-sm text-red-200/80 leading-relaxed">{crashReason}</p>
                    </div>
                  </div>
                </div>
              )}

              <LogView logs={logs} isOpen={isOpen} />
            </div>

            <div className="h-16 bg-[#1E1E1F] border-t-[3px] border-[#1E1E1F] flex items-center justify-between px-4 shrink-0 shadow-sm z-20">
              <div className="text-xs text-ore-text-muted flex items-center">
                <span className="inline-block w-2 h-2 rounded-full bg-ore-green animate-pulse mr-2"></span>
                {t('gameLog.sidebar.linesCaptured', '{{count}} Lines captured', { count: logs.length })}
              </div>
              <div className="flex items-center space-x-3">

                {gameState === 'crashed' && (
                  <OreButton
                    focusKey="log-btn-copyall"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyAll}
                    style={{ color: copiedAll ? '#4ade80' : undefined }}
                  >
                    {copiedAll ? <Check size={14} className="mr-1"/> : <Copy size={14} className="mr-1" />}
                    {copiedAll ? t('gameLog.sidebar.copied', '已复制') : t('gameLog.sidebar.copyAll', '复制全部')}
                  </OreButton>
                )}

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
                  {isExporting ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Share2 size={14} className="mr-1" />}
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

                <div className="w-px h-4 bg-white/10 mx-1"></div>

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
