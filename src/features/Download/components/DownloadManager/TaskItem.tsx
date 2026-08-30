import { memo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  AlertTriangle,
  Box,
  Check,
  FileDown,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Settings2,
  Trash2,
  X
} from 'lucide-react';

import { useDownloadStore, type DownloadTask } from '../../../../store/useDownloadStore';
import type { TabType } from '../../../../store/useLauncherStore';
import { controlResourceDownload } from '../../logic/downloadTask';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreProgressBar } from '../../../../ui/primitives/OreProgressBar';
import { OreTag, type OreTagVariant } from '../../../../ui/primitives/OreTag';
import { TaskLogDrawer } from './TaskLogDrawer';

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
  <div className="flex flex-wrap items-center gap-1 font-minecraft">
    {stages.map((stage, index) => {
      const isActive = stage.key === currentStage;
      const isCompleted = currentStage > stage.key;

      let badgeClasses = 'bg-[#313233] text-[#8C8D90] border-[#1E1E1F]';

      if (isError && isActive) {
        badgeClasses = 'bg-[#C33636] text-white border-[#1E1E1F] shadow-[inset_0_-2px_0_#AD1D1D]';
      } else if (isActive) {
        badgeClasses = 'bg-[#3C8527] text-white border-[#1E1E1F] shadow-[inset_0_-2px_0_#1D4D13]';
      } else if (isCompleted) {
        badgeClasses = 'bg-[#244A1B] text-[#6CC349] border-[#1E1E1F]';
      }

      return (
        <div key={stage.key} className="flex items-center gap-1">
          <span
            className={`border-[2px] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeClasses}`}
          >
            {stage.label}
          </span>
          {index < stages.length - 1 && (
            <span className="text-[#8C8D90] text-[10px] font-bold px-0.5">›</span>
          )}
        </div>
      );
    })}
  </div>
);

const ProgressSummary = ({ task }: { task: DownloadTask }) => {
  if (task.status === 'completed') {
    return <span className="font-minecraft text-xs font-bold text-[#6CC349]">已完成</span>;
  }

  if (task.status === 'error') {
    return <span className="font-minecraft text-xs font-bold text-red-400">下载失败</span>;
  }

  const parts: string[] = [];
  if (task.speed) parts.push(task.speed);
  if (task.eta) parts.push(task.eta);

  return (
    <span
      className="text-xs font-bold tabular-nums text-[#D0D1D4] font-['JetBrains_Mono',monospace]"
      style={{ fontFamily: '"JetBrains Mono", monospace' }}
    >
      {parts.length > 0 ? parts.join(' | ') : `${task.progress}%`}
    </span>
  );
};

interface TaskItemProps {
  task: DownloadTask;
  isLogOpen: boolean;
  setActiveTab: (tab: TabType) => void;
  removeTask: (id: string) => void;
  onToggleLog: (taskId: string) => void;
}

