// src/store/useGameLogStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { appendGameLogs, createInitialTelemetry } from '../features/GameLog/logic/gameLogProcessor';
import { analyzeCrashLogs, type CrashDiagnosis } from '../features/GameLog/logic/crashAnalyzer';
import type { GameLaunchProgressPayload, GameLogBatchPayload } from '../utils/eventBus/events';

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

export interface GameLaunchProgress {
  phase: GameLaunchProgressPayload['phase'];
  percent: number;
  ready: boolean;
}

const initialLaunchProgress: GameLaunchProgress = {
  phase: 'preparing',
  percent: 0,
  ready: false,
};

interface GameLogStore {
  isOpen: boolean;
  currentInstanceId: string | null; 
  gameState: GameState;
  logs: string[];
  crashReason: string | null;
  crashDiagnosis: CrashDiagnosis | null;
  telemetry: StartupTelemetry;
  latestLanPort: string | null;
  launchProgress: GameLaunchProgress;
  
  setOpen: (isOpen: boolean) => void;
  setInstanceId: (id: string) => void; 
  setGameState: (state: GameState) => void;
  addLogs: (logs: string[]) => void;
  applyLogBatch: (batch: GameLogBatchPayload) => void;
  applyLaunchProgress: (progress: GameLaunchProgressPayload) => void;
  clearLogs: () => void;
  analyzeCrash: () => void;
}

const initialTelemetry = createInitialTelemetry();

export const useGameLogStore = create<GameLogStore>()(
  subscribeWithSelector((set, get) => ({
  isOpen: false,
  currentInstanceId: null,
  gameState: 'idle',
  logs: [],
  crashReason: null,
  crashDiagnosis: null,
  telemetry: { ...initialTelemetry },
  latestLanPort: null,
  launchProgress: { ...initialLaunchProgress },

  setOpen: (isOpen) => set({ isOpen }),
  setInstanceId: (id) => set({ currentInstanceId: id }),
  setGameState: (gameState) => set({ gameState }),

  addLogs: (lines) => set((state) => {
    return appendGameLogs({
      logs: state.logs,
      gameState: state.gameState,
      telemetry: state.telemetry,
      latestLanPort: state.latestLanPort,
    }, lines);
  }),

  applyLogBatch: (batch) => set((state) => {
    let logs = state.logs;
    if (batch.lines && batch.lines.length > 0) {
      const combined = state.logs.concat(batch.lines);
      logs = combined.length > 1000
        ? combined.slice(combined.length - 1000)
        : combined;
    }

    const nextTelemetry = batch.telemetry
      ? {
          ...state.telemetry,
          ...batch.telemetry,
        }
      : state.telemetry;
    const telemetry = (
      nextTelemetry.jvmUptime === state.telemetry.jvmUptime &&
      nextTelemetry.loaderInit === state.telemetry.loaderInit &&
      nextTelemetry.resourceLoad === state.telemetry.resourceLoad &&
      nextTelemetry.renderInit === state.telemetry.renderInit &&
      nextTelemetry.totalStartup === state.telemetry.totalStartup
    ) ? state.telemetry : nextTelemetry;

    return {
      logs,
      gameState: batch.gameState ?? state.gameState,
      telemetry,
      latestLanPort: batch.latestLanPort ?? state.latestLanPort,
    };
  }),

  applyLaunchProgress: (progress) => set((state) => {
    const percent = Math.min(100, Math.max(state.launchProgress.percent, progress.percent));
    const ready = state.launchProgress.ready || progress.ready || percent === 100;
    const launchProgress: GameLaunchProgress = {
      phase: ready ? 'ready' : progress.phase,
      percent: ready ? 100 : percent,
      ready,
    };

    if (
      launchProgress.phase === state.launchProgress.phase &&
      launchProgress.percent === state.launchProgress.percent &&
      launchProgress.ready === state.launchProgress.ready
    ) {
      return state;
    }

    return { launchProgress };
  }),

  clearLogs: () => set({
    logs: [],
    crashReason: null,
    crashDiagnosis: null,
    gameState: 'idle',
    telemetry: { ...initialTelemetry },
    latestLanPort: null,
    launchProgress: { ...initialLaunchProgress },
  }),

  analyzeCrash: () => {
    const logs = get().logs;
    const diagnosis = analyzeCrashLogs(logs);
    const fallbackReason = `${diagnosis.title}：${diagnosis.description}`;
    set({
      crashDiagnosis: diagnosis,
      crashReason: fallbackReason,
      gameState: 'crashed',
    });
  }
})));
