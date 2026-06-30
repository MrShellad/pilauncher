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

export interface AppEventMap {
  // --- Tauri IPC Backend Events ---
  'game-log': string;
  'game-exit': { code: number; instanceId?: string };
  'resource-download-progress': ResourceDownloadProgressPayload;
  'native-gamepad-event': NativeGamepadEventPayload;
  'trust_request_received': IncomingTrustRequest;
  'trust_list_updated': undefined;
  'incoming-trust-request': TrustRequestPayload;
  'save-backup-progress': SaveBackupProgress;
  'instance-runtime-verify-progress': VerifyProgressEventPayload;
  'instance-mods-scan-progress': ModScanProgressPayload;
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
}
