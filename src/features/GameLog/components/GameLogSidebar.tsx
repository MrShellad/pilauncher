// src/features/GameLog/components/GameLogSidebar.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Loader2, AlertTriangle, Bug, Activity, Copy, Check, FileText, Share2, ChevronRight } from 'lucide-react';
import { listen } from '@tauri-apps/api/event'; 
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window';

// ✅ 引入空间导航与输入驱动引擎
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useInputAction } from '../../../ui/focus/InputDriver';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';

import { useGameLogStore } from '../../../store/useGameLogStore';
import { useLauncherStore } from '../../../store/useLauncherStore';
import { renderHighlightedLog, defaultHighlightRules } from '../logic/LogHighlighter';
import { OreButton } from '../../../ui/primitives/OreButton';

export const GameLogSidebar: React.FC = () => {
  const { isOpen, setOpen, currentInstanceId, logs, gameState, crashReason, telemetry } = useGameLogStore();
  const activeTab = useLauncherStore((state) => state.activeTab);
  const scrollRef = useRef<HTMLDivElement>(null);
  const appWindowRef = useRef(getCurrentWindow());
  const lastFocusBeforeOpenRef = useRef<string | null>(null);
  const foregroundLockRef = useRef(false);
  
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [copiedLine, setCopiedLine] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const fallbackFocusKeysByTab = useMemo<Record<string, string[]>>(() => ({
    home: ['play-button', 'instance-button', 'settings-button', 'btn-profile', 'btn-login'],
    instances: ['action-new', 'view-grid', 'view-list'],
    downloads: ['download-search-input', 'download-grid-item-0'],
    settings: [
      'settings-device-name',
      'settings-java-autodetect',
      'settings-download-source-vanilla',
      'btn-add-ms',
      'color-preset-0',
    ],
    'new-instance': ['card-custom', 'btn-back-menu'],
    'instance-detail': [
      'overview-btn-play',
      'basic-input-name',
      'java-entry-point',
      'save-btn-history',
      'mod-btn-history',
      'btn-open-resourcepack-folder',
      'btn-open-shader-folder',
    ],
  }), []);

  const restoreFocusToCurrentPage = useCallback(() => {
    const lastFocus = lastFocusBeforeOpenRef.current;
    if (lastFocus && doesFocusableExist(lastFocus)) {
      setFocus(lastFocus);
      return;
    }

    const candidates = fallbackFocusKeysByTab[activeTab] || [];
    const target = candidates.find((focusKey) => doesFocusableExist(focusKey));
    if (target) setFocus(target);
  }, [activeTab, fallbackFocusKeysByTab]);

  const closeSidebarAndRestoreFocus = useCallback(() => {
    setOpen(false);
    setTimeout(() => restoreFocusToCurrentPage(), 80);
  }, [restoreFocusToCurrentPage, setOpen]);

  const forceLauncherToFront = useCallback(async () => {
    if (foregroundLockRef.current) return;
    foregroundLockRef.current = true;

    const appWindow = appWindowRef.current;
    try {
      const minimized = await appWindow.isMinimized().catch(() => false);
      if (minimized) {
        await appWindow.unminimize().catch(() => undefined);
      }

      await appWindow.show().catch(() => undefined);
      await appWindow.setAlwaysOnTop(true).catch(() => undefined);
      await appWindow.setFocus().catch(() => undefined);
      await appWindow.requestUserAttention(UserAttentionType.Critical).catch(() => undefined);
    } finally {
      setTimeout(() => {
        appWindow.requestUserAttention(null).catch(() => undefined);
        appWindow.setAlwaysOnTop(false).catch(() => undefined);
        foregroundLockRef.current = false;
      }, 900);
    }
  }, []);

  const isMinecraftStoppingLog = useCallback((line: string) => {
    return line.includes('[minecraft/Minecraft]: Stopping!');
  }, []);

  // 1. 日志刷新时的自动滚底
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs, gameState]);

  // ✅ 2. 焦点锁定：当侧边栏打开时，强制将空间焦点拉入日志区域
  useEffect(() => {
    if (isOpen) {
      const currentFocus = getCurrentFocusKey();
      if (currentFocus && currentFocus !== 'SN:ROOT' && !currentFocus.startsWith('log-')) {
        lastFocusBeforeOpenRef.current = currentFocus;
      }

      // 延迟 100ms 等待抽屉动画和 DOM 挂载完成
      const timer = setTimeout(() => setFocus('log-area'), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // ✅ 3. Y 键直驱：无论焦点在哪里，只要面板打开，按 Y 键直接切换遥测抽屉
  useInputAction('ACTION_Y', () => {
    if (isOpen) setShowTelemetry(prev => !prev);
  });

  // ✅ 4. 右摇杆硬件直驱：完美实现手柄原生级滚动
  useEffect(() => {
    if (!isOpen) return;
    let rafId: number;
    const pollGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads.find(g => g !== null);
      if (gp && scrollRef.current) {
        // axes[3] 是标准 Xbox/SteamDeck 手柄的右摇杆 Y 轴
        const rightStickY = gp.axes[3]; 
        // 0.1 死区防漂移
        if (Math.abs(rightStickY) > 0.1) {
          scrollRef.current.scrollTop += rightStickY * 15; 
        }
      }
      rafId = requestAnimationFrame(pollGamepad);
    };
    rafId = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen]);

  useEffect(() => {
    const unlistenLog = listen<string>('game-log', (event) => {
      const store = useGameLogStore.getState();
      const line = event.payload;

      store.addLog(line);

      if (isMinecraftStoppingLog(line)) {
        store.setGameState('idle');
        closeSidebarAndRestoreFocus();
        void forceLauncherToFront();
      }
    });
    const unlistenExit = listen<{code: number}>('game-exit', (event) => {
      const store = useGameLogStore.getState();
      if (event.payload.code !== 0) {
        store.analyzeCrash();
        store.setOpen(true);
        void forceLauncherToFront();
      } else {
        store.setGameState('idle');
      }
    });
    return () => { unlistenLog.then(f => f()); unlistenExit.then(f => f()); };
  }, [closeSidebarAndRestoreFocus, forceLauncherToFront, isMinecraftStoppingLog]); 

  const handleCopyLine = (line: string, idx: number) => {
    navigator.clipboard.writeText(line);
    setCopiedLine(idx);
    setTimeout(() => setCopiedLine(null), 2000);
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleExportTxt = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PiLauncher-Log-${new Date().getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleShareZip = async () => {
    if (!currentInstanceId) return;
    try {
      setIsExporting(true);
      const zipPath = await invoke<string>('export_diagnostics', {
        instanceId: currentInstanceId,
        launcherLogs: logs
      });
      alert(`诊断包生成成功！\n已保存至:\n${zipPath}`);
    } catch (err) {
      alert(`打包失败: ${err}`);
    } finally {
      setIsExporting(false);
    }
  };

  const telemetryItems = [
    { label: 'jvm_uptime', value: telemetry.jvmUptime, desc: 'JVM 启动时间' },
    { label: 'mod_loader', value: telemetry.loaderInit, desc: 'Mod 加载时间' },
    { label: 'resource', value: telemetry.resourceLoad, desc: '资源加载时间' },
    { label: 'render', value: telemetry.renderInit, desc: '渲染初始化时间' },
    { label: 'total', value: telemetry.totalStartup, desc: '总计耗时' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 h-full w-[600px] bg-[#141415] border-l-[3px] border-[#1E1E1F] shadow-2xl z-[99999] flex flex-col font-minecraft"
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
                    {/* ✅ 手柄模式下隐藏文字，展示专属 Y 键提示 */}
                    <span className="[.intent-controller_&]:hidden">性能遥测</span>
                    <span className="hidden [.intent-controller_&]:flex items-center gap-1.5">
                      性能遥测 <div className="w-3.5 h-3.5 rounded-full bg-[#EAB308] text-black flex items-center justify-center text-[9px] font-bold">Y</div>
                    </span>
                  </button>
                )}
              </FocusItem>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden relative">
              <AnimatePresence>
                {showTelemetry && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="bg-[#1E1E1F] border-b border-black/40 overflow-hidden shrink-0 z-10"
                  >
                    <div className="p-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {telemetryItems.map((item, idx) => (
                        <div key={idx} className="bg-[#18181B] p-2 border border-white/5 rounded-sm flex flex-col justify-center">
                          <div className="text-[10px] text-ore-text-muted mb-0.5">{item.desc}</div>
                          <div className={`text-xs font-bold truncate ${item.value ? 'text-ore-green' : 'text-gray-600'}`}>{item.value || 'Wait...'}</div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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

              {/* ✅ 将日志区域改造成 FocusItem 以支持空间导航识别 */}
              <FocusItem focusKey="log-area">
                {({ ref: focusRef, focused }) => (
                  <div className="flex-1 overflow-hidden relative flex flex-col">
                    <div 
                      ref={(node) => {
                        (focusRef as any).current = node;
                        (scrollRef as any).current = node; // 合并两个 Ref
                      }} 
                      className={`flex-1 overflow-y-auto custom-scrollbar p-3 text-[13px] leading-relaxed break-all select-text transition-all duration-200 ${focused ? 'ring-2 ring-inset ring-ore-green/60 bg-white/[0.01]' : ''}`}
                    >
                      {logs.length === 0 ? (
                         <div className="text-ore-text-muted/50 text-center mt-20 text-sm">Waiting for standard output...</div>
                      ) : (
                        logs.map((line, idx) => (
                          <div key={idx} className="group relative font-mono hover:bg-[#1E1E1F] px-2 py-1.5 border-b border-white/[0.03] transition-colors pr-10">
                            {renderHighlightedLog(line, defaultHighlightRules)}
                            
                            <button 
                              onClick={() => handleCopyLine(line, idx)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-sm transition-all"
                              title={copiedLine === idx ? "已复制！" : "复制此行"}
                            >
                              {copiedLine === idx ? <Check size={14} className="text-ore-green" /> : <Copy size={14} />}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    
                    {/* ✅ 当焦点在此区域，并且处于手柄模式时，优雅地浮现右摇杆提示 */}
                    <AnimatePresence>
                      {focused && (
                         <motion.div 
                           initial={{opacity:0, y: 10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:10}} 
                           className="absolute bottom-4 right-6 pointer-events-none hidden [.intent-controller_&]:flex items-center gap-2 bg-[#18181B]/95 px-3 py-1.5 rounded-full border border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.8)] z-50"
                         >
                           <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center border border-white/20 text-[10px] font-bold text-white">RS</div>
                           <span className="text-xs text-ore-text-muted">上下翻滚日志</span>
                         </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </FocusItem>
            </div>

            <div className="h-16 bg-[#1E1E1F] border-t-[3px] border-[#1E1E1F] flex items-center justify-between px-4 shrink-0 shadow-sm z-20">
              <div className="text-xs text-ore-text-muted flex items-center">
                <span className="inline-block w-2 h-2 rounded-full bg-ore-green animate-pulse mr-2"></span>
                {logs.length} Lines captured
              </div>
              <div className="flex items-center space-x-3">
                
                {gameState === 'crashed' && (
                  <FocusItem focusKey="log-btn-copyall" onEnter={handleCopyAll}>
                    {({ ref, focused }) => (
                      <button 
                        ref={ref as any} onClick={handleCopyAll} 
                        className={`flex items-center outline-none text-xs transition-colors ${copiedAll ? 'text-ore-green' : 'text-ore-text-muted hover:text-white'} ${focused ? 'text-white scale-105' : ''}`}
                      >
                        {copiedAll ? <Check size={14} className="mr-1"/> : <Copy size={14} className="mr-1" />}
                        {copiedAll ? '已复制' : '复制全部'}
                      </button>
                    )}
                  </FocusItem>
                )}

                <FocusItem focusKey="log-btn-export" onEnter={handleExportTxt}>
                  {({ ref, focused }) => (
                    <button ref={ref as any} onClick={handleExportTxt} className={`flex items-center outline-none text-xs text-ore-text-muted hover:text-white transition-all ${focused ? 'text-white scale-105' : ''}`}>
                      <FileText size={14} className="mr-1" /> 导出 TXT
                    </button>
                  )}
                </FocusItem>

                <FocusItem focusKey="log-btn-zip" onEnter={handleShareZip}>
                  {({ ref, focused }) => (
                    <button 
                      ref={ref as any} disabled={isExporting} onClick={handleShareZip} 
                      className={`flex items-center outline-none text-xs transition-all ${isExporting ? 'text-blue-500' : 'text-ore-text-muted hover:text-blue-400'} ${focused ? 'text-blue-400 scale-105' : ''}`} 
                    >
                      {isExporting ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Share2 size={14} className="mr-1" />} 
                      {isExporting ? '打包中...' : '生成诊断包'}
                    </button>
                  )}
                </FocusItem>

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
  );
};