export const TaskItem = memo(({
  task,
  isLogOpen,
  setActiveTab,
  removeTask,
  onToggleLog,
}: TaskItemProps) => {
  const isDone = task.status === 'completed';
  const isError = task.status === 'error';
  const isPaused = task.status === 'paused';
  const isResource = task.taskType === 'resource';
  const isUpdate = task.taskType === 'update';
  const latestLog = task.logs.length > 0 ? task.logs[task.logs.length - 1] : null;
  const canRetry = Boolean(task.retryTask || task.retryAction);

  const pipeline = isUpdate ? UPDATE_PIPELINE : isResource ? RESOURCE_PIPELINE : INSTANCE_PIPELINE;

  const statusVariant: OreTagVariant = isError ? 'error' : isPaused ? 'paused' : 'neutral';

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
        message: isPaused ? '正在恢复下载...' : '下载已暂停',
      });
    } catch (error) {
      console.error('Resource download control failed:', error);
      useDownloadStore.getState().addOrUpdateTask({
        id: task.id,
        stage: task.stage,
        message: `操作失败: ${error}`,
      });
    }
  };

  const handleCancel = async () => {
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
        message: `取消失败: ${error}`,
      });
    }
  };

  return (
    <div
      role="article"
      aria-label={`下载任务：${task.title}，进度 ${task.progress}%`}
      className="group relative flex flex-col border-[2px] border-[#1E1E1F] bg-[#48494A] p-3 font-minecraft select-none shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)]"
    >
      {/* 第 1 行：类型图标 + 任务标题 + (仅失败/暂停时的轻量提示标签) (左) | 进度与速度汇总 (右) */}
      <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isError ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#FF9E9E]" />
          ) : isUpdate ? (
            <RefreshCw className="h-4 w-4 shrink-0 text-white" />
          ) : isResource ? (
            <FileDown className="h-4 w-4 shrink-0 text-white" />
          ) : (
            <Box className="h-4 w-4 shrink-0 text-white" />
          )}

          <span className="truncate text-sm font-bold text-white ore-text-shadow">
            {task.title}
          </span>

          {/* 去除多余的完成徽标，仅在失败或暂停时展示专属提示徽标 */}
          {!isDone && (isError || isPaused) && (
            <OreTag variant={statusVariant} size="sm" weight="bold" className="shrink-0 uppercase tracking-wider">
              {isError ? '失败' : '已暂停'}
            </OreTag>
          )}
        </div>

        <div className="shrink-0 text-right">
          <ProgressSummary task={task} />
        </div>
      </div>

      {/* 第 2 行：100% 满宽进度条 */}
      <div className="w-full mb-1.5">
        <OreProgressBar
          percent={task.progress}
          showPercentage={false}
          size="sm"
          className="w-full !px-0 !py-0 !space-y-0"
        />
      </div>

      {/* 第 3 行：流程指示器 (Pipeline) 与步骤说明 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 min-w-0">
        <PipelineIndicator stages={pipeline} currentStage={task.pipelineStage} isError={isError} />
        {task.stepText && (
          <span className={`truncate text-xs text-[#D0D1D4] max-w-[260px] ${isError ? 'text-[#FF9E9E]' : ''}`}>
            {task.stepText}
          </span>
        )}
      </div>

      {/* 单行最新日志条目预览 (未展开日志时简短展示) */}
      {latestLog && !isLogOpen && (
        <div
          className="mb-1.5 truncate text-[11px] text-[#A0A0A0] border-l-2 border-[#1E1E1F] pl-2 bg-black/25 py-0.5 font-['JetBrains_Mono',monospace]"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          {latestLog}
        </div>
      )}

      {/* 第 4 行：底部操作区 (标准 size="sm") */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t-[2px] border-[#1E1E1F] pt-2 mt-0.5">
        {/* 左侧：Toggle 日志按钮 */}
        <div className="flex items-center gap-2">
          <OreButton
            focusKey={`btn-log-${task.id}`}
            variant={isLogOpen ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onToggleLog(task.id)}
          >
            <ScrollText size={14} className="mr-1.5 shrink-0" />
            <span>{isLogOpen ? '收起日志' : `日志 (${task.logs.length})`}</span>
          </OreButton>
        </div>

        {/* 右侧：任务操作控制按钮 (标准 size="sm") */}
        <div className="flex items-center gap-2">
          {/* 进行中 / 暂停 状态下的操作 */}
          {!isDone && !isError && !isUpdate && (
            <>
              {isResource && (
                <OreButton
                  focusKey={`btn-pause-${task.id}`}
                  variant="secondary"
                  size="sm"
                  onClick={handlePauseResume}
                >
                  {isPaused ? (
                    <>
                      <Play size={14} className="mr-1.5 shrink-0" />
                      <span>继续</span>
                    </>
                  ) : (
                    <>
                      <Pause size={14} className="mr-1.5 shrink-0" />
                      <span>暂停</span>
                    </>
                  )}
                </OreButton>
              )}
              <OreButton
                focusKey={`btn-cancel-${task.id}`}
                variant="danger"
                size="sm"
                onClick={handleCancel}
              >
                <X size={14} className="mr-1.5 shrink-0" />
                <span>取消</span>
              </OreButton>
            </>
          )}

          {/* 失败状态下的操作 */}
          {isError && (
            <>
              {canRetry && (
                <OreButton
                  focusKey={`btn-retry-${task.id}`}
                  variant="primary"
                  size="sm"
                  onClick={handleRetry}
                >
                  <RotateCcw size={14} className="mr-1.5 shrink-0" />
                  <span>重试</span>
                </OreButton>
              )}
              <OreButton
                focusKey={`btn-complete-${task.id}`}
                variant="danger"
                size="sm"
                onClick={() => removeTask(task.id)}
              >
                <Trash2 size={14} className="mr-1.5 shrink-0" />
                <span>清除</span>
              </OreButton>
            </>
          )}

          {/* 完成状态下的操作 */}
          {isDone && (
            <>
              {task.taskType === 'instance' ? (
                <OreButton
                  focusKey={`btn-complete-${task.id}`}
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    removeTask(task.id);
                    setActiveTab('instances');
                  }}
                >
                  <Settings2 size={14} className="mr-1.5 shrink-0" />
                  <span>前往实例</span>
                </OreButton>
              ) : (
                <OreButton
                  focusKey={`btn-complete-${task.id}`}
                  variant="secondary"
                  size="sm"
                  onClick={() => removeTask(task.id)}
                >
                  <Check size={14} className="mr-1.5 shrink-0" />
                  <span>完成</span>
                </OreButton>
              )}
            </>
          )}
        </div>
      </div>

      {/* 展开状态下内嵌的日志终端 */}
      {isLogOpen && (
        <TaskLogDrawer task={task} />
      )}
    </div>
  );
});

TaskItem.displayName = 'TaskItem';

export default TaskItem;