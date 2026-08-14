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

const getElapsed = (startTime: number | null, now: number) => {
  if (!startTime) return '0ms';
  const diff = Math.max(0, now - startTime);
  return diff >= 1000 ? `${(diff / 1000).toFixed(2)}s` : `${diff}ms`;
};

export const appendGameLogs = (
  snapshot: GameLogSnapshot,
  lines: string[],
  now = Date.now(),
): GameLogSnapshot => {
  if (lines.length === 0) return snapshot;

  const combined = snapshot.logs.concat(lines);
  const logs = combined.length > MAX_LOG_LINES
    ? combined.slice(combined.length - MAX_LOG_LINES)
    : combined;
  let gameState = snapshot.gameState;
  const telemetry = { ...snapshot.telemetry };
  let latestLanPort = snapshot.latestLanPort;

  for (const log of lines) {
    if (!telemetry._startTime && snapshot.gameState === 'launching') {
      telemetry._startTime = now;
    }

    if (snapshot.gameState === 'launching' && gameState !== 'running' && (
      log.includes('LWJGL version') ||
      log.includes('Setting user:') ||
      log.includes('Display window initialized') ||
      log.includes('Sound engine started')
    )) {
      gameState = 'running';
    }

    if (!telemetry.jvmUptime) {
      const match = log.match(/JVM Uptime at startup:\s*(\d+)/i) || log.match(/JVM running for ([\d\.]+)/i);
      if (match) telemetry.jvmUptime = match[1].includes('.') ? `${match[1]}s` : `${match[1]}ms`;
    }

    if (!telemetry.loaderInit && (
      log.includes('NeoForge mod loading') ||
      log.includes('Forge mod loader initialized') ||
      log.match(/Loading \d+ mods/i) ||
      log.includes('Fabric is preparing to load') ||
      log.includes('Built game content classloader')
    )) {
      telemetry.loaderInit = getElapsed(telemetry._startTime, now);
    }

    if (!telemetry.renderInit && (
      log.includes('Backend library: LWJGL version') ||
      log.includes('Display window initialized')
    )) {
      telemetry.renderInit = getElapsed(telemetry._startTime, now);
    }

    if (!telemetry.resourceLoad && (
      log.includes('Reloading ResourceManager') ||
      log.includes('ModelLoader took')
    )) {
      telemetry.resourceLoad = getElapsed(telemetry._startTime, now);
    }

    if (!telemetry.totalStartup && (
      log.includes('Sound engine started') ||
      log.match(/Time: (\d+)ms/i) ||
      log.match(/Done \((.*?)\)!/i)
    )) {
      telemetry.totalStartup = getElapsed(telemetry._startTime, now);
    }

    const portMatch = log.match(/(?:[Ll]ocal game hosted on(?: port)?|Started on port)\s*(\d{4,5})/i);
    if (portMatch) latestLanPort = portMatch[1];
  }

  return { logs, gameState, telemetry, latestLanPort };
};
