import React, { useEffect, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { renderHighlightedLog, defaultHighlightRules } from '../logic/LogHighlighter';

interface LogViewProps {
  logs: string[];
  isOpen: boolean;
}

export const LogView: React.FC<LogViewProps> = ({ logs, isOpen }) => {
  const scrollRef = useRef<HTMLElement | Window | null>(null);
  const [copiedLine, setCopiedLine] = useState<number | null>(null);

  // 右摇杆硬件直驱
  useEffect(() => {
    if (!isOpen) return;
    let rafId: number;
    const pollGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads.find(g => g !== null);
      if (gp && scrollRef.current) {
        const rightStickY = gp.axes[3];
        if (Math.abs(rightStickY) > 0.1 && scrollRef.current instanceof HTMLElement) {
          scrollRef.current.scrollTop += rightStickY * 15;
        }
      }
      rafId = requestAnimationFrame(pollGamepad);
    };
    rafId = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen]);

  const handleCopyLine = (line: string, idx: number) => {
    navigator.clipboard.writeText(line);
    setCopiedLine(idx);
    setTimeout(() => setCopiedLine(null), 2000);
  };

  return (
    <FocusItem focusKey="log-area">
      {({ ref: focusRef, focused }) => (
        <div className="flex-1 overflow-hidden relative flex flex-col">
          <div className={`flex-1 flex flex-col p-3 transition-all duration-200 ${focused ? 'ring-2 ring-inset ring-ore-green/60 bg-white/[0.01]' : ''}`}>
            {logs.length === 0 ? (
              <div className="text-ore-text-muted/50 text-center mt-20 text-sm">Waiting for standard output...</div>
            ) : (
              <Virtuoso
                style={{ flex: 1 }}
                data={logs}
                followOutput="auto"
                scrollerRef={(node) => {
                  if (node && node instanceof HTMLElement) {
                    (scrollRef as any).current = node;
                    (focusRef as any).current = node;
                  }
                }}
                itemContent={(idx, line) => (
                  <div className="group relative font-mono hover:bg-[#1E1E1F] px-2 py-1.5 border-b border-white/[0.03] transition-colors pr-10 text-[13px] leading-relaxed break-all select-text">
                    {renderHighlightedLog(line, defaultHighlightRules)}

                    <button
                      onClick={() => handleCopyLine(line, idx)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-sm transition-all"
                      title={copiedLine === idx ? "已复制！" : "复制此行"}
                    >
                      {copiedLine === idx ? <Check size={14} className="text-ore-green" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
              />
            )}
          </div>

          <AnimatePresence>
            {focused && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
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
  );
};
