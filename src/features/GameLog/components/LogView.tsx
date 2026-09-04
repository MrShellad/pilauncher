import React, { useMemo, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, ArrowDown } from 'lucide-react';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { OreOverlayScrollArea } from '../../../ui/primitives/OreOverlayScrollArea';
import { useScreenDensity } from '../../../hooks/ui/useScreenDensity';
import {
  renderHighlightedLog,
  defaultHighlightRules,
  LOG_TIMESTAMP_PATTERN,
  type LogHighlightRule,
} from '../logic/LogHighlighter';
import { useLogScrollController } from '../hooks/useLogScrollController';
import { LogFilterToolbar, type LogLevel } from './LogFilterToolbar';

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

// 模块级预编译正则表达式，避免虚拟列表单行渲染与分段检测时反复 new RegExp
const TIMESTAMP_TEST_PATTERN = new RegExp(LOG_TIMESTAMP_PATTERN.source);
const TIMESTAMP_GLOBAL_PATTERN = new RegExp(LOG_TIMESTAMP_PATTERN.source, 'g');

const hasTimestamp = (line: string) => TIMESTAMP_TEST_PATTERN.test(line);

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isErrorSegment = (text: string) =>
  /\[ERROR\]|ERROR|FATAL|Exception in thread|at java\.|at net\.minecraft\./i.test(text);

const isWarnSegment = (text: string) =>
  /\[WARN\]|WARN|WARNING/i.test(text);

const isInfoSegment = (text: string) =>
  !isErrorSegment(text) && !isWarnSegment(text);

const renderLogLine = (line: string, rules: LogHighlightRule[]): React.ReactNode => {
  TIMESTAMP_GLOBAL_PATTERN.lastIndex = 0;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TIMESTAMP_GLOBAL_PATTERN.exec(line)) !== null) {
    const timestamp = match[0];
    if (match.index > lastIndex) {
      parts.push(
        <React.Fragment key={`text-${lastIndex}`}>
          {renderHighlightedLog(line.slice(lastIndex, match.index), rules)}
        </React.Fragment>
      );
    }
    parts.push(
      <span key={`ts-${match.index}`} className="rounded-sm bg-ore-green/10 px-1 font-bold text-ore-green">
        {timestamp}
      </span>
    );
    lastIndex = match.index + timestamp.length;
  }

  if (lastIndex < line.length) {
    parts.push(
      <React.Fragment key={`text-end-${lastIndex}`}>
        {renderHighlightedLog(line.slice(lastIndex), rules)}
      </React.Fragment>
    );
  }

  return parts.length > 0 ? parts : renderHighlightedLog(line, rules);
};

const segmentLogsByTimestamp = (logs: string[]): LogSegment[] => {
  if (logs.length === 0) return [];
  const segments: LogSegment[] = [];

  for (let index = 0; index < logs.length; index++) {
    const line = logs[index];
    if (hasTimestamp(line) || segments.length === 0) {
      segments.push({
        id: `${index}-${line.slice(0, 24)}`,
        startIndex: index,
        lines: [line],
        text: line,
      });
      continue;
    }

    const current = segments[segments.length - 1];
    current.lines.push(line);
    current.text += `\n${line}`;
  }

  return segments;
};

