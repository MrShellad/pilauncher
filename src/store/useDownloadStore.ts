// /src/store/useDownloadStore.ts
import { create } from 'zustand';

export interface DownloadTask {
  id: string;             // instance_id (如 folder_name)
  instanceName: string;   // 实例名称
  status: 'downloading' | 'paused' | 'completed' | 'error';
  stage: string;          // 当前阶段 (VANILLA_CORE 等)
  stepText: string;       // 转换后的展示文本 (如 第1步: 正在下载核心)
  progress: number;       // 0-100 百分比
  current: number;
  total: number;
  speed: string;          // 下载速度 (如 2.5 MB/s)
  logs: string[];         // 日志数组
  lastUpdate: number;     // 用于计算速度的时间戳
  lastCurrent: number;    // 用于计算速度的字节记录
}

interface DownloadStore {
  tasks: Record<string, DownloadTask>;
  isPopupOpen: boolean;
  setPopupOpen: (isOpen: boolean) => void;
  addOrUpdateTask: (taskUpdate: Partial<DownloadTask> & { id: string, message: string }) => void;
  pauseTask: (id: string) => void;
  cancelTask: (id: string) => void;
  removeTask: (id: string) => void;
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  tasks: {},
  isPopupOpen: false,
  setPopupOpen: (isOpen) => set({ isPopupOpen: isOpen }),
  
  addOrUpdateTask: (update) => set((state) => {
    const existingTask = state.tasks[update.id];
    const now = Date.now();
    let speedStr = existingTask?.speed || '计算中...';

    // 简易速度计算 (两次事件的差值)
    if (existingTask && update.current !== undefined && update.current > existingTask.lastCurrent) {
      const timeDiff = (now - existingTask.lastUpdate) / 1000; // 秒
      if (timeDiff > 0.5) { // 每 0.5 秒计算一次速度防止闪烁
        const bytesDiff = update.current - existingTask.lastCurrent;
        const speedMBps = (bytesDiff / (1024 * 1024)) / timeDiff;
        speedStr = speedMBps > 1 ? `${speedMBps.toFixed(2)} MB/s` : `${(bytesDiff / 1024 / timeDiff).toFixed(2)} KB/s`;
      }
    }

    // 阶段映射
    const stageMap: Record<string, string> = {
      'VANILLA_CORE': '第1步: 下载游戏核心',
      'LIBRARIES': '第2步: 下载依赖库',
      'ASSETS': '第3步: 下载游戏资源',
      'DONE': '部署完成'
    };
    const stepText = update.stage ? stageMap[update.stage] || '处理中' : existingTask?.stepText || '';

    // 日志追加
    const newLogs = existingTask ? [...existingTask.logs] : [];
    if (update.message && newLogs[newLogs.length - 1] !== update.message) {
      newLogs.push(`[${new Date().toLocaleTimeString()}] ${update.message}`);
    }

    const newTask: DownloadTask = {
      id: update.id,
      instanceName: update.instanceName || existingTask?.instanceName || update.id,
      status: update.stage === 'DONE' ? 'completed' : 'downloading',
      stage: update.stage || existingTask?.stage || '',
      stepText,
      progress: update.total ? Math.round((update.current! / update.total) * 100) : existingTask?.progress || 0,
      current: update.current ?? existingTask?.current ?? 0,
      total: update.total ?? existingTask?.total ?? 0,
      speed: update.stage === 'DONE' ? '0 KB/s' : speedStr,
      logs: newLogs.slice(-50), // 仅保留最近 50 条日志防内存泄漏
      lastUpdate: existingTask && speedStr === existingTask.speed ? existingTask.lastUpdate : now,
      lastCurrent: update.current ?? existingTask?.lastCurrent ?? 0,
    };

    // 如果是新任务，自动弹出面板
    const isPopupOpen = !existingTask ? true : state.isPopupOpen;

    return { 
      tasks: { ...state.tasks, [update.id]: newTask },
      isPopupOpen
    };
  }),

  // UI 上的暂停与取消逻辑 (实际截断需要后端对接)
  pauseTask: (id) => set(state => ({ tasks: { ...state.tasks, [id]: { ...state.tasks[id], status: 'paused', speed: '已暂停' } } })),
  cancelTask: (id) => set(state => {
    const newTasks = { ...state.tasks };
    delete newTasks[id];
    return { tasks: newTasks };
  }),
  removeTask: (id) => set(state => {
    const newTasks = { ...state.tasks };
    delete newTasks[id];
    return { tasks: newTasks };
  }),
}));