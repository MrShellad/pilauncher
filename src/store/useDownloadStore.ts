// /src/store/useDownloadStore.ts
import { create } from 'zustand';
import { useSettingsStore } from './useSettingsStore';

export interface DownloadTask {
  id: string;
  taskType: 'instance' | 'resource';
  title: string;
  status: 'downloading' | 'paused' | 'completed' | 'error';
  stage: string;
  stepText: string;
  progress: number;
  current: number;
  total: number;
  speed: string;
  logs: string[];
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

const formatSpeed = (bytesDiff: number, timeDiff: number, unit: string) => {
  const speedMBps = (bytesDiff / (1024 * 1024)) / timeDiff;

  if (unit === 'Mbps') {
    const speedMbps = speedMBps * 8;
    return speedMbps > 1
      ? `${speedMbps.toFixed(2)} Mbps`
      : `${(speedMbps * 1000).toFixed(2)} Kbps`;
  }

  return speedMBps > 1
    ? `${speedMBps.toFixed(2)} MB/s`
    : `${(bytesDiff / 1024 / timeDiff).toFixed(2)} KB/s`;
};

export const useDownloadStore = create<DownloadStore>((set, _get) => ({
  tasks: {},
  ignoredTasks: new Set(),
  isPopupOpen: false,
  setPopupOpen: (isOpen) => set({ isPopupOpen: isOpen }),

  addOrUpdateTask: (update) => set((state) => {
    if (state.ignoredTasks.has(update.id)) return state;

    const existingTask = state.tasks[update.id];
    const now = Date.now();
    const taskType = update.taskType ?? existingTask?.taskType ?? 'instance';
    const stage = update.stage ?? existingTask?.stage ?? '';
    const downloadSettings = useSettingsStore.getState().settings?.download;
    const unit = downloadSettings?.speedUnit || 'MB/s';
    let speedStr = existingTask?.speed || '计算中...';

    const isFileCountProgressStage = FILE_COUNT_PROGRESS_STAGES.has(stage);
    const hasExplicitSpeedSample = update.speedCurrent !== undefined;
    const canDeriveSpeedFromCurrent =
      taskType === 'resource' || (taskType === 'instance' && !isFileCountProgressStage);

    if (
      hasExplicitSpeedSample &&
      existingTask?.lastSpeedUpdate !== undefined &&
      update.speedCurrent! > (existingTask.lastSpeedCurrent ?? 0)
    ) {
      const previousSampleAt = existingTask.lastSpeedUpdate;
      const timeDiff = (now - previousSampleAt) / 1000;
      if (timeDiff >= 0.2) {
        const bytesDiff = update.speedCurrent! - (existingTask.lastSpeedCurrent ?? 0);
        speedStr = formatSpeed(bytesDiff, timeDiff, unit);
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
        speedStr = formatSpeed(bytesDiff, timeDiff, unit);
      }
    }

    const stageMap: Record<string, string> = {
      DOWNLOADING_MODPACK: '步骤 0/6: 获取整合包本体',
      EXTRACTING: '步骤 1/6: 解压整合包资源',
      VANILLA_CORE: '步骤 2/6: 安装游戏主体',
      LOADER_CORE: '步骤 2.5/6: 安装 Loader 环境',
      LIBRARIES: '步骤 3/6: 下载底层运行库',
      ASSETS: '步骤 4/6: 补全原版声音与材质',
      DOWNLOADING_MOD:
        taskType === 'resource' ? '正在下载模组文件' : '步骤 5/6: 按照队列拉取模组',
      DOWNLOADING_RESOURCEPACK: '正在下载资源包',
      DOWNLOADING_SHADER: '正在下载光影文件',
      ERROR: '任务异常中止',
      DONE: taskType === 'resource' ? '下载已完成' : '实例部署彻底完成',
    };

    const stepText = stage ? stageMap[stage] || '处理中...' : existingTask?.stepText || '';

    const newLogs = existingTask ? [...existingTask.logs] : [];
    if (update.message && newLogs[newLogs.length - 1] !== update.message) {
      newLogs.push(`[${new Date().toLocaleTimeString()}] ${update.message}`);
    }

    const isError = stage === 'ERROR' || existingTask?.stage === 'ERROR';
    const isDone = stage === 'DONE' || existingTask?.stage === 'DONE';
    const status = isDone ? 'completed' : (isError ? 'error' : 'downloading');

    const nextProgress =
      typeof update.current === 'number' && typeof update.total === 'number' && update.total > 0
        ? Math.round((update.current / update.total) * 100)
        : existingTask?.progress || 0;

    const newTask: DownloadTask = {
      id: update.id,
      taskType,
      title: update.title || existingTask?.title || update.id,
      status,
      stage,
      stepText,
      progress: nextProgress,
      current: update.current ?? existingTask?.current ?? 0,
      total: update.total ?? existingTask?.total ?? 0,
      speedCurrent: update.speedCurrent ?? existingTask?.speedCurrent,
      speed: (isDone || isError) ? '0 KB/s' : speedStr,
      logs: newLogs.slice(-50),
      lastUpdate: now,
      lastCurrent: update.current ?? existingTask?.lastCurrent ?? 0,
      lastSpeedUpdate: hasExplicitSpeedSample ? now : existingTask?.lastSpeedUpdate,
      lastSpeedCurrent: hasExplicitSpeedSample ? update.speedCurrent : existingTask?.lastSpeedCurrent,
      retryAction: update.retryAction || existingTask?.retryAction,
      retryPayload: update.retryPayload || existingTask?.retryPayload,
    };

    const isPopupOpen = !existingTask ? true : state.isPopupOpen;

    return {
      tasks: { ...state.tasks, [update.id]: newTask },
      isPopupOpen,
    };
  }),

  pauseTask: (id) => set((state) => ({
    tasks: {
      ...state.tasks,
      [id]: { ...state.tasks[id], status: 'paused', speed: '已暂停' },
    },
  })),
  cancelTask: (id) => set((state) => {
    const newTasks = { ...state.tasks };
    delete newTasks[id];
    const newIgnored = new Set(state.ignoredTasks);
    newIgnored.add(id);
    return { tasks: newTasks, ignoredTasks: newIgnored };
  }),
  removeTask: (id) => set((state) => {
    const newTasks = { ...state.tasks };
    delete newTasks[id];
    return { tasks: newTasks };
  }),
}));
