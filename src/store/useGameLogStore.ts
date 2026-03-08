// src/store/useGameLogStore.ts
import { create } from 'zustand';

export type GameState = 'idle' | 'launching' | 'running' | 'crashed';

// ✅ 1. 严格按照你的需求，重新定义五大遥测指标
export interface StartupTelemetry {
  jvmUptime: string | null;
  loaderInit: string | null;
  resourceLoad: string | null;
  renderInit: string | null;
  totalStartup: string | null;
  // 🌟 隐藏的核心引擎：用于记录启动零点的绝对时间戳
  _startTime: number | null; 
}

interface GameLogStore {
  isOpen: boolean;
  currentInstanceId: string | null; 
  gameState: GameState;
  logs: string[];
  crashReason: string | null;
  telemetry: StartupTelemetry;
  
  setOpen: (isOpen: boolean) => void;
  setInstanceId: (id: string) => void; 
  setGameState: (state: GameState) => void;
  addLog: (log: string) => void;
  clearLogs: () => void;
  analyzeCrash: () => void;
}

const MAX_LOG_LINES = 1000;

const initialTelemetry: StartupTelemetry = {
  jvmUptime: null, loaderInit: null, resourceLoad: null, renderInit: null, totalStartup: null, _startTime: null,
};

export const useGameLogStore = create<GameLogStore>((set, get) => ({
  isOpen: false,
  currentInstanceId: null,
  gameState: 'idle',
  logs: [],
  crashReason: null,
  telemetry: { ...initialTelemetry },

  setOpen: (isOpen) => set({ isOpen }),
  setInstanceId: (id) => set({ currentInstanceId: id }),
  setGameState: (gameState) => set({ gameState }),

  addLog: (log) => set((state) => {
    const newLogs = [...state.logs, log];
    if (newLogs.length > MAX_LOG_LINES) newLogs.shift(); 

    let nextState = state.gameState;
    const newTelemetry = { ...state.telemetry };

    // ========================================================
    // 🌟 核心引擎：记录第一条日志的时间戳，作为全局测速零点
    // ========================================================
    if (!newTelemetry._startTime && state.gameState === 'launching') {
      newTelemetry._startTime = Date.now();
    }

    // 测速辅助函数：计算当前节点距离零点的时间差
    const getElapsed = () => {
      if (!newTelemetry._startTime) return '0ms';
      const diff = Date.now() - newTelemetry._startTime;
      return diff >= 1000 ? `${(diff / 1000).toFixed(2)}s` : `${diff}ms`;
    };

    // 广谱启动状态嗅探器
    if (state.gameState === 'launching' && (
      log.includes('LWJGL version') || 
      log.includes('Setting user:') ||
      log.includes('Display window initialized') ||
      log.includes('Sound engine started') 
    )) {
      nextState = 'running';
    }

    // ========================================================
    // 🌟 动态秒表嗅探器 (精准匹配你提供的 NeoForge 及原版日志)
    // ========================================================

    // 1. JVM 启动耗时 (因为游戏本身汇报了绝对精准的数字，优先提取它)
    if (!newTelemetry.jvmUptime) {
      let match = log.match(/JVM Uptime at startup:\s*(\d+)/i) || log.match(/JVM running for ([\d\.]+)/i);
      if (match) newTelemetry.jvmUptime = match[1].includes('.') ? `${match[1]}s` : `${match[1]}ms`;
    }

    // 2. Mod 加载时间 (通过秒表计算)
    if (!newTelemetry.loaderInit && (
      log.includes('NeoForge mod loading') || 
      log.includes('Forge mod loader initialized') || 
      log.match(/Loading \d+ mods/i) || 
      log.includes('Fabric is preparing to load') ||
      log.includes('Built game content classloader')
    )) {
      newTelemetry.loaderInit = getElapsed();
    }

    // 3. 渲染初始化时间 (通过秒表计算)
    if (!newTelemetry.renderInit && (
      log.includes('Backend library: LWJGL version') || 
      log.includes('Display window initialized')
    )) {
      newTelemetry.renderInit = getElapsed();
    }

    // 4. 资源加载时间 (通过秒表计算)
    if (!newTelemetry.resourceLoad && (
      log.includes('Reloading ResourceManager') || 
      log.includes('ModelLoader took')
    )) {
      newTelemetry.resourceLoad = getElapsed();
    }

    // 5. 总计耗时 (引擎启动完毕即视为完成，通过秒表计算)
    if (!newTelemetry.totalStartup && (
      log.includes('Sound engine started') || 
      log.match(/Time: (\d+)ms/i) || 
      log.match(/Done \((.*?)\)!/i)
    )) {
      newTelemetry.totalStartup = getElapsed();
    }

    return { logs: newLogs, gameState: nextState, telemetry: newTelemetry };
  }),

  clearLogs: () => set({ logs: [], crashReason: null, gameState: 'idle', telemetry: { ...initialTelemetry } }),

  analyzeCrash: () => {
    const logs = get().logs;
    let reason = "未知错误，请检查完整日志获取详细信息。";

    for (let i = logs.length - 1; i >= 0; i--) {
      const line = logs[i];
      if (line.includes('java.lang.OutOfMemoryError')) { reason = "内存不足 (Out of Memory)。请在实例设置中分配更多的运行内存。"; break; }
      if (line.includes('UnsupportedClassVersionError')) { reason = "Java 版本不匹配。你当前使用的 Java 版本过低或过高，请检查该游戏版本所需的 Java。"; break; }
      if (line.includes('Missing required dependencies') || line.includes('Could not find required mod')) { reason = "缺少前置模组 (Missing Dependencies)。请检查日志中的模组依赖提示并补全。"; break; }
      if (line.includes('Failed to verify authentication') || line.includes('InvalidCredentialsException')) { reason = "登录验证失败。可能是正版服务器连接超时或 Token 失效，请重新登录。"; break; }
      if (line.includes('hs_err_pid')) { reason = "JVM 核心崩溃。这通常是显卡驱动过旧或物理内存损坏导致。"; break; }
    }
    set({ crashReason: reason, gameState: 'crashed' });
  }
}));