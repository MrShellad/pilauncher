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
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';

import { useDownloadStore, type DownloadTask } from '../../../../store/useDownloadStore';
import { ControlHint } from '../../../../ui/components/ControlHint';
import { useInputAction } from '../../../../ui/focus/InputDriver';
import { OreButton } from '../../../../ui/primitives/OreButton';

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

const UPDATE_PIPELINE = [
  { label: '检查', key: 0 },
  { label: '安装', key: 1 },
  { label: '完成', key: 3 },
];

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
    {stages.map((stage, index) => {
      const isActive = stage.key === currentStage;
      const isCompleted = currentStage > stage.key;
      const showConnector = index < stages.length - 1;

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
            <div
              className={`h-[0.375rem] w-[0.375rem] rounded-full transition-all duration-300 ${dotClass}`}
            />
            <span
              className={`font-minecraft text-[0.625rem] uppercase tracking-[0.08em] transition-colors duration-300 ${textClass}`}
            >
              {stage.label}
            </span>
          </div>
          {showConnector && (
            <div
              className={`h-[1px] w-[0.75rem] transition-colors duration-300 ${
                isCompleted ? 'bg-ore-green/40' : 'bg-[#58585A]/60'
              }`}
            />
          )}
        </div>
      );
    })}
  </div>
);

