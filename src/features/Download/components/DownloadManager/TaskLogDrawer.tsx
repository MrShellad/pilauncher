import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

import type { DownloadTask } from '../../../../store/useDownloadStore';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreIconButton } from '../../../../ui/primitives/OreIconButton';
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
    <div key={`${index}-${log}`} className="mb-[0.125rem] flex items-start gap-[0.5rem]">
      <span className="shrink-0 rounded-[0.1875rem] border border-white/5 bg-black/40 px-[0.25rem] text-[#A0A0A0]">
        {time}
      </span>
      <span className="min-w-0 flex-1 break-words text-gray-300">
        {message.split(LOG_HIGHLIGHT_SPLITTER).map((part, partIndex) => {
          if (LOG_HIGHLIGHT_MATCHER.test(part)) {
            const isErrorPart = /failed|error/i.test(part);
            return (
              <span key={partIndex} className={isErrorPart ? 'font-bold text-red-400' : 'font-bold text-ore-green'}>
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
  onClose: () => void;
}

export const TaskLogDrawer = ({ task, onClose }: TaskLogDrawerProps) => {
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
    <section className="shrink-0 border-t-[0.125rem] border-[var(--ore-border-color)] bg-[#141415]">
      <div className="flex min-w-0 items-center justify-between gap-[0.75rem] border-b border-[var(--ore-downloadDetail-divider)] px-[1rem] py-[0.5rem]">
        <div className="min-w-0">
          <p className="truncate font-minecraft text-[0.8125rem] text-white">{task.title}</p>
          <p className="font-mono text-[0.6875rem] tabular-nums text-[var(--ore-downloadDetail-mutedText)]">
            日志 ({task.logs.length})
          </p>
        </div>
        <OreIconButton
          focusKey={`btn-log-close-${task.id}`}
          variant="ghost"
          onClick={onClose}
          icon={<X className="h-[1rem] w-[1rem]" />}
          label="关闭日志"
        />
      </div>

      <div className="relative h-[min(15rem,32dvh)]">
        <OreOverlayScrollArea
          ref={viewportRef}
          onScroll={handleScroll}
          role="log"
          aria-label={`${task.title} 的下载日志`}
          aria-live="polite"
          aria-relevant="additions text"
          className="h-full overscroll-contain"
          contentClassName="p-[0.75rem] font-mono text-[0.75rem] leading-[1.5]"
          contentSafePaddingRight={12}
        >
          {task.logs.length > 0
            ? task.logs.map((log, index) => renderLogLine(log, index))
            : <p className="text-[var(--ore-downloadDetail-mutedText)]">暂无日志。</p>}
        </OreOverlayScrollArea>

        {unseenLogCount > 0 && (
          <OreButton
            focusKey={`btn-log-latest-${task.id}`}
            variant="primary"
            size="auto"
            onClick={scrollToBottom}
            className="absolute bottom-[0.75rem] left-1/2 !h-[2rem] !min-w-0 -translate-x-1/2 !px-[0.625rem] text-[0.75rem]"
          >
            <span className="flex items-center gap-[0.25rem]">
              <ChevronDown className="h-[0.875rem] w-[0.875rem]" />
              {unseenLogCount} 条新日志
            </span>
          </OreButton>
        )}
      </div>
    </section>
  );
};
