export type GameState = 'idle' | 'launching' | 'running' | 'crashed';

export interface StartupTelemetry {
  jvmUptime: string | null;
  loaderInit: string | null;
  resourceLoad: string | null;
  renderInit: string | null;
  totalStartup: string | null;
  _startTime: number | null;
}

export interface GameLogSnapshot {
  logs: string[];
  gameState: GameState;
  telemetry: StartupTelemetry;
  latestLanPort: string | null;
}

export const MAX_LOG_LINES = 1000;

export const createInitialTelemetry = (): StartupTelemetry => ({
  jvmUptime: null,
  loaderInit: null,
  resourceLoad: null,
  renderInit: null,
  totalStartup: null,
  _startTime: null,
});

export const appendGameLogs = (
  snapshot: GameLogSnapshot,
  lines: string[],
): GameLogSnapshot => {
  if (lines.length === 0) return snapshot;

  const combined = snapshot.logs.concat(lines);
  const logs = combined.length > MAX_LOG_LINES
    ? combined.slice(combined.length - MAX_LOG_LINES)
    : combined;

  return {
    ...snapshot,
    logs,
  };
};
