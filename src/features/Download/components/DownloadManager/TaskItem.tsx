import { invoke } from '@tauri-apps/api/core';
import { memo } from 'react';
import { motion } from 'motion/react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import {
  AlertTriangle,
  Box,
  FileDown,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';

import { useDownloadStore, type DownloadTask } from '../../../../store/useDownloadStore';
import type { TabType } from '../../../../store/useLauncherStore';
import { controlResourceDownload } from '../../logic/downloadTask';
import { OreIconButton } from '../../../../ui/primitives/OreIconButton';
import { OreProgressBar } from '../../../../ui/primitives/OreProgressBar';
import { OreTag, type OreTagVariant } from '../../../../ui/primitives/OreTag';

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
  <div className="flex items-center gap-[0.375rem]">
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
        <div key={stage.key} className="flex items-center gap-[0.375rem]">
          <div className="flex items-center gap-[0.25rem]">
            <div
              className={`h-[0.5rem] w-[0.5rem] rounded-full transition-all duration-300 ${dotClass}`}
            />
            <span
              className={`font-minecraft text-[0.75rem] uppercase tracking-[0.08em] transition-colors duration-300 ${textClass}`}
            >
              {stage.label}
            </span>
          </div>
          {showConnector && (
            <div
              className={`h-[1.5px] w-[1rem] transition-colors duration-300 ${
                isCompleted ? 'bg-ore-green/40' : 'bg-[#58585A]/60'
              }`}
            />
          )}
        </div>
      );
    })}
  </div>
);

const ProgressSummary = ({ task }: { task: DownloadTask }) => {
  if (task.status === 'completed') {
    return <span className="font-minecraft text-[0.75rem] font-bold text-ore-green">已完成</span>;
  }

  if (task.status === 'error') {
    return <span className="font-minecraft text-[0.75rem] font-bold text-red-400">失败</span>;
  }

  const parts: string[] = [];
  if (task.speed) parts.push(task.speed);
  if (task.eta) parts.push(task.eta);

  return (
    <span className="font-mono text-[0.75rem] font-bold tabular-nums text-[var(--ore-downloadDetail-mutedText)]">
      {parts.join(' | ')}
    </span>
  );
};

interface TaskItemProps {
  task: DownloadTask;
  taskCount: number;
  setActiveTab: (tab: TabType) => void;
  removeTask: (id: string) => void;
  onOpenLog: (taskId: string) => void;
  onActionArrowPress: (focusKey: string, direction: string) => boolean;
}

