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
  latestLanPort: string | null;
  
  setOpen: (isOpen: boolean) => void;
  setInstanceId: (id: string) => void; 
  setGameState: (state: GameState) => void;
  addLogs: (logs: string[]) => void;
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
  latestLanPort: null,

  setOpen: (isOpen) => set({ isOpen }),
  setInstanceId: (id) => set({ currentInstanceId: id }),
  setGameState: (gameState) => set({ gameState }),

  addLogs: (lines) => set((state) => {
    if (lines.length === 0) return state;
    
    const combined = state.logs.concat(lines);
    const newLogs = combined.length > MAX_LOG_LINES ? combined.slice(combined.length - MAX_LOG_LINES) : combined;

    let nextState = state.gameState;
    const newTelemetry = { ...state.telemetry };

    const getElapsed = () => {
      if (!newTelemetry._startTime) return '0ms';
      const diff = Date.now() - newTelemetry._startTime;
      return diff >= 1000 ? `${(diff / 1000).toFixed(2)}s` : `${diff}ms`;
    };

    // 只需要分析新加的日志，不需要分析所有历史
    for (let i = 0; i < lines.length; i++) {
      const log = lines[i];

      if (!newTelemetry._startTime && state.gameState === 'launching') {
        newTelemetry._startTime = Date.now();
      }

      if (state.gameState === 'launching' && nextState !== 'running' && (
        log.includes('LWJGL version') || 
        log.includes('Setting user:') ||
        log.includes('Display window initialized') ||
        log.includes('Sound engine started') 
      )) {
        nextState = 'running';
      }

      if (!newTelemetry.jvmUptime) {
        const match = log.match(/JVM Uptime at startup:\s*(\d+)/i) || log.match(/JVM running for ([\d\.]+)/i);
        if (match) newTelemetry.jvmUptime = match[1].includes('.') ? `${match[1]}s` : `${match[1]}ms`;
      }

      if (!newTelemetry.loaderInit && (
        log.includes('NeoForge mod loading') || 
        log.includes('Forge mod loader initialized') || 
        log.match(/Loading \d+ mods/i) || 
        log.includes('Fabric is preparing to load') ||
        log.includes('Built game content classloader')
      )) {
        newTelemetry.loaderInit = getElapsed();
      }

      if (!newTelemetry.renderInit && (
        log.includes('Backend library: LWJGL version') || 
        log.includes('Display window initialized')
      )) {
        newTelemetry.renderInit = getElapsed();
      }

      if (!newTelemetry.resourceLoad && (
        log.includes('Reloading ResourceManager') || 
        log.includes('ModelLoader took')
      )) {
        newTelemetry.resourceLoad = getElapsed();
      }

      if (!newTelemetry.totalStartup && (
        log.includes('Sound engine started') || 
        log.match(/Time: (\d+)ms/i) || 
        log.match(/Done \((.*?)\)!/i)
      )) {
        newTelemetry.totalStartup = getElapsed();
      }

      const portMatch = log.match(/(?:[Ll]ocal game hosted on(?: port)?|[局域网游戏]已在端口|Started on port)\s*(\d{4,5})/i);
      if (portMatch) {
        set({ latestLanPort: portMatch[1] });
      }
    }

    return { logs: newLogs, gameState: nextState, telemetry: newTelemetry };
  }),

  clearLogs: () => set({ logs: [], crashReason: null, gameState: 'idle', telemetry: { ...initialTelemetry }, latestLanPort: null }),

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