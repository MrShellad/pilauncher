// src/utils/eventBus/events.ts
import type { InputAction } from '../../ui/focus/InputDriver';
import type { IncomingTrustRequest } from '../../hooks/useLan';
import type { SaveBackupProgress } from '../../features/InstanceDetail/logic/saveService';
import type { VerifyProgressEventPayload } from '../../features/InstanceDetail/components/tabs/BasicPanel/schemas/basicPanelSchemas';
import type { ModScanProgressPayload } from '../../features/InstanceDetail/hooks/modManager/modManagerShared';
import type { ThirdPartyImportProgressEvent } from '../../hooks/pages/Instances/useThirdPartyImport';
import type { SnapshotProgressEvent } from '../../features/InstanceDetail/logic/modService';

export interface TrustRequestPayload {
  device_id: string;
  device_name: string;
  user_uuid: string;
  username: string;
  public_key: string;
}

export interface ResourceDownloadProgressPayload {
  task_id?: string;
  file_name?: string;
  stage?: string;
  current?: number;
  total?: number;
}

export interface NativeGamepadEventPayload {
  id: number;
  kind: string;
  button_code?: number | null;
  button_name?: string | null;
  axis_code?: number | null;
  axis_name?: string | null;
  axis_value?: number | null;
}

export interface ModFsChangedPayload {
  instanceId: string;
  action?: 'install' | 'delete' | 'toggle' | 'import' | 'external';
  fileName?: string;
}

export interface ResourceFsChangedPayload {
  instanceId: string;
  resType?: string;
  action?: 'install' | 'delete' | 'toggle' | 'import' | 'external' | 'rename';
  fileName?: string;
}

export interface ModCloudSyncIncrementalPayload {
  instanceId: string;
  updatedMods: Array<{
    fileName: string;
    patch: Record<string, any>;
  }>;
  isCompleted: boolean;
  progress?: { current: number; total: number; stage: string };
}

export interface GameLogTelemetryPayload {
  jvmUptime: string | null;
  loaderInit: string | null;
  resourceLoad: string | null;
  renderInit: string | null;
  totalStartup: string | null;
}

export interface GameLogBatchPayload {
  lines: string[];
  gameState?: 'idle' | 'launching' | 'running' | 'crashed';
  telemetry: GameLogTelemetryPayload;
  latestLanPort?: string | null;
}

export interface GameLogMetricsPayload {
  totalLines: number;
  batchCount: number;
  persistedBytes: number;
  durationMs: number;
}

export interface GameLaunchProgressPayload {
  phase: 'preparing' | 'jvm' | 'loader' | 'resources' | 'render' | 'ready';
  percent: number;
  ready: boolean;
}

export interface AchievementUnlockedPayload {
  instanceId: string;
  worldName: string;
  playerUuid: string;
  playerName?: string;
  advancementId: string;
  title: string;
  description?: string;
  iconRelPath: string;
  frameType: string;
  unlockedAt: number;
  isFirstCareerUnlock: boolean;
}

export interface AchievementSessionSummaryPayload {
  sessionId: string;
  instanceId: string;
  worldName?: string;
  playerUuid: string;
  durationSecs: number;
  newAdvancementsCount: number;
  newAdvancements: AchievementUnlockedPayload[];
}

export interface AppEventMap {
  // --- Tauri IPC Backend Events ---
  'game-log': string;
  'game-log-batch': GameLogBatchPayload;
  'game-log-metrics': GameLogMetricsPayload;
  'game-launch-progress': GameLaunchProgressPayload;
  'game-exit': { code: number; instanceId?: string };
  'achievement-unlocked': AchievementUnlockedPayload;
  'achievement-session-summary': AchievementSessionSummaryPayload;
  'resource-download-progress': ResourceDownloadProgressPayload;
  'native-gamepad-event': NativeGamepadEventPayload;
  'trust_request_received': IncomingTrustRequest;
  'trust_list_updated': undefined;
  'incoming-trust-request': TrustRequestPayload;
  'save-backup-progress': SaveBackupProgress;
  'instance-runtime-verify-progress': VerifyProgressEventPayload;
  'instance-mods-scan-progress': ModScanProgressPayload;
  'instance-mods-fs-changed': ModFsChangedPayload;
  'instance-resources-fs-changed': ResourceFsChangedPayload;
  'third-party-import-progress': ThirdPartyImportProgressEvent;
  'snapshot-progress': SnapshotProgressEvent;
  'instance-deployment-progress': any;
  'instance-deployment-speed': any;
  'download-task-log': any;
  'launcher-update-progress': any;
  'java-installed-auto-set': any;

  // --- Domestic Frontend Events ---
  'ore-action': InputAction;
  'ore-dropdown-toggle': string;
  'ore-gamepad-connected': { id: string };
  'ore-controller-scroll': { deltaY: number };
  'mod-cloud-sync-incremental': ModCloudSyncIncrementalPayload;
}