export const LogView: React.FC<LogViewProps> = ({ logs, isOpen }) => {
  const { t } = useTranslation();
  const density = useScreenDensity();
  const isTv = density === 'tv';
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const [copiedLine, setCopiedLine] = useState<number | null>(null);

  // 搜索与等级筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLevel, setActiveLevel] = useState<LogLevel>('all');

  const allSegments = useMemo(() => segmentLogsByTimestamp(logs), [logs]);

  // 统计各等级条数
  const { errorCount, warnCount } = useMemo(() => {
    let errs = 0;
    let warns = 0;
    for (const seg of allSegments) {
      if (isErrorSegment(seg.text)) {
        errs++;
      } else if (isWarnSegment(seg.text)) {
        warns++;
      }
    }
    return { errorCount: errs, warnCount: warns };
  }, [allSegments]);

  // 过滤后的段落列表
  const filteredSegments = useMemo(() => {
    let list = allSegments;

    if (activeLevel === 'error') {
      list = list.filter((s) => isErrorSegment(s.text));
    } else if (activeLevel === 'warn') {
      list = list.filter((s) => isWarnSegment(s.text));
    } else if (activeLevel === 'info') {
      list = list.filter((s) => isInfoSegment(s.text));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => s.text.toLowerCase().includes(q));
    }

    return list;
  }, [allSegments, activeLevel, searchQuery]);

  // 匹配数
  const matchCount = searchQuery.trim() ? filteredSegments.length : null;

  // 搜索高亮规则：当存在搜索词时无缝混入高亮规则
  const highlightRules = useMemo(() => {
    if (!searchQuery.trim()) return defaultHighlightRules;
    try {
      return [
        ...defaultHighlightRules,
        {
          pattern: new RegExp(escapeRegExp(searchQuery.trim()), 'gi'),
          className: 'bg-amber-400 text-black px-0.5 rounded-[2px] font-bold shadow-xs',
        },
      ];
    } catch {
      return defaultHighlightRules;
    }
  }, [searchQuery]);

  const rowVirtualizer = useVirtualizer({
    count: filteredSegments.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => isTv ? 60 : 40,
    overscan: 10,
  });

  const totalSize = rowVirtualizer.getTotalSize();
  const { handleScroll, handleWheel, isAutoScroll, scrollToBottom } = useLogScrollController({
    isOpen,
    itemCount: filteredSegments.length,
    totalSize,
    scrollElement,
    virtualizer: rowVirtualizer,
  });

  const handleCopyLine = (line: string, idx: number) => {
    navigator.clipboard.writeText(line);
    setCopiedLine(idx);
    setTimeout(() => setCopiedLine(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full bg-[#121214] overflow-hidden relative">
      {/* 搜索与等级筛选工具栏 */}
      <LogFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeLevel={activeLevel}
        onLevelChange={setActiveLevel}
        errorCount={errorCount}
        warnCount={warnCount}
        matchCount={matchCount}
      />

      {/* 日志主体平铺展示区 */}
      <FocusItem focusKey="log-area">
        {({ ref: focusRef, focused }) => (
          <div
            className={`flex-1 min-h-0 w-full relative flex flex-col outline-none ${
              focused ? 'ring-1 ring-inset ring-ore-green/50' : ''
            }`}
          >
            {filteredSegments.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-ore-text-muted/50 text-xs font-minecraft select-none">
                {logs.length === 0
                  ? t('gameLog.view.waiting', '等待标准输出...')
                  : t('gameLog.filter.noMatches', '无匹配项')}
              </div>
            ) : (
              <OreOverlayScrollArea
                ref={(node) => {
                  if (node) {
                    setScrollElement(node);
                    focusRef.current = node;
                  }
                }}
                onScroll={handleScroll}
                onWheel={handleWheel}
                className="flex-1 min-h-0 w-full h-full"
                viewportClassName="custom-scrollbar"
                contentSafePaddingRight={16}
                safeInsetRight={6}
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
                    const segment = filteredSegments[idx];
                    if (!segment) return null;

                    const isError = isErrorSegment(segment.text);
                    const isWarn = !isError && isWarnSegment(segment.text);
                    const severityBorderClass = isError
                      ? 'border-l-[3px] border-red-500 bg-red-950/20'
                      : isWarn
                      ? 'border-l-[3px] border-amber-500 bg-amber-950/15'
                      : 'border-l-[3px] border-transparent hover:bg-white/[0.02]';

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
                        className={`group relative font-jetbrains pl-0 pr-12 py-1 border-b border-white/[0.04] transition-colors leading-relaxed break-all select-text ${
                          isTv ? 'text-base' : 'text-[13px]'
                        } ${severityBorderClass}`}
                      >
                        <div className="flex items-start">
                          {/* 行号 Gutter：与左侧边缘与代码文本贴合 */}
                          <span className="w-12 shrink-0 text-right pr-2.5 select-none text-[11px] font-mono text-white/25 pt-0.5 tabular-nums border-r border-white/[0.06] mr-2.5">
                            {segment.startIndex + 1}
                          </span>

                          {/* 日志内容：紧密平铺 */}
                          <div className="flex-1 min-w-0 pr-2">
                            {segment.lines.map((line, lineIndex) => (
                              <div
                                key={`${segment.startIndex}-${lineIndex}`}
                                className={lineIndex > 0 ? 'pl-4 text-white/90' : ''}
                              >
                                {renderLogLine(line, highlightRules)}
                              </div>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyLine(segment.text, idx)}
                          className={`absolute right-3 top-1.5 p-1 rounded-sm transition-all min-w-[24px] h-6 flex items-center justify-center ${
                            copiedLine === idx
                              ? 'opacity-100 text-emerald-300 bg-emerald-950/60 border border-emerald-500/50 shadow-xs'
                              : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white hover:bg-white/10'
                          }`}
                          title={copiedLine === idx ? t('gameLog.view.copied', '已复制！') : t('gameLog.view.copyLine', '复制此段')}
                        >
                          {copiedLine === idx ? <Check size={14} className="text-emerald-300 shrink-0" /> : <Copy size={14} className="shrink-0" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </OreOverlayScrollArea>
            )}

            {/* 回到最新日志悬浮指示器 */}
            <AnimatePresence>
              {!isAutoScroll && filteredSegments.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  onClick={scrollToBottom}
                  type="button"
                  className="absolute bottom-3 right-6 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1E1E1F]/95 hover:bg-[#2A2A2D] text-ore-green border border-ore-green/30 shadow-lg text-xs font-minecraft hover:scale-105 active:scale-95 transition-all outline-none backdrop-blur-sm cursor-pointer"
                >
                  <ArrowDown size={14} className="animate-bounce" />
                  <span>{t('gameLog.view.jumpToBottom', '回到最新日志')}</span>
                </motion.button>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {focused && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-3 right-6 pointer-events-none hidden [.intent-controller_&]:flex items-center gap-2 bg-[#18181B]/95 px-3 py-1.5 rounded-full border border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.8)] z-50"
                >
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center border border-white/20 text-[10px] font-bold text-white">
                    RS
                  </div>
                  <span className="text-xs text-ore-text-muted">{t('gameLog.view.scrollHint', '上下翻滚日志')}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </FocusItem>
    </div>
  );
};