export const TaskItem = memo(({
  task,
  taskCount,
  setActiveTab,
  removeTask,
  onOpenLog,
  onActionArrowPress,
}: TaskItemProps) => {
  const isDone = task.status === 'completed';
  const isError = task.status === 'error';
  const isPaused = task.status === 'paused';
  const isResource = task.taskType === 'resource';
  const isUpdate = task.taskType === 'update';
  const latestLog = task.logs.length > 0 ? task.logs[task.logs.length - 1] : null;
  const canRetry = Boolean(task.retryTask || task.retryAction);

  const handoffFocusInsidePanel = () => {
    if (taskCount <= 1) return;
    if (doesFocusableExist('btn-taskpanel-hide')) {
      setFocus('btn-taskpanel-hide');
    }
  };

  const pipeline = isUpdate ? UPDATE_PIPELINE : isResource ? RESOURCE_PIPELINE : INSTANCE_PIPELINE;

  const statusLabel = isError ? '失败' : isDone ? '完成' : '进行中';
  const visibleStatusLabel = isPaused ? '已暂停' : statusLabel;
  const statusVariant: OreTagVariant = isError
    ? 'error'
    : isDone
      ? 'success'
      : isPaused
        ? 'paused'
        : 'neutral';

  const handleRetry = () => {
    const retryStage = isUpdate
      ? 'CHECKING_UPDATE'
      : isResource
        ? 'DOWNLOADING_MOD'
        : 'VANILLA_CORE';

    useDownloadStore.getState().addOrUpdateTask({
      id: task.id,
      stage: retryStage,
      message: '正在准备重试...',
    });

    if (task.retryTask) {
      task.retryTask().catch((error) => {
        console.error('Retry failed:', error);
        useDownloadStore.getState().addOrUpdateTask({
          id: task.id,
          stage: 'ERROR',
          message: `Retry failed: ${error}`,
        });
      });
      return;
    }

    if (!task.retryAction) return;

    invoke(task.retryAction, { ...task.retryPayload }).catch((error) => {
      console.error('重试失败:', error);
      useDownloadStore.getState().addOrUpdateTask({
        id: task.id,
        stage: 'ERROR',
        message: `重试失败: ${error}`,
      });
    });
  };

  const handlePauseResume = async () => {
    try {
      await controlResourceDownload(task.id, isPaused ? 'resume' : 'pause');
      useDownloadStore.getState().addOrUpdateTask({
        id: task.id,
        status: isPaused ? 'downloading' : 'paused',
        stage: isPaused ? 'DOWNLOADING_MOD' : 'PAUSED',
        current: task.current,
        total: task.total,
        message: isPaused ? 'Resuming download...' : 'Download paused',
      });
    } catch (error) {
      console.error('Resource download control failed:', error);
      useDownloadStore.getState().addOrUpdateTask({
        id: task.id,
        stage: task.stage,
        message: `Operation failed: ${error}`,
      });
    }
  };

  const handleCancel = async () => {
    handoffFocusInsidePanel();
    try {
      if (isResource) {
        await controlResourceDownload(task.id, 'cancel');
      } else {
        await invoke('cancel_instance_deployment', { instanceId: task.id });
      }
      useDownloadStore.getState().cancelTask(task.id);
    } catch (error) {
      console.error('Cancel task failed:', error);
      useDownloadStore.getState().addOrUpdateTask({
        id: task.id,
        stage: task.stage,
        message: `Cancel failed: ${error}`,
      });
    }
  };

  return (
    <motion.div
      role="article"
      aria-label={`下载任务：${task.title}，${visibleStatusLabel}，进度 ${task.progress}%`}
      className={`group relative flex flex-col border bg-[var(--ore-downloadDetail-base)] p-[clamp(0.75rem,1.5vw,0.875rem)] transition-colors ${
        isError ? 'border-[var(--ore-btn-danger-bg)]' : 'border-[var(--ore-downloadDetail-divider)]'
      }`}
      style={{ boxShadow: 'var(--ore-downloadDetail-sectionShadow)' }}
    >
      <div className="mb-[0.375rem] flex items-center justify-between gap-[0.5rem]">
        <div className="flex min-w-0 flex-1 items-center gap-[0.375rem]">
          {isError ? (
            <AlertTriangle className="h-[1.125rem] w-[1.125rem] shrink-0 text-[var(--ore-btn-danger-bg)]" />
          ) : isUpdate ? (
            <RefreshCw className={`h-[1.125rem] w-[1.125rem] shrink-0 ${isDone ? 'text-ore-green' : 'text-ore-text-muted'}`} />
          ) : isResource ? (
            <FileDown className={`h-[1.125rem] w-[1.125rem] shrink-0 ${isDone ? 'text-ore-green' : 'text-ore-text-muted'}`} />
          ) : (
            <Box className={`h-[1.125rem] w-[1.125rem] shrink-0 ${isDone ? 'text-ore-green' : 'text-ore-text-muted'}`} />
          )}

          <span className={`truncate font-minecraft text-[clamp(0.8125rem,1.25vw,0.9375rem)] ${isError ? 'text-red-400' : 'text-white'}`}>
            {task.title}
          </span>

          <OreTag variant={statusVariant} size="sm" weight="bold" className="shrink-0 uppercase tracking-[0.06em]">
            {visibleStatusLabel}
          </OreTag>
        </div>
      </div>

      <div className="mb-[0.375rem]">
        <OreProgressBar
          percent={task.progress}
          label={<ProgressSummary task={task} />}
          className="!px-0 !space-y-[0.25rem]"
        />
      </div>

      <div className="mb-[0.25rem]">
        <PipelineIndicator stages={pipeline} currentStage={task.pipelineStage} isError={isError} />
      </div>

      <div className="mb-[0.375rem] text-[0.75rem] text-[var(--ore-downloadDetail-mutedText)]">
        <span className={isError ? 'text-red-400/80' : ''}>{task.stepText}</span>
      </div>

      <div className="mb-[0.375rem] min-h-[1rem] overflow-hidden">
        {latestLog && (
          <div className="truncate font-mono text-[0.6875rem] leading-[1.4] text-[#6D6D6E]">
            {latestLog}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[0.75rem] border-t border-[var(--ore-downloadDetail-divider)] pt-[0.625rem]">
        <div className="flex min-w-0 items-center gap-[0.5rem]">
          <OreIconButton
            focusKey={`btn-log-${task.id}`}
            variant="ghost"
            icon={<ScrollText className="h-[1rem] w-[1rem]" />}
            label="查看日志"
            onClick={() => onOpenLog(task.id)}
            onArrowPress={(direction) => onActionArrowPress(`btn-log-${task.id}`, direction)}
          />
          <span className="truncate font-mono text-[0.75rem] tabular-nums text-[var(--ore-downloadDetail-mutedText)]">
            {task.logs.length} 条日志
          </span>
        </div>

        <div className="flex min-w-[5rem] items-center justify-end gap-[0.375rem]">
          {!isDone && !isError && !isUpdate && (
            <>
              {isResource && (
                <OreIconButton
                  focusKey={`btn-pause-${task.id}`}
                  variant="ghost"
                  icon={isPaused ? <Play className="h-[1rem] w-[1rem]" /> : <Pause className="h-[1rem] w-[1rem]" />}
                  label={isPaused ? '继续下载' : '暂停下载'}
                  onClick={handlePauseResume}
                  onArrowPress={(direction) => onActionArrowPress(`btn-pause-${task.id}`, direction)}
                />
              )}
              <OreIconButton
                focusKey={`btn-cancel-${task.id}`}
                variant="danger"
                icon={<X className="h-[1rem] w-[1rem]" />}
                label="取消任务"
                onClick={handleCancel}
                onArrowPress={(direction) => onActionArrowPress(`btn-cancel-${task.id}`, direction)}
              />
            </>
          )}

          {isError && (
            <>
              {canRetry && (
                <OreIconButton
                  focusKey={`btn-retry-${task.id}`}
                  variant="primary"
                  icon={<RotateCcw className="h-[1rem] w-[1rem]" />}
                  label="重试任务"
                  onClick={handleRetry}
                  onArrowPress={(direction) => onActionArrowPress(`btn-retry-${task.id}`, direction)}
                />
              )}
              <OreIconButton
                focusKey={`btn-complete-${task.id}`}
                variant="danger"
                icon={<Trash2 className="h-[1rem] w-[1rem]" />}
                label="清除失败任务"
                onClick={() => {
                  handoffFocusInsidePanel();
                  removeTask(task.id);
                }}
                onArrowPress={(direction) => onActionArrowPress(`btn-complete-${task.id}`, direction)}
              />
            </>
          )}

          {isDone && (
            <OreIconButton
              focusKey={`btn-complete-${task.id}`}
              variant={task.taskType === 'instance' ? 'primary' : 'secondary'}
              icon={task.taskType === 'instance'
                ? <Settings2 className="h-[1rem] w-[1rem]" />
                : <X className="h-[1rem] w-[1rem]" />}
              label={task.taskType === 'instance' ? '前往实例配置' : '关闭任务'}
              onClick={() => {
                handoffFocusInsidePanel();
                removeTask(task.id);
                if (task.taskType === 'instance') setActiveTab('instances');
              }}
              onArrowPress={(direction) => onActionArrowPress(`btn-complete-${task.id}`, direction)}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
});

TaskItem.displayName = 'TaskItem';
