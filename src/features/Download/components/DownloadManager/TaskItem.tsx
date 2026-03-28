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
  List,
  RotateCcw,
  Terminal,
  Trash2
} from 'lucide-react';

import { useDownloadStore, type DownloadTask } from '../../../../store/useDownloadStore';
import { OreButton } from '../../../../ui/primitives/OreButton';

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
  const latestLogs = task.logs.slice(-3);

  const titleLength = task.title.length;
  let titleSizeClass = 'text-[clamp(0.75rem,1.2vw,1rem)]';
  if (titleLength > 30) titleSizeClass = 'text-[clamp(0.6875rem,1vw,0.8125rem)] leading-tight';
  else if (titleLength > 20) titleSizeClass = 'text-[clamp(0.75rem,1.1vw,0.875rem)]';

  const handoffFocusInsidePanel = () => {
    if (taskCount <= 1) return;
    if (doesFocusableExist('btn-taskpanel-hide')) {
      setFocus('btn-taskpanel-hide');
    }
  };

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

  return (
    <div
      className={`group relative flex flex-col border bg-[#1E1E1F] p-[0.875rem] transition-colors ${
        isError
          ? 'border-red-500/50 bg-[var(--ore-downloadDetail-surface)]'
          : 'border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-surface)]'
      }`}
      style={{ boxShadow: 'var(--ore-downloadDetail-sectionShadow)' }}
    >
      <div className="mb-[0.625rem] flex items-start justify-between">
        <div className="flex min-w-0 flex-1 items-center space-x-[0.5rem] pr-[1rem]">
          {isError ? (
            <AlertTriangle className="h-[1rem] w-[1rem] shrink-0 text-red-500" />
          ) : isResource ? (
            <FileDown className={`h-[1rem] w-[1rem] shrink-0 ${isDone ? 'text-blue-400' : 'text-ore-text-muted'}`} />
          ) : (
            <Box className={`h-[1rem] w-[1rem] shrink-0 ${isDone ? 'text-ore-green' : 'text-ore-text-muted'}`} />
          )}
          <span className={`truncate font-minecraft ${isError ? 'text-red-400' : 'text-white'} ${titleSizeClass}`}>
            {task.title}
          </span>
        </div>
        <div className={`shrink-0 font-minecraft text-[0.75rem] ${isError ? 'text-red-500' : 'text-[var(--ore-downloadDetail-mutedText)]'}`}>
          {isError ? 'FAILED' : `${task.progress}%`}
        </div>
      </div>

      <div className="mb-[0.625rem] flex justify-between text-[0.6875rem] text-[var(--ore-downloadDetail-mutedText)]">
        <span className={isError ? 'text-red-400/80' : ''}>{task.stepText}</span>
        <span className="font-mono">{task.speed}</span>
      </div>

      <div className="mb-[0.875rem] h-[0.375rem] w-full overflow-hidden rounded-[0.1875rem] bg-[var(--ore-color-background-surface-sunken)]">
        <motion.div
          className={`h-full ${isError ? 'bg-red-500' : (isDone ? (isResource ? 'bg-blue-400' : 'bg-ore-green') : 'bg-white')}`}
          initial={{ width: 0 }}
          animate={{ width: `${task.progress}%` }}
          transition={{ ease: 'linear', duration: 0.5 }}
        />
      </div>

      <div
        className="relative mb-[0.625rem] flex h-[4.25rem] flex-col justify-end overflow-hidden rounded-[0.1875rem] border border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-base)] p-[0.375rem] font-mono text-[0.6875rem] leading-[1.45]"
        style={{ boxShadow: 'var(--ore-downloadDetail-sectionInset)' }}
      >
        <Terminal className="absolute right-[0.375rem] top-[0.375rem] h-[0.75rem] w-[0.75rem] text-[var(--ore-downloadDetail-mutedText)] opacity-40" />
        {latestLogs.map((log, i) => renderLogLine(log, i))}
      </div>

      <div className="mt-[0.5rem] flex items-center justify-between">
        <div className="origin-left">
          <OreButton
            focusKey={`btn-log-${task.id}`}
            variant="ghost"
            size="auto"
            autoScroll={false}
            onClick={() => setShowLogs(!showLogs)}
            className="!min-w-0 !h-[clamp(2.375rem,3vw,2.75rem)] !px-[0.75rem]"
          >
            <div className="flex items-center text-[0.875rem] text-ore-text-muted transition-colors hover:text-white">
              <List className="mr-[0.25rem] h-[0.875rem] w-[0.875rem]" />
              全部日志
              {showLogs ? (
                <ChevronUp className="ml-[0.25rem] h-[0.75rem] w-[0.75rem]" />
              ) : (
                <ChevronDown className="ml-[0.25rem] h-[0.75rem] w-[0.75rem]" />
              )}
            </div>
          </OreButton>
        </div>

        <div className="origin-right flex space-x-[0.5rem]">
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
              className="!min-w-0 !h-[clamp(2.375rem,3vw,2.75rem)] !px-[1rem] text-white"
            >
              <Trash2 className="h-[1rem] w-[1rem]" />
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
                  className="!min-w-0 !h-[clamp(2.375rem,3vw,2.75rem)] !px-[1rem] border-[#4CAF50] bg-ore-green text-[0.875rem] text-black hover:bg-ore-green-hover"
                >
                  <div className="flex items-center font-bold">
                    <RotateCcw className="mr-[0.375rem] h-[1rem] w-[1rem]" />
                    重试
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
                className="!min-w-0 !h-[clamp(2.375rem,3vw,2.75rem)] !px-[1rem] text-[0.875rem]"
                style={isResource ? { backgroundColor: '#3b82f6', borderColor: '#2563eb' } : {}}
              >
                <div className="flex items-center">
                  {isError ? (
                    <Trash2 className="mr-[0.25rem] h-[1rem] w-[1rem]" />
                  ) : (
                    <CheckCircle className="mr-[0.25rem] h-[1rem] w-[1rem]" />
                  )}
                  {isError ? '清除记录' : (isResource ? '关闭' : '前往配置')}
                </div>
              </OreButton>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showLogs && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="custom-scrollbar mt-[0.75rem] h-[9rem] overflow-y-auto rounded-[0.1875rem] border border-[#2A2A2C] bg-[#141415] p-[0.5rem] font-mono text-[0.6875rem] leading-[1.45]"
          >
            {task.logs.map((log, i) => renderLogLine(log, i))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
