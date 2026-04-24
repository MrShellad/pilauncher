import { create } from 'zustand';

import { useSettingsStore } from './useSettingsStore';

export interface DownloadTask {
  id: string;
  taskType: 'instance' | 'resource' | 'update';
  title: string;
  status: 'downloading' | 'paused' | 'completed' | 'error';
  stage: string;
  stepText: string;
  progress: number;
  current: number;
  total: number;
  speed: string;
  speedBytes: number;
  eta: string;
  pipelineStage: number;
  logs: string[];
  startedAt: number;
  lastUpdate: number;
  lastCurrent: number;
  speedCurrent?: number;
  lastSpeedUpdate?: number;
  lastSpeedCurrent?: number;
  retryAction?: string;
  retryPayload?: any;
}

interface DownloadStore {
  tasks: Record<string, DownloadTask>;
  isPopupOpen: boolean;
  setPopupOpen: (isOpen: boolean) => void;
  ignoredTasks: Set<string>;
  addOrUpdateTask: (taskUpdate: Partial<DownloadTask> & { id: string; message: string }) => void;
  pauseTask: (id: string) => void;
  cancelTask: (id: string) => void;
  removeTask: (id: string) => void;
}

const FILE_COUNT_PROGRESS_STAGES = new Set(['LIBRARIES', 'ASSETS', 'DOWNLOADING_MOD']);

const PIPELINE_STAGE_MAP: Record<string, number> = {
  CHECKING_UPDATE: 0,
  DOWNLOADING_UPDATE: 0,
  INSTALLING_UPDATE: 1,
  DOWNLOADING_MODPACK: 0,
  VANILLA_CORE: 0,
  LOADER_CORE: 0,
  LIBRARIES: 0,
  DOWNLOADING_MOD: 0,
  DOWNLOADING_RESOURCEPACK: 0,
  DOWNLOADING_SHADER: 0,
  EXTRACTING: 1,
  ASSETS: 2,
  ERROR: -1,
  DONE: 3,
};

const formatSpeed = (
  bytesDiff: number,
  timeDiff: number,
  unit: string,
): { str: string; bytes: number } => {
  if (timeDiff <= 0 || bytesDiff <= 0) {
    return { str: '计算中...', bytes: 0 };
  }

  const bytesPerSec = bytesDiff / timeDiff;
  const speedMBps = bytesPerSec / (1024 * 1024);

  if (unit === 'Mbps') {
    const speedMbps = speedMBps * 8;
    const str =
      speedMbps > 1
        ? `${speedMbps.toFixed(2)} Mbps`
        : `${(speedMbps * 1000).toFixed(2)} Kbps`;
    return { str, bytes: bytesPerSec };
  }

  const str =
    speedMBps > 1
      ? `${speedMBps.toFixed(2)} MB/s`
      : `${(bytesPerSec / 1024).toFixed(2)} KB/s`;
  return { str, bytes: bytesPerSec };
};

const formatElapsed = (elapsedSeconds: number): string => {
  const seconds = Math.max(0, elapsedSeconds);

  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `已耗时 ${hours}小时 ${minutes}分`;
  }

  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `已耗时 ${minutes}分 ${secs}秒`;
  }

  return `已耗时 ${seconds}秒`;
};

const getStageText = (stage: string, taskType: DownloadTask['taskType']): string => {
  const stageMap: Record<string, string> = {
    CHECKING_UPDATE: '正在检查更新元数据',
    DOWNLOADING_UPDATE: '正在下载启动器更新包',
    INSTALLING_UPDATE: '正在启动安装器',
    DOWNLOADING_MODPACK: '步骤 0/6: 获取整合包本体',
    EXTRACTING: '步骤 1/6: 解压整合包资源',
    VANILLA_CORE: '步骤 2/6: 安装游戏主体',
    LOADER_CORE: '步骤 2.5/6: 安装 Loader 环境',
    LIBRARIES: '步骤 3/6: 下载底层运行库',
    ASSETS: '步骤 4/6: 补全原版资源',
    DOWNLOADING_MOD:
      taskType === 'resource'
        ? '正在下载资源文件'
        : '步骤 5/6: 按照队列拉取模组',
    DOWNLOADING_RESOURCEPACK: '正在下载资源包',
    DOWNLOADING_SHADER: '正在下载光影文件',
    ERROR: '任务失败',
    DONE:
      taskType === 'resource'
        ? '下载已完成'
        : taskType === 'update'
          ? '启动器更新已就绪'
          : '实例部署已完成',
  };

  return stageMap[stage] || '处理中...';
};

const clampProgress = (progress: number) => Math.max(0, Math.min(100, progress));

