import React, { useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Loader2, AlertTriangle, Bug, Activity, Check, FileText, Share2, ChevronRight, Power, Copy, FolderOpen } from 'lucide-react';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import { OreConfirmDialog } from '../../../ui/primitives/OreConfirmDialog';

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useInputAction } from '../../../ui/focus/InputDriver';

import { useGameLogStore } from '../../../store/useGameLogStore';
import { OreButton } from '../../../ui/primitives/OreButton';

import { useFocusManager } from '../hooks/useFocusManager';
import { useGameProcessService } from '../hooks/useGameProcessService';
import { useExportService } from '../hooks/useExportService';
import { TelemetryPanel } from './TelemetryPanel';
import { LogView } from './LogView';

// Note: useLogService has been moved to <GameLogService /> (always mounted in App.tsx).
// This component only handles UI; focus restoration is done via the isOpen watcher below.

export const GameLogSidebar: React.FC = () => {
  const { isOpen, setOpen, currentInstanceId, logs, gameState, crashReason, telemetry } = useGameLogStore();

  const [showTelemetry, setShowTelemetry] = useState(false);
  const [exportedZipPath, setExportedZipPath] = useState<string | null>(null);
  const [showExportError, setShowExportError] = useState<string | null>(null);
  const [showKillConfirm, setShowKillConfirm] = useState(false);

  const { restoreFocusToCurrentPage } = useFocusManager(isOpen);
  const { killCurrentGame } = useGameProcessService();

  const closeSidebarAndRestoreFocus = useCallback(() => {
    setOpen(false);
    setTimeout(() => restoreFocusToCurrentPage(), 80);
  }, [restoreFocusToCurrentPage, setOpen]);

  // Restore focus when the sidebar is closed externally (e.g. by GameLogService on game-stop).
  const prevIsOpenRef = React.useRef(isOpen);
  useEffect(() => {
    if (prevIsOpenRef.current && !isOpen) {
      setTimeout(() => restoreFocusToCurrentPage(), 80);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, restoreFocusToCurrentPage]);

  const { isExporting, copiedAll, handleCopyAll, handleExportTxt, handleShareZip } = useExportService({
    currentInstanceId,
    logs
  });

  const onGenerateDiag = async () => {
    try {
      const path = await handleShareZip();
      setExportedZipPath(path);
    } catch (e: any) {
      setShowExportError(e.toString());
    }
  };

  const handleOpenZipFolder = useCallback(() => {
    if (exportedZipPath) {
      const dirIndex = Math.max(exportedZipPath.lastIndexOf('\\'), exportedZipPath.lastIndexOf('/'));
      const dir = dirIndex > -1 ? exportedZipPath.substring(0, dirIndex) : exportedZipPath;
      openExternal(dir).catch(console.error);
      setExportedZipPath(null);
    }
  }, [exportedZipPath]);

  const onConfirmKill = () => {
    killCurrentGame();
    setShowKillConfirm(false);
  };

  // Y 键直驱：无论焦点在哪里，只要面板打开，按 Y 键直接切换遥测抽屉
  useInputAction('ACTION_Y', () => {
    if (isOpen) setShowTelemetry(prev => !prev);
  });

  const telemetryItems = [
    { label: 'jvm_uptime', value: telemetry.jvmUptime, desc: 'JVM 启动时间' },
    { label: 'mod_loader', value: telemetry.loaderInit, desc: 'Mod 加载时间' },
    { label: 'resource', value: telemetry.resourceLoad, desc: '资源加载时间' },
    { label: 'render', value: telemetry.renderInit, desc: '渲染初始化时间' },
    { label: 'total', value: telemetry.totalStartup, desc: '总计耗时' },
  ];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-[680px] bg-[#141415] border-l-[3px] border-[#1E1E1F] shadow-2xl z-[90] flex flex-col font-minecraft"
          >
            <FocusBoundary id="game-log-sidebar" trapFocus={isOpen} onEscape={closeSidebarAndRestoreFocus} className="flex flex-col h-full outline-none">

            <div className="h-14 bg-[#1E1E1F] flex items-center justify-between px-4 shrink-0 shadow-sm z-20">
              <div className="flex items-center text-white">
                <Terminal size={18} className="mr-2 text-ore-green" />
                <span className="font-bold tracking-wide">控制台与日志</span>
                <div className="ml-4 flex items-center">
                  {gameState === 'launching' && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-sm flex items-center"><Loader2 size={12} className="mr-1 animate-spin"/> 初始化中</span>}
                  {gameState === 'running' && <span className="text-xs bg-ore-green/20 text-ore-green px-2 py-0.5 rounded-sm flex items-center"><span className="w-1.5 h-1.5 bg-ore-green rounded-full mr-1.5 animate-pulse"/> 运行中</span>}
                  {gameState === 'crashed' && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-sm flex items-center"><Bug size={12} className="mr-1"/> 已崩溃</span>}
                </div>
              </div>

              <FocusItem focusKey="log-btn-telemetry" onEnter={() => setShowTelemetry(!showTelemetry)}>
                {({ ref, focused }) => (
                  <button
                    ref={ref as any}
                    onClick={() => setShowTelemetry(!showTelemetry)}
                    className={`flex items-center outline-none text-xs px-2 py-1.5 rounded-sm transition-colors ${showTelemetry ? 'bg-white/10 text-white' : 'text-ore-text-muted hover:text-white hover:bg-white/5'} ${focused ? 'ring-2 ring-white scale-105 bg-white/10' : ''}`}
                  >
                    <Activity size={14} className="mr-1.5" />
                    <span className="[.intent-controller_&]:hidden">性能遥测</span>
                    <span className="hidden [.intent-controller_&]:flex items-center gap-1.5">
                      性能遥测 <div className="w-3.5 h-3.5 rounded-full bg-[#EAB308] text-black flex items-center justify-center text-[9px] font-bold">Y</div>
                    </span>
                  </button>
                )}
              </FocusItem>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden relative">
              <TelemetryPanel showTelemetry={showTelemetry} telemetryItems={telemetryItems} />

              <AnimatePresence>
                {gameState === 'launching' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="relative shrink-0 w-full bg-blue-600/10 border-b border-blue-500/30 overflow-hidden z-10"
                  >
                    <div className="p-2 flex items-center justify-center text-blue-400 text-xs backdrop-blur-sm">
                      <Loader2 size={14} className="mr-2 animate-spin" />
                      建立日志管道并启动虚拟机，请稍候...
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {gameState === 'crashed' && crashReason && (
                <div className="shrink-0 bg-red-950/40 border-b border-red-900/50 p-4 relative z-10">
                  <div className="flex items-start">
                    <AlertTriangle size={24} className="text-red-500 mr-3 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-red-400 font-bold mb-1">自动诊断报告</h4>
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
                {logs.length} Lines captured
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
                    {copiedAll ? '已复制' : '复制全部'}
                  </OreButton>
                )}

                <OreButton focusKey="log-btn-export" variant="secondary" size="sm" onClick={handleExportTxt}>
                  <FileText size={14} className="mr-1" /> 导出 TXT
                </OreButton>

                <OreButton
                  focusKey="log-btn-zip"
                  variant="secondary"
                  size="sm"
                  disabled={isExporting}
                  onClick={onGenerateDiag}
                >
                  {isExporting ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Share2 size={14} className="mr-1" />}
                  {isExporting ? '打包中...' : '诊断包'}
                </OreButton>

                {(gameState === 'launching' || gameState === 'running') && (
                  <OreButton
                    focusKey="log-btn-kill"
                    variant="danger"
                    size="sm"
                    onClick={() => setShowKillConfirm(true)}
                  >
                    <Power size={14} className="mr-1" /> 结束进程
                  </OreButton>
                )}

                <div className="w-px h-4 bg-white/10 mx-1"></div>

                <OreButton focusKey="log-btn-hide-panel" variant="primary" size="md" onClick={closeSidebarAndRestoreFocus}>
                  隐藏面板 <ChevronRight size={16} className="ml-1" />
                </OreButton>

              </div>
            </div>

          </FocusBoundary>
        </motion.div>
      )}
      </AnimatePresence>

      <OreConfirmDialog
        isOpen={!!exportedZipPath}
        onClose={() => setExportedZipPath(null)}
        onConfirm={() => setExportedZipPath(null)}
        title="生成成功"
        headline="完整的诊断包已成功生成"
        description={<div className="break-all">{exportedZipPath}</div>}
        confirmLabel="完成"
        confirmVariant="primary"
        tone="info"
        hideCancelButton
        tertiaryAction={{
          label: "打开所在目录",
          onClick: handleOpenZipFolder,
          icon: <FolderOpen size={16} className="mr-1" />,
          variant: 'secondary'
        }}
      />

      <OreConfirmDialog
        isOpen={!!showExportError}
        onClose={() => setShowExportError(null)}
        onConfirm={() => setShowExportError(null)}
        title="生成失败"
        headline="诊断包打包发生异常"
        description={showExportError}
        confirmLabel="确定"
        confirmVariant="primary"
        tone="danger"
        hideCancelButton
      />

      <OreConfirmDialog
        isOpen={showKillConfirm}
        onClose={() => setShowKillConfirm(false)}
        onConfirm={onConfirmKill}
        title="安全警告"
        headline="确定要强制终止游戏吗？"
        description="强行关闭进程可能导致当前游戏世界的存档损坏，或者造成未保存的数据丢失。仅在游戏完全无响应（卡死）时使用此功能。"
        confirmLabel="强制结束"
        cancelLabel="取消"
        confirmVariant="danger"
        tone="danger"
      />
    </>
  );
};
