import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import {
  AlertTriangle,
  Box,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileDown,
  RotateCcw,
  Trash2
} from 'lucide-react';

import { useDownloadStore, type DownloadTask } from '../../../../store/useDownloadStore';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { ControlHint } from '../../../../ui/components/ControlHint';
import { useInputAction } from '../../../../ui/focus/InputDriver';

// ─── Pipeline Stage Config ───────────────────────────────────────────────────
const INSTANCE_PIPELINE = [
  { label: '下载', key: 0 },
  { label: '处理', key: 1 },
  { label: '补全', key: 2 },
  { label: '完成', key: 3 },
];

const RESOURCE_PIPELINE = [
  { label: '下载', key: 0 },
  { label: '完成', key: 3 },
];

// ─── Pipeline Stage Indicator ────────────────────────────────────────────────
const PipelineIndicator = ({
  stages,
  currentStage,
  isError,
}: {
  stages: typeof INSTANCE_PIPELINE;
  currentStage: number;
  isError: boolean;
}) => (
  <div className="flex items-center gap-[0.25rem]">
    {stages.map((stage, i) => {
      const isActive = stage.key === currentStage;
      const isCompleted = currentStage > stage.key;
      const showConnector = i < stages.length - 1;

      let dotClass = 'bg-[#58585A]';
      let textClass = 'text-[#58585A]';

      if (isError && isActive) {
        dotClass = 'bg-red-500';
        textClass = 'text-red-400';
      } else if (isActive) {
        dotClass = 'bg-ore-green shadow-[0_0_6px_rgba(108,195,73,0.5)]';
        textClass = 'text-white font-bold';
      } else if (isCompleted) {
        dotClass = 'bg-ore-green/60';
        textClass = 'text-ore-green/80';
      }

      return (
        <div key={stage.key} className="flex items-center gap-[0.25rem]">
          <div className="flex items-center gap-[0.25rem]">
            <div className={`h-[0.375rem] w-[0.375rem] rounded-full transition-all duration-300 ${dotClass}`} />
            <span className={`font-minecraft text-[0.625rem] uppercase tracking-[0.08em] transition-colors duration-300 ${textClass}`}>
              {stage.label}
            </span>
          </div>
          {showConnector && (
            <div className={`h-[1px] w-[0.75rem] transition-colors duration-300 ${
              isCompleted ? 'bg-ore-green/40' : 'bg-[#58585A]/60'
            }`} />
          )}
        </div>
      );
    })}
  </div>
);

// ─── Log Line Renderer ───────────────────────────────────────────────────────
const renderLogLine = (log: string, index: number) => {
  const timeMatch = log.match(/^(\[.*?\])\s(.*)$/);
  const time = timeMatch ? timeMatch[1] : '';
  const message = timeMatch ? timeMatch[2] : log;
  const highlightRegex = /(\d+\/\d+|\d+%|[\w.-]+\.(?:jar|json|zip)|完成|失败|成功|异常中断)/g;
  const msgParts = message.split(highlightRegex);

  return (
    <div key={index} className="mb-[0.125rem] flex items-center truncate">
      <span className="mr-[0.5rem] shrink-0 rounded-[0.1875rem] border border-white/5 bg-black/40 px-[0.25rem] text-[#A0A0A0]">
        {time}
      </span>
      <span className="text-gray-300">
        {msgParts.map((part, i) => {
          if (highlightRegex.test(part)) {
            const color = part.includes('失败') || part.includes('异常中断') ? 'text-red-400' : 'text-ore-green';
            return (
              <span key={i} className={`${color} font-bold`}>
                {part}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </span>
    </div>
  );
};

// ─── Compact Progress Text ───────────────────────────────────────────────────
const ProgressSummary = ({ task }: { task: DownloadTask }) => {
  const isDone = task.status === 'completed';
  const isError = task.status === 'error';

  if (isDone) return <span className="text-ore-green font-minecraft text-[0.6875rem]">已完成</span>;
  if (isError) return <span className="text-red-400 font-minecraft text-[0.6875rem]">失败</span>;

  const parts: string[] = [];
  if (task.total > 0) parts.push(`${task.current} / ${task.total}`);
  if (task.speed && task.speed !== '计算中...') parts.push(task.speed);
  if (task.eta) parts.push(task.eta);

  return (
    <span className="font-mono text-[0.625rem] text-[var(--ore-downloadDetail-mutedText)] tabular-nums">
      {parts.join(' · ')}
    </span>
  );
};

// ─── Main TaskItem Component ─────────────────────────────────────────────────
export const TaskItem = ({
  task,
  taskCount,
  setActiveTab,
  removeTask
}: {
  task: DownloadTask;
  taskCount: number;
  setActiveTab: any;
  removeTask: any;
}) => {
  const [showLogs, setShowLogs] = useState(false);

  const isDone = task.status === 'completed';
  const isError = task.status === 'error';
  const isResource = task.taskType === 'resource';
  const latestLog = task.logs.length > 0 ? task.logs[task.logs.length - 1] : null;

  // Y key toggles logs
  useInputAction('ACTION_Y', () => {
    setShowLogs((prev) => !prev);
  });

  const handoffFocusInsidePanel = () => {
    if (taskCount <= 1) return;
    if (doesFocusableExist('btn-taskpanel-hide')) {
      setFocus('btn-taskpanel-hide');
    }
  };

  const pipeline = isResource ? RESOURCE_PIPELINE : INSTANCE_PIPELINE;

  // Status badge
  const statusLabel = isError ? '失败' : isDone ? '完成' : '进行中';
  const statusColorClass = isError
    ? 'text-red-500 bg-red-500/10 border-red-500/30'
    : isDone
      ? 'text-ore-green bg-ore-green/10 border-ore-green/30'
      : 'text-[var(--ore-downloadDetail-mutedText)] bg-white/5 border-white/10';

  return (
    <div
      className={`group relative flex flex-col border bg-[#141415] p-[0.875rem] transition-colors ${
        isError
          ? 'border-red-500/50 bg-[#1A1A1B]'
          : 'border-[var(--ore-downloadDetail-divider)] bg-[#1A1A1B]'
      }`}
      style={{ boxShadow: 'var(--ore-downloadDetail-sectionShadow)' }}
    >
      {/* ─── Row 1: Title + Status + Progress Summary ─── */}
      <div className="mb-[0.5rem] flex items-center justify-between gap-[0.5rem]">
        <div className="flex min-w-0 flex-1 items-center gap-[0.375rem]">
          {isError ? (
            <AlertTriangle className="h-[0.875rem] w-[0.875rem] shrink-0 text-red-500" />
          ) : isResource ? (
            <FileDown className={`h-[0.875rem] w-[0.875rem] shrink-0 ${isDone ? 'text-blue-400' : 'text-ore-text-muted'}`} />
          ) : (
            <Box className={`h-[0.875rem] w-[0.875rem] shrink-0 ${isDone ? 'text-ore-green' : 'text-ore-text-muted'}`} />
          )}

          <span className={`truncate font-minecraft text-[clamp(0.6875rem,1.1vw,0.875rem)] ${isError ? 'text-red-400' : 'text-white'}`}>
            {task.title}
          </span>

          <span className={`shrink-0 rounded-[0.125rem] border px-[0.375rem] py-[0.0625rem] font-minecraft text-[0.5625rem] uppercase tracking-[0.06em] ${statusColorClass}`}>
            {statusLabel}
          </span>
        </div>

        <div className="shrink-0">
          <ProgressSummary task={task} />
        </div>
      </div>

      {/* ─── Row 2: Progress Bar ─── */}
      <div className="mb-[0.5rem] flex items-center gap-[0.5rem]">
        <div className="h-[0.3125rem] flex-1 overflow-hidden rounded-[0.125rem] bg-[var(--ore-color-background-surface-sunken)]">
          <motion.div
            className={`h-full ${isError ? 'bg-red-500' : (isDone ? (isResource ? 'bg-blue-400' : 'bg-ore-green') : 'bg-white')}`}
            initial={{ width: 0 }}
            animate={{ width: `${task.progress}%` }}
            transition={{ ease: 'linear', duration: 0.5 }}
          />
        </div>
        <span className={`shrink-0 font-mono text-[0.625rem] tabular-nums ${isError ? 'text-red-400' : 'text-[var(--ore-downloadDetail-mutedText)]'}`}>
          {task.progress}%
        </span>
      </div>

      {/* ─── Row 3: Pipeline Stage Indicator ─── */}
      <div className="mb-[0.375rem]">
        <PipelineIndicator stages={pipeline} currentStage={task.pipelineStage} isError={isError} />
      </div>

      {/* ─── Row 4: Step Text (auxiliary info) ─── */}
      <div className="mb-[0.5rem] text-[0.625rem] text-[var(--ore-downloadDetail-mutedText)]">
        <span className={isError ? 'text-red-400/80' : ''}>{task.stepText}</span>
      </div>

      {/* ─── Row 5: Latest Log Summary (weak) ─── */}
      {latestLog && !showLogs && (
        <div className="mb-[0.375rem] truncate font-mono text-[0.5625rem] leading-[1.4] text-[#6D6D6E]">
          {latestLog}
        </div>
      )}

      {/* ─── Row 6: Actions ─── */}
      <div className="flex items-center justify-between">
        {/* Left: Log toggle with Y key icon */}
        <div className="flex items-center gap-[0.375rem]">
          <OreButton
            focusKey={`btn-log-${task.id}`}
            variant="ghost"
            size="auto"
            autoScroll={false}
            onClick={() => setShowLogs(!showLogs)}
            className="!min-w-0 !h-[clamp(1.75rem,2.5vw,2.25rem)] !px-[0.5rem]"
          >
            <div className="flex items-center gap-[0.25rem] text-[0.75rem] text-ore-text-muted transition-colors hover:text-white">
              <ControlHint label="Y" variant="face" tone="yellow" className="scale-[0.7] origin-center" />
              <span className="text-[0.625rem]">日志</span>
              {showLogs ? (
                <ChevronUp className="h-[0.625rem] w-[0.625rem]" />
              ) : (
                <ChevronDown className="h-[0.625rem] w-[0.625rem]" />
              )}
            </div>
          </OreButton>
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-[0.375rem]">
          {!isDone && !isError ? (
            <OreButton
              focusKey={`btn-cancel-${task.id}`}
              variant="danger"
              size="auto"
              autoScroll={false}
              onClick={() => {
                handoffFocusInsidePanel();
                invoke('cancel_instance_deployment', { instanceId: task.id }).catch(console.error);
                useDownloadStore.getState().cancelTask(task.id);
              }}
              className="!min-w-0 !h-[clamp(1.75rem,2.5vw,2.25rem)] !px-[0.625rem]"
            >
              <Trash2 className="h-[0.875rem] w-[0.875rem]" />
            </OreButton>
          ) : (
            <>
              {isError && task.retryAction && (
                <OreButton
                  focusKey={`btn-retry-${task.id}`}
                  variant="primary"
                  size="auto"
                  autoScroll={false}
                  onClick={() => {
                    useDownloadStore.getState().addOrUpdateTask({
                      id: task.id,
                      status: 'downloading',
                      stage: task.stage,
                      message: '正在准备重试...'
                    });
                    invoke(task.retryAction!, { ...task.retryPayload }).catch((err) => {
                      console.error('重试失败:', err);
                      useDownloadStore.getState().addOrUpdateTask({
                        id: task.id,
                        status: 'error',
                        stage: 'ERROR',
                        message: `重试指令发送失败: ${err}`
                      });
                    });
                  }}
                  className="!min-w-0 !h-[clamp(1.75rem,2.5vw,2.25rem)] !px-[0.625rem] border-[#4CAF50] bg-ore-green text-[0.75rem] text-black hover:bg-ore-green-hover"
                >
                  <div className="flex items-center gap-[0.25rem] font-bold">
                    <RotateCcw className="h-[0.875rem] w-[0.875rem]" />
                    <span>重试</span>
                  </div>
                </OreButton>
              )}
              <OreButton
                focusKey={`btn-complete-${task.id}`}
                variant={isError ? 'danger' : 'primary'}
                size="auto"
                autoScroll={false}
                onClick={() => {
                  handoffFocusInsidePanel();
                  removeTask(task.id);
                  if (!isResource && isDone) setActiveTab('instances');
                }}
                className="!min-w-0 !h-[clamp(1.75rem,2.5vw,2.25rem)] !px-[0.625rem] text-[0.75rem]"
                style={isResource ? { backgroundColor: '#3b82f6', borderColor: '#2563eb' } : {}}
              >
                <div className="flex items-center gap-[0.25rem]">
                  {isError ? (
                    <Trash2 className="h-[0.875rem] w-[0.875rem]" />
                  ) : (
                    <CheckCircle className="h-[0.875rem] w-[0.875rem]" />
                  )}
                  <span>{isError ? '清除' : (isResource ? '关闭' : '前往配置')}</span>
                </div>
              </OreButton>
            </>
          )}
        </div>
      </div>

      {/* ─── Collapsible Full Logs ─── */}
      <AnimatePresence>
        {showLogs && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="custom-scrollbar mt-[0.5rem] max-h-[9rem] overflow-y-auto rounded-[0.1875rem] border border-[#2A2A2C] bg-[#141415] p-[0.375rem] font-mono text-[0.625rem] leading-[1.45]"
          >
            {task.logs.map((log, i) => renderLogLine(log, i))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