export const useDownloadStore = create<DownloadStore>((set) => ({
  tasks: {},
  ignoredTasks: new Set(),
  isPopupOpen: false,
  setPopupOpen: (isOpen) => set({ isPopupOpen: isOpen }),

  addOrUpdateTask: (update) =>
    set((state) => {
      if (state.ignoredTasks.has(update.id)) return state;

      const existingTask = state.tasks[update.id];
      const now = Date.now();
      const taskType = update.taskType ?? existingTask?.taskType ?? 'instance';
      const stage = update.stage ?? existingTask?.stage ?? '';
      const downloadSettings = useSettingsStore.getState().settings?.download;
      const unit = downloadSettings?.speedUnit || 'MB/s';

      let speedStr = existingTask?.speed || '计算中...';
      let speedBytes = existingTask?.speedBytes || 0;

      const isFileCountProgressStage = FILE_COUNT_PROGRESS_STAGES.has(stage);
      const hasExplicitSpeedSample = update.speedCurrent !== undefined;
      const canDeriveSpeedFromCurrent =
        taskType !== 'instance' || !isFileCountProgressStage;

      if (
        hasExplicitSpeedSample &&
        existingTask &&
        update.speedCurrent! > (existingTask.lastSpeedCurrent ?? 0)
      ) {
        const previousSampleAt = existingTask.lastSpeedUpdate ?? existingTask.lastUpdate;
        const timeDiff = (now - previousSampleAt) / 1000;

        if (timeDiff >= 0.2) {
          const bytesDiff = update.speedCurrent! - (existingTask.lastSpeedCurrent ?? 0);
          const result = formatSpeed(bytesDiff, timeDiff, unit);
          speedStr = result.str;
          speedBytes = result.bytes;
        }
      } else if (
        canDeriveSpeedFromCurrent &&
        existingTask &&
        update.current !== undefined &&
        update.current > existingTask.lastCurrent
      ) {
        const timeDiff = (now - existingTask.lastUpdate) / 1000;

        if (timeDiff >= 0.2) {
          const bytesDiff = update.current - existingTask.lastCurrent;
          const result = formatSpeed(bytesDiff, timeDiff, unit);
          speedStr = result.str;
          speedBytes = result.bytes;
        }
      }

      const newLogs = existingTask ? [...existingTask.logs] : [];
      if (update.message && newLogs[newLogs.length - 1] !== update.message) {
        newLogs.push(`[${new Date().toLocaleTimeString()}] ${update.message}`);
      }

      const isError = stage === 'ERROR';
      const isDone = stage === 'DONE';
      const status = isDone ? 'completed' : isError ? 'error' : 'downloading';
      const currentVal = update.current ?? update.speedCurrent ?? existingTask?.current ?? 0;
      const totalVal = update.total ?? existingTask?.total ?? 0;

      const nextProgress = isDone
        ? 100
        : totalVal > 0
          ? clampProgress(Math.round((currentVal / totalVal) * 100))
          : existingTask?.progress || 0;

      const startedAt = existingTask?.startedAt ?? now;
      const elapsedSeconds = Math.floor((now - startedAt) / 1000);
      const etaStr = isError ? '' : formatElapsed(elapsedSeconds);
      const pipelineStage = isDone
        ? 3
        : isError
          ? -1
          : PIPELINE_STAGE_MAP[stage] ?? existingTask?.pipelineStage ?? 0;

      const newTask: DownloadTask = {
        id: update.id,
        taskType,
        title: update.title || existingTask?.title || update.id,
        status,
        stage,
        stepText: stage ? getStageText(stage, taskType) : existingTask?.stepText || '',
        progress: nextProgress,
        current: currentVal,
        total: totalVal,
        speedCurrent: update.speedCurrent ?? existingTask?.speedCurrent,
        speed: isDone || isError ? '0 KB/s' : speedStr,
        speedBytes: isDone || isError ? 0 : speedBytes,
        eta: etaStr,
        pipelineStage,
        logs: newLogs.slice(-50),
        startedAt,
        lastUpdate: now,
        lastCurrent: currentVal,
        lastSpeedUpdate: hasExplicitSpeedSample ? now : existingTask?.lastSpeedUpdate,
        lastSpeedCurrent: hasExplicitSpeedSample
          ? update.speedCurrent
          : existingTask?.lastSpeedCurrent,
        retryAction: update.retryAction || existingTask?.retryAction,
        retryPayload: update.retryPayload || existingTask?.retryPayload,
      };

      return {
        tasks: { ...state.tasks, [update.id]: newTask },
        isPopupOpen: !existingTask ? true : state.isPopupOpen,
      };
    }),

  pauseTask: (id) =>
    set((state) => ({
      tasks: {
        ...state.tasks,
        [id]: { ...state.tasks[id], status: 'paused', speed: '已暂停' },
      },
    })),

  cancelTask: (id) =>
    set((state) => {
      const newTasks = { ...state.tasks };
      delete newTasks[id];

      const newIgnored = new Set(state.ignoredTasks);
      newIgnored.add(id);

      return { tasks: newTasks, ignoredTasks: newIgnored };
    }),

  removeTask: (id) =>
    set((state) => {
      const newTasks = { ...state.tasks };
      delete newTasks[id];
      return { tasks: newTasks };
    }),
}));
