import { Command, type Child } from '@tauri-apps/plugin-shell';
import type {
  CreateRoomInput,
  JoinRoomInput,
  PiHubLaunchStrategy,
  PiHubLogEntry,
  PiHubLogLevel,
  PiHubRequestAction,
  PiHubSnapshot,
  PiHubTunnelInfo,
  SignalingEnvConfig
} from './types';

const PIHUB_COMMANDS: PiHubLaunchStrategy[] = [
  {
    name: 'binaries/PiHub',
    label: '项目内置 PiHub',
    pathHint: 'src-tauri/binaries/PiHub-x86_64-pc-windows-msvc.exe'
  }
];

const MAX_LOGS = 160;
const REQUEST_TIMEOUT_MS = 45_000;

const ACTION_LABELS: Record<PiHubRequestAction, string> = {
  CREATE_ROOM: '创建房间',
  JOIN_ROOM: '加入房间',
  HOST_ACCEPT_ANSWER: '导入应答码',
  GET_SIGNALING_SERVERS: '获取信令服务器列表'
};

const ACTION_BUSY_LABELS: Record<PiHubRequestAction, string> = {
  CREATE_ROOM: 'PiHub 正在创建房间...',
  JOIN_ROOM: 'PiHub 正在建立加入会话...',
  HOST_ACCEPT_ANSWER: 'PiHub 正在应用远端应答...',
  GET_SIGNALING_SERVERS: 'PiHub 正在获取信令服务器列表...'
};

interface PendingRequest {
  action: PiHubRequestAction;
  resolve: (value: Record<string, unknown>) => void;
  reject: (reason: Error) => void;
  timeoutId: number;
}

interface PiHubRpcResponse {
  type: 'response';
  req_id: string;
  status: 'success' | 'error';
  data?: Record<string, unknown>;
}

interface PiHubRpcEvent {
  type: 'event';
  event_name: string;
  data?: Record<string, unknown>;
}

interface PiHubRpcLog {
  type: 'log';
  level?: string;
  message?: string;
}

type PiHubRpcLine = PiHubRpcResponse | PiHubRpcEvent | PiHubRpcLog;

const createInitialSnapshot = (): PiHubSnapshot => ({
  lifecycle: 'idle',
  role: null,
  activeStrategy: null,
  logs: [],
  isBusy: false,
  busyLabel: null,
  inviteCode: null,
  answerCode: null,
  lastError: null,
  peerConnectionState: null,
  hostAnswerApplied: false,
  tunnelInfo: null,
  signalingServer: null,
  targetMcPort: null,
  localProxyPort: null,
  manualAnswerRequired: false,
  startedAt: null,
  lastRequestAt: null
});

const trimValue = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === 'string' ? error : '未知错误');
};

