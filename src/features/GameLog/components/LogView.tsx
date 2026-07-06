import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';
import { useEvent } from '../../../hooks/useEvent';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { OreOverlayScrollArea } from '../../../ui/primitives/OreOverlayScrollArea';
import {
  renderHighlightedLog,
  defaultHighlightRules,
  LOG_TIMESTAMP_PATTERN,
} from '../logic/LogHighlighter';

interface LogViewProps {
  logs: string[];
  isOpen: boolean;
}

interface LogSegment {
  id: string;
  startIndex: number;
  lines: string[];
  text: string;
}

const hasTimestamp = (line: string) => new RegExp(LOG_TIMESTAMP_PATTERN.source).test(line);

const renderLogLine = (line: string): React.ReactNode => {
  const timestampPattern = new RegExp(LOG_TIMESTAMP_PATTERN.source, 'g');
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = timestampPattern.exec(line)) !== null) {
    const timestamp = match[0];
    if (match.index > lastIndex) {
      parts.push(renderHighlightedLog(line.slice(lastIndex, match.index), defaultHighlightRules));
    }
    parts.push(
      <span key={`ts-${match.index}`} className="rounded-sm bg-ore-green/10 px-1 font-bold text-ore-green">
        {timestamp}
      </span>
    );
    lastIndex = match.index + timestamp.length;
  }

  if (lastIndex < line.length) {
    parts.push(renderHighlightedLog(line.slice(lastIndex), defaultHighlightRules));
  }

  return parts.length > 0 ? parts : renderHighlightedLog(line, defaultHighlightRules);
};

const segmentLogsByTimestamp = (logs: string[]): LogSegment[] => {
  const segments: LogSegment[] = [];

  logs.forEach((line, index) => {
    if (hasTimestamp(line) || segments.length === 0) {
      segments.push({
        id: `${index}-${line.slice(0, 24)}`,
        startIndex: index,
        lines: [line],
        text: line,
      });
      return;
    }

    const current = segments[segments.length - 1];
    current.lines.push(line);
    current.text += `\n${line}`;
  });

  return segments;
};

export const LogView: React.FC<LogViewProps> = ({ logs, isOpen }) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLElement | Window | null>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [copiedLine, setCopiedLine] = useState<number | null>(null);
  const logSegments = useMemo(() => segmentLogsByTimestamp(logs), [logs]);

  const rowVirtualizer = useVirtualizer({
    count: logSegments.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  // followOutput behavior
  const lastLogsCountRef = useRef(logSegments.length);
  useEffect(() => {
    const parent = parentRef.current;
    if (!parent || logSegments.length === 0) return;

    const isNearBottom = parent.scrollHeight - parent.scrollTop - parent.clientHeight <= 250;
    const isInitialLoad = lastLogsCountRef.current === 0;

    if (isNearBottom || isInitialLoad) {
      rowVirtualizer.scrollToIndex(logSegments.length - 1, {
        align: 'end',
      });
    }

    lastLogsCountRef.current = logSegments.length;
  }, [logSegments.length, rowVirtualizer]);

  useEffect(() => {
    if (!isOpen || logSegments.length === 0) return;

    const scrollToEnd = () => {
      rowVirtualizer.scrollToIndex(logSegments.length - 1, {
        align: 'end',
      });
    };

    scrollToEnd();
    const timer = window.setTimeout(scrollToEnd, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen, logSegments.length, rowVirtualizer]);

  useEvent('ore-controller-scroll', (payload) => {
    if (!isOpen) return;
    if (!(scrollRef.current instanceof HTMLElement)) return;
    const deltaY = payload.deltaY ?? 0;
    if (Math.abs(deltaY) <= 0.1) return;
    scrollRef.current.scrollTop += deltaY;
  });

  const handleCopyLine = (line: string, idx: number) => {
    navigator.clipboard.writeText(line);
    setCopiedLine(idx);
    setTimeout(() => setCopiedLine(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <FocusItem focusKey="log-area">
      {({ ref: focusRef, focused }) => (
        <div className="flex-1 overflow-hidden relative flex flex-col">
          <div className={`flex-1 flex flex-col p-3 transition-all duration-200 ${focused ? 'ring-2 ring-inset ring-ore-green/60 bg-white/[0.01]' : ''}`}>
            {logs.length === 0 ? (
              <div className="text-ore-text-muted/50 text-center mt-20 text-sm">{t('gameLog.view.waiting', '等待标准输出...')}</div>
            ) : (
              <OreOverlayScrollArea
                ref={(node) => {
                  if (node) {
                    (parentRef as any).current = node;
                    (scrollRef as any).current = node;
                    (focusRef as any).current = node;
                  }
                }}
                className="flex-1 custom-scrollbar"
                style={{ overscrollBehaviorY: 'contain' }}
              >
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const idx = virtualRow.index;
                    const segment = logSegments[idx];
                    if (!segment) return null;

                    return (
                      <div
                        key={virtualRow.key}
                        ref={rowVirtualizer.measureElement}
                        data-index={idx}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        className="group relative font-jetbrains hover:bg-[#1E1E1F] px-2 py-1.5 border-b border-white/[0.06] transition-colors pr-10 text-[13px] leading-relaxed break-all select-text"
                      >
                        {segment.lines.map((line, lineIndex) => (
                          <div
                            key={`${segment.startIndex}-${lineIndex}`}
                            className={lineIndex > 0 ? 'pl-4 text-white/90' : ''}
                          >
                            {renderLogLine(line)}
                          </div>
                        ))}

                        <button
                          onClick={() => handleCopyLine(segment.text, idx)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-sm transition-all"
                          title={copiedLine === idx ? t('gameLog.view.copied', '已复制！') : t('gameLog.view.copyLine', '复制此段')}
                        >
                          {copiedLine === idx ? <Check size={14} className="text-ore-green" /> : <Copy size={14} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </OreOverlayScrollArea>
            )}
          </div>

          <AnimatePresence>
            {focused && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-4 right-6 pointer-events-none hidden [.intent-controller_&]:flex items-center gap-2 bg-[#18181B]/95 px-3 py-1.5 rounded-full border border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.8)] z-50"
              >
                <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center border border-white/20 text-[10px] font-bold text-white">RS</div>
                <span className="text-xs text-ore-text-muted">{t('gameLog.view.scrollHint', '上下翻滚日志')}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </FocusItem>
  );
};