const renderLogLine = (log: string, index: number) => {
  const timeMatch = log.match(/^(\[.*?\])\s(.*)$/);
  const time = timeMatch ? timeMatch[1] : '';
  const message = timeMatch ? timeMatch[2] : log;
  const highlightRegex =
    /(\d+\/\d+|\d+%|[\w.-]+\.(?:jar|json|zip|exe|msi)|done|failed|success|error|completed|installer)/gi;
  const messageParts = message.split(highlightRegex);

  return (
    <div key={index} className="mb-[0.125rem] flex items-center truncate">
      <span className="mr-[0.5rem] shrink-0 rounded-[0.1875rem] border border-white/5 bg-black/40 px-[0.25rem] text-[#A0A0A0]">
        {time}
      </span>
      <span className="text-gray-300">
        {messageParts.map((part, partIndex) => {
          if (highlightRegex.test(part)) {
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

const ProgressSummary = ({ task }: { task: DownloadTask }) => {
  if (task.status === 'completed') {
    return <span className="font-minecraft text-[0.6875rem] text-ore-green">已完成</span>;
  }

  if (task.status === 'error') {
    return <span className="font-minecraft text-[0.6875rem] text-red-400">失败</span>;
  }

  const parts: string[] = [];
  if (task.total > 0) parts.push(`${task.current} / ${task.total}`);
  if (task.speed && task.speed !== '计算中...') parts.push(task.speed);
  if (task.eta) parts.push(task.eta);

  return (
    <span className="font-mono text-[0.625rem] tabular-nums text-[var(--ore-downloadDetail-mutedText)]">
      {parts.join(' | ')}
    </span>
  );
};

export const TaskItem = ({
  task,
  taskCount,
  setActiveTab,
  removeTask,
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
  const isUpdate = task.taskType === 'update';
  const latestLog = task.logs.length > 0 ? task.logs[task.logs.length - 1] : null;

  useInputAction('ACTION_Y', () => {
    setShowLogs((prev) => !prev);
  });

  const handoffFocusInsidePanel = () => {
    if (taskCount <= 1) return;
    if (doesFocusableExist('btn-taskpanel-hide')) {
      setFocus('btn-taskpanel-hide');
    }
  };

  const pipeline = isUpdate ? UPDATE_PIPELINE : isResource ? RESOURCE_PIPELINE : INSTANCE_PIPELINE;
  const progressBarClass = isError
    ? 'bg-red-500'
    : isDone
      ? isResource
        ? 'bg-blue-400'
        : 'bg-ore-green'
      : 'bg-white';

  const statusLabel = isError ? '失败' : isDone ? '完成' : '进行中';
  const statusColorClass = isError
    ? 'border-red-500/30 bg-red-500/10 text-red-500'
    : isDone
      ? 'border-ore-green/30 bg-ore-green/10 text-ore-green'
      : 'border-white/10 bg-white/5 text-[var(--ore-downloadDetail-mutedText)]';

  const handleRetry = () => {
    useDownloadStore.getState().addOrUpdateTask({
      id: task.id,
      stage: isUpdate ? 'CHECKING_UPDATE' : task.stage,
                      message: '正在准备重试...',
    });

    invoke(task.retryAction!, { ...task.retryPayload }).catch((error) => {
      console.error('重试失败:', error);
      useDownloadStore.getState().addOrUpdateTask({
        id: task.id,
        stage: 'ERROR',
        message: `重试指令发送失败: ${error}`,
      });
    });
  };

  return (
    <div
      className={`group relative flex flex-col border bg-[#141415] p-[0.875rem] transition-colors ${
        isError ? 'border-red-500/50 bg-[#1A1A1B]' : 'border-[var(--ore-downloadDetail-divider)] bg-[#1A1A1B]'
      }`}
      style={{ boxShadow: 'var(--ore-downloadDetail-sectionShadow)' }}
    >
      <div className="mb-[0.5rem] flex items-center justify-between gap-[0.5rem]">
        <div className="flex min-w-0 flex-1 items-center gap-[0.375rem]">
          {isError ? (
            <AlertTriangle className="h-[0.875rem] w-[0.875rem] shrink-0 text-red-500" />
          ) : isUpdate ? (
            <RefreshCw className={`h-[0.875rem] w-[0.875rem] shrink-0 ${isDone ? 'text-ore-green' : 'text-ore-text-muted'}`} />
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

      <div className="mb-[0.5rem] flex items-center gap-[0.5rem]">
        <div className="h-[0.3125rem] flex-1 overflow-hidden rounded-[0.125rem] bg-[var(--ore-color-background-surface-sunken)]">
          <motion.div
            className={`h-full ${progressBarClass}`}
            initial={{ width: 0 }}
            animate={{ width: `${task.progress}%` }}
            transition={{ ease: 'linear', duration: 0.5 }}
          />
        </div>
        <span className={`shrink-0 font-mono text-[0.625rem] tabular-nums ${isError ? 'text-red-400' : 'text-[var(--ore-downloadDetail-mutedText)]'}`}>
          {task.progress}%
        </span>
      </div>

      <div className="mb-[0.375rem]">
        <PipelineIndicator stages={pipeline} currentStage={task.pipelineStage} isError={isError} />
      </div>

      <div className="mb-[0.5rem] text-[0.625rem] text-[var(--ore-downloadDetail-mutedText)]">
        <span className={isError ? 'text-red-400/80' : ''}>{task.stepText}</span>
      </div>

      {latestLog && !showLogs && (
        <div className="mb-[0.375rem] truncate font-mono text-[0.5625rem] leading-[1.4] text-[#6D6D6E]">
          {latestLog}
        </div>
      )}

      <div className="flex items-center justify-between">
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

        <div className="flex items-center gap-[0.375rem]">
          {!isDone && !isError && !isUpdate ? (
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
          ) : isDone || isError ? (
            <>
              {isError && task.retryAction && (
                <OreButton
                  focusKey={`btn-retry-${task.id}`}
                  variant="primary"
                  size="auto"
                  autoScroll={false}
                  onClick={handleRetry}
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
                  if (task.taskType === 'instance' && isDone) {
                    setActiveTab('instances');
                  }
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
                  <span>{isError ? '清除' : task.taskType === 'instance' ? '前往配置' : '关闭'}</span>
                </div>
              </OreButton>
            </>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {showLogs && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="custom-scrollbar mt-[0.5rem] max-h-[9rem] overflow-y-auto rounded-[0.1875rem] border border-[#2A2A2C] bg-[#141415] p-[0.375rem] font-mono text-[0.625rem] leading-[1.45]"
          >
            {task.logs.map((log, index) => renderLogLine(log, index))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