const toInteger = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const createRequestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `pihub-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

class PiHubClient {
  private snapshot = createInitialSnapshot();
  private listeners = new Set<(snapshot: PiHubSnapshot) => void>();
  private child: Child | null = null;
  private command: Command<string> | null = null;
  private stdoutBuffer = '';
  private stderrBuffer = '';
  private pendingRequests = new Map<string, PendingRequest>();
  private startPromise: Promise<void> | null = null;
  private stopping = false;

  subscribe = (listener: (snapshot: PiHubSnapshot) => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  start = async () => {
    await this.ensureStarted();
  };

  stop = async () => {
    this.stopping = true;
    const child = this.child;

    this.cleanupCommand();
    this.rejectPendingRequests(new Error('PiHub 会话已停止'));
    this.stdoutBuffer = '';
    this.stderrBuffer = '';
    this.child = null;

    if (child) {
      try {
        await child.kill();
      } catch (error) {
        this.pushLog('WARN', `停止 PiHub 进程时收到异常：${normalizeError(error).message}`, 'stderr');
      }
    }

    this.snapshot = createInitialSnapshot();
    this.emit();
    this.stopping = false;
  };

  restart = async () => {
    await this.stop();
    await this.ensureStarted();
  };

  createRoom = async ({ targetMcPort, signalingServer }: CreateRoomInput) => {
    this.assertRoleBeforeRequest('host');
    await this.ensureStarted();

    this.updateSnapshot({
      role: 'host',
      inviteCode: null,
      answerCode: null,
      tunnelInfo: null,
      hostAnswerApplied: false,
      lastError: null,
      isBusy: true,
      busyLabel: ACTION_BUSY_LABELS.CREATE_ROOM,
      targetMcPort,
      localProxyPort: null,
      signalingServer: trimValue(signalingServer) || null,
      manualAnswerRequired: !trimValue(signalingServer),
      lastRequestAt: new Date().toISOString()
    });

    try {
      const data = await this.sendRequest('CREATE_ROOM', {
        target_mc_port: targetMcPort,
        ...(trimValue(signalingServer) ? { signaling_server: trimValue(signalingServer) } : {})
      });

      const inviteCode = trimValue(String(data.invite_code ?? ''));
      if (!inviteCode) {
        throw new Error('PiHub 未返回邀请码');
      }

      this.updateSnapshot({
        inviteCode,
        isBusy: false,
        busyLabel: null
      });

      return inviteCode;
    } catch (error) {
      const message = normalizeError(error).message;
      this.updateSnapshot({
        isBusy: false,
        busyLabel: null,
        lastError: message
      });
      throw new Error(message);
    }
  };

  joinRoom = async ({ inviteCode, localProxyPort, signalingServer }: JoinRoomInput) => {
    this.assertRoleBeforeRequest('client');
    await this.ensureStarted();

    const trimmedInviteCode = trimValue(inviteCode);
    if (!trimmedInviteCode) {
      throw new Error('请输入邀请码');
    }

    this.updateSnapshot({
      role: 'client',
      answerCode: null,
      tunnelInfo: null,
      lastError: null,
      isBusy: true,
      busyLabel: ACTION_BUSY_LABELS.JOIN_ROOM,
      localProxyPort,
      signalingServer: trimValue(signalingServer) || null,
      manualAnswerRequired: !trimValue(signalingServer),
      lastRequestAt: new Date().toISOString()
    });

    try {
      const data = await this.sendRequest('JOIN_ROOM', {
        invite_code: trimmedInviteCode,
        local_proxy_port: localProxyPort,
        ...(trimValue(signalingServer) ? { signaling_server: trimValue(signalingServer) } : {})
      });

      const answerCode = trimValue(String(data.answer_code ?? ''));
      if (!answerCode) {
        throw new Error('PiHub 未返回应答码');
      }

      this.updateSnapshot({
        answerCode,
        isBusy: false,
        busyLabel: null
      });

      return answerCode;
    } catch (error) {
      const message = normalizeError(error).message;
      this.updateSnapshot({
        isBusy: false,
        busyLabel: null,
        lastError: message
      });
      throw new Error(message);
    }
  };

  acceptAnswer = async (answerCode: string) => {
    if (this.snapshot.role !== 'host' || !this.snapshot.inviteCode) {
      throw new Error('请先创建房间，再导入客户端应答码');
    }

    const trimmedAnswerCode = trimValue(answerCode);
    if (!trimmedAnswerCode) {
      throw new Error('请输入应答码');
    }

    this.updateSnapshot({
      isBusy: true,
      busyLabel: ACTION_BUSY_LABELS.HOST_ACCEPT_ANSWER,
      lastError: null,
      lastRequestAt: new Date().toISOString()
    });

    try {
      await this.sendRequest('HOST_ACCEPT_ANSWER', {
        answer_code: trimmedAnswerCode
      });

      this.updateSnapshot({
        hostAnswerApplied: true,
        isBusy: false,
        busyLabel: null
      });
    } catch (error) {
      const message = normalizeError(error).message;
      this.updateSnapshot({
        isBusy: false,
        busyLabel: null,
        lastError: message
      });
      throw new Error(message);
    }
  };

  getSignalingServers = async (): Promise<SignalingEnvConfig> => {
    await this.ensureStarted();

    try {
      const data = await this.sendRequest('GET_SIGNALING_SERVERS', {});
      return data as unknown as SignalingEnvConfig;
    } catch (error) {
      const message = normalizeError(error).message;
      throw new Error(`获取服务器列表失败: ${message}`);
    }
  };

  private emit() {
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }

  private updateSnapshot(partial: Partial<PiHubSnapshot>) {
    this.snapshot = {
      ...this.snapshot,
      ...partial
    };
    this.emit();
  }

  private pushLog(level: PiHubLogLevel, message: string, source: 'stdout' | 'stderr') {
    const entry: PiHubLogEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      level,
      message,
      source,
      timestamp: new Date().toISOString()
    };

    const logs = [...this.snapshot.logs, entry].slice(-MAX_LOGS);
    this.updateSnapshot({ logs });

    if (level === 'ERROR' || level === 'STDERR') {
      this.updateSnapshot({ lastError: message });
    }

    this.applyLogSideEffects(level, message);
  }

  private applyLogSideEffects(level: PiHubLogLevel, message: string) {
    const peerState = message.match(/\[WebRTC\] PeerConnection state: (.+)$/)?.[1]?.trim();
    if (peerState) {
      this.updateSnapshot({ peerConnectionState: peerState });
    }

    if (
      message.includes('Received PLAYER_ANSWER') ||
      message.includes('Remote answer applied successfully') ||
      message.includes('Remote answer already applied')
    ) {
      this.updateSnapshot({ hostAnswerApplied: true });
    }

    const proxyPort = toInteger(message.match(/Client proxy listening on 127\.0\.0\.1:(\d+)/)?.[1]);
    if (proxyPort !== undefined) {
      this.updateSnapshot({ localProxyPort: proxyPort });
    }

    if (level === 'ERROR' && this.snapshot.lifecycle === 'starting') {
      this.updateSnapshot({ lifecycle: 'error' });
    }
  }

  private assertRoleBeforeRequest(nextRole: 'host' | 'client') {
    if (!this.snapshot.role) {
      return;
    }

    if (this.snapshot.role !== nextRole) {
      throw new Error('当前 PiHub 会话已锁定为另一种角色，请先重启引擎后再切换');
    }

    if (nextRole === 'host' && this.snapshot.inviteCode) {
      throw new Error('当前引擎已经创建过房间，请先重启引擎再创建新房间');
    }

    if (nextRole === 'client' && this.snapshot.answerCode) {
      throw new Error('当前引擎已经加入过房间，请先重启引擎再发起新的加入请求');
    }
  }

  private async ensureStarted() {
    if (this.child) {
      return;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.startInternal().finally(() => {
      this.startPromise = null;
    });

    return this.startPromise;
  }

  private async startInternal() {
    this.updateSnapshot({
      lifecycle: 'starting',
      lastError: null,
      isBusy: true,
      busyLabel: '正在拉起 PiHub 引擎...'
    });

    const attemptErrors: string[] = [];

    for (const strategy of PIHUB_COMMANDS) {
      try {
        const command = Command.sidecar(strategy.name);
        this.bindCommand(command, strategy);
        const child = await command.spawn();

        this.command = command;
        this.child = child;
        this.stdoutBuffer = '';
        this.stderrBuffer = '';

        this.updateSnapshot({
          lifecycle: 'ready',
          activeStrategy: strategy,
          startedAt: new Date().toISOString(),
          isBusy: false,
          busyLabel: null
        });

        this.pushLog('INFO', `[Launcher] 已连接 ${strategy.label} (${strategy.pathHint})`, 'stdout');
        return;
      } catch (error) {
        this.cleanupCommand();
        const message = normalizeError(error).message;
        attemptErrors.push(`${strategy.pathHint}: ${message}`);
      }
    }

    const finalError = `无法启动 PiHub sidecar，尝试结果：${attemptErrors.join(' | ')}`;
    this.updateSnapshot({
      lifecycle: 'error',
      isBusy: false,
      busyLabel: null,
      lastError: finalError
    });
    throw new Error(finalError);
  }

  private bindCommand(command: Command<string>, strategy: PiHubLaunchStrategy) {
    command.stdout.on('data', (chunk) => {
      this.consumeChunk(String(chunk), 'stdout');
    });

    command.stderr.on('data', (chunk) => {
      this.consumeChunk(String(chunk), 'stderr');
    });

    command.on('error', (message) => {
      this.pushLog('ERROR', `[${strategy.label}] ${message}`, 'stderr');
    });

    command.on('close', ({ code, signal }) => {
      const message = `PiHub 进程已退出 (code=${code ?? 'null'}, signal=${signal ?? 'null'})`;
      this.child = null;
      this.cleanupCommand();
      this.rejectPendingRequests(new Error(message));

      if (this.stopping) {
        return;
      }

      this.updateSnapshot({
        lifecycle: 'stopped',
        isBusy: false,
        busyLabel: null
      });
      this.pushLog('WARN', message, 'stderr');
    });
  }

  private cleanupCommand() {
    if (!this.command) {
      return;
    }

    this.command.stdout.removeAllListeners();
    this.command.stderr.removeAllListeners();
    this.command.removeAllListeners();
    this.command = null;
  }

  private rejectPendingRequests(error: Error) {
    for (const [, pending] of this.pendingRequests) {
      window.clearTimeout(pending.timeoutId);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  private consumeChunk(chunk: string, source: 'stdout' | 'stderr') {
    const buffer = `${source === 'stdout' ? this.stdoutBuffer : this.stderrBuffer}${chunk}`;
    const lines = buffer.split(/\r?\n/);
    const trailing = lines.pop() ?? '';

    if (source === 'stdout') {
      this.stdoutBuffer = trailing;
    } else {
      this.stderrBuffer = trailing;
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      this.handleLine(line, source);
    }
  }

  private handleLine(line: string, source: 'stdout' | 'stderr') {
    if (source === 'stderr') {
      this.pushLog('STDERR', line, source);
      return;
    }

    let payload: PiHubRpcLine | null = null;
    try {
      payload = JSON.parse(line) as PiHubRpcLine;
    } catch {
      this.pushLog('INFO', line, source);
      return;
    }

    if (!payload || typeof payload !== 'object' || !('type' in payload)) {
      this.pushLog('INFO', line, source);
      return;
    }

    if (payload.type === 'log') {
      const level = String(payload.level || 'INFO').toUpperCase() as PiHubLogLevel;
      this.pushLog(level === 'WARN' || level === 'ERROR' ? level : 'INFO', payload.message || line, source);
      return;
    }

    if (payload.type === 'event') {
      this.handleEvent(payload);
      return;
    }

    if (payload.type === 'response') {
      this.handleResponse(payload);
      return;
    }

    this.pushLog('INFO', line, source);
  }

  private handleEvent(event: PiHubRpcEvent) {
    if (event.event_name === 'TUNNEL_READY') {
      const proxyPort = toInteger(event.data?.proxy_port);
      if (proxyPort === undefined) {
        this.pushLog('WARN', 'PiHub 返回了 TUNNEL_READY，但缺少 proxy_port', 'stdout');
        return;
      }

      const tunnelInfo: PiHubTunnelInfo = {
        proxyPort,
        routeMethod: typeof event.data?.route_method === 'string' ? event.data.route_method : undefined,
        latencyMs: toInteger(event.data?.latency_ms)
      };

      this.updateSnapshot({
        tunnelInfo,
        localProxyPort: proxyPort,
        isBusy: false,
        busyLabel: null
      });

      this.pushLog('INFO', `[Launcher] 隧道就绪，Minecraft 可连接 127.0.0.1:${proxyPort}`, 'stdout');
      return;
    }

    this.pushLog('INFO', `[Event] ${event.event_name}`, 'stdout');
  }

  private handleResponse(response: PiHubRpcResponse) {
    const pending = this.pendingRequests.get(response.req_id);
    if (!pending) {
      this.pushLog('WARN', `[RPC] 收到未匹配 req_id 的响应：${response.req_id}`, 'stdout');
      return;
    }

    window.clearTimeout(pending.timeoutId);
    this.pendingRequests.delete(response.req_id);

    if (response.status === 'success') {
      pending.resolve(response.data || {});
      return;
    }

    const error = new Error(`${ACTION_LABELS[pending.action]}失败`);
    pending.reject(error);
    this.pushLog('ERROR', `[RPC] ${ACTION_LABELS[pending.action]}失败`, 'stdout');
  }

  private async sendRequest(action: PiHubRequestAction, payload: Record<string, unknown>) {
    const child = this.child;
    if (!child) {
      throw new Error('PiHub 尚未启动');
    }

    const reqId = createRequestId();
    const requestLine = JSON.stringify({
      req_id: reqId,
      action,
      payload
    });

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error(`${ACTION_LABELS[action]}超时`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(reqId, {
        action,
        resolve,
        reject,
        timeoutId
      });

      child.write(`${requestLine}\n`).catch((error) => {
        window.clearTimeout(timeoutId);
        this.pendingRequests.delete(reqId);
        reject(new Error(`写入 PiHub stdin 失败：${normalizeError(error).message}`));
      });
    });
  }
}

export const pihubClient = new PiHubClient();
export const pihubLaunchStrategies = PIHUB_COMMANDS;
