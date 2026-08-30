import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ScrollText } from 'lucide-react';

import type { DownloadTask } from '../../../../store/useDownloadStore';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';

const LOG_HIGHLIGHT_SPLITTER =
  /(\d+\/\d+|\d+%|[\w.-]+\.(?:jar|json|zip|exe|msi)|done|failed|success|error|completed|installer)/gi;
const LOG_HIGHLIGHT_MATCHER =
  /^(\d+\/\d+|\d+%|[\w.-]+\.(?:jar|json|zip|exe|msi)|done|failed|success|error|completed|installer)$/i;

const renderLogLine = (log: string, index: number) => {
  const timeMatch = log.match(/^(\[.*?\])\s(.*)$/);
  const time = timeMatch ? timeMatch[1] : '';
  const message = timeMatch ? timeMatch[2] : log;

  return (
    <div
      key={`${index}-${log}`}
      className="mb-1 flex items-start gap-2 font-['JetBrains_Mono',monospace]"
      style={{ fontFamily: '"JetBrains Mono", monospace' }}
    >
      {time && (
        <span className="shrink-0 border border-white/5 bg-black/50 px-1 text-[#8C8D90] text-[10px]">
          {time}
        </span>
      )}
      <span className="min-w-0 flex-1 break-words text-[#D0D1D4] text-xs">
        {message.split(LOG_HIGHLIGHT_SPLITTER).map((part, partIndex) => {
          if (LOG_HIGHLIGHT_MATCHER.test(part)) {
            const isErrorPart = /failed|error/i.test(part);
            return (
              <span key={partIndex} className={isErrorPart ? 'font-bold text-[#FF9E9E]' : 'font-bold text-[#6CC349]'}>
                {part}
              </span>
            );
          }
          return <span key={partIndex}>{part}</span>;
        })}
      </span>
    </div>
  );
};

interface TaskLogDrawerProps {
  task: DownloadTask;
}

export const TaskLogDrawer: React.FC<TaskLogDrawerProps> = ({ task }) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stickToLatestRef = useRef(true);
  const previousLogCountRef = useRef(task.logs.length);
  const previousLatestLogRef = useRef(task.logs.at(-1) ?? '');
  const [unseenLogCount, setUnseenLogCount] = useState(0);
  const latestLog = task.logs.at(-1) ?? '';

  const scrollToBottom = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    stickToLatestRef.current = true;
    setUnseenLogCount(0);
    viewport.scrollTop = viewport.scrollHeight;
  };

  useEffect(() => {
    const previousLogCount = previousLogCountRef.current;
    const hasNewLatestLog = latestLog !== previousLatestLogRef.current;
    const newLogCount = hasNewLatestLog
      ? Math.max(1, task.logs.length - previousLogCount)
      : 0;
    previousLogCountRef.current = task.logs.length;
    previousLatestLogRef.current = latestLog;

    if (!stickToLatestRef.current) {
      if (newLogCount > 0) setUnseenLogCount((count) => count + newLogCount);
      return;
    }

    requestAnimationFrame(scrollToBottom);
  }, [latestLog, task.logs.length]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    stickToLatestRef.current = distanceFromBottom < 24;
    if (stickToLatestRef.current) setUnseenLogCount(0);
  };

  return (
    <div className="mt-2.5 flex flex-col border-[2px] border-[#1E1E1F] bg-[#141517] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] font-minecraft select-none">
      {/* 终端顶条 */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b-[2px] border-[#1E1E1F] bg-[#222324] px-3 py-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <ScrollText size={13} className="text-[#D0D1D4] shrink-0" />
          <span className="text-xs font-bold text-white ore-text-shadow">实时下载日志</span>
        </div>
        <span
          className="text-[11px] text-[#D0D1D4] shrink-0 font-['JetBrains_Mono',monospace]"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          {task.logs.length} 条记录
        </span>
      </div>

      {/* 终端滚动视口 */}
      <div className="relative h-44">
        <OreOverlayScrollArea
          ref={viewportRef}
          onScroll={handleScroll}
          role="log"
          aria-label={`${task.title} 的下载日志`}
          aria-live="polite"
          aria-relevant="additions text"
          className="h-full overscroll-contain"
          contentClassName="p-2.5 font-['JetBrains_Mono',monospace] text-xs leading-relaxed"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
          contentSafePaddingRight={12}
        >
          {task.logs.length > 0
            ? task.logs.map((log, index) => renderLogLine(log, index))
            : (
              <p
                className="text-[#8C8D90] text-xs font-['JetBrains_Mono',monospace]"
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
              >
                暂无日志内容。
              </p>
            )}
        </OreOverlayScrollArea>

        {unseenLogCount > 0 && (
          <OreButton
            focusKey={`btn-log-latest-${task.id}`}
            variant="primary"
            size="sm"
            onClick={scrollToBottom}
            className="absolute bottom-2.5 left-1/2 -translate-x-1/2 shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
          >
            <span className="flex items-center gap-1.5">
              <ChevronDown className="h-4 w-4" />
              <span>{unseenLogCount} 条新日志</span>
            </span>
          </OreButton>
        )}
      </div>
    </div>
  );
};

export default TaskLogDrawer;