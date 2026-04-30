import type { LoaderType } from '../../../../../Instances/logic/environmentSelection';
import type {
  CustomButton,
  InstanceDetailData,
  MissingRuntime,
  ServerBindingInfo,
  VerifyInstanceRuntimeResult,
} from '../../../../../../hooks/pages/InstanceDetail/useInstanceDetail';

export interface InstanceEnvironmentUpdate {
  gameVersion: string;
  loaderType: LoaderType;
  loaderVersion: string;
}

export interface BasicPanelProps {
  data: InstanceDetailData;
  isInitializing: boolean;
  onUpdateName: (newName: string) => Promise<void>;
  onUpdateCover: () => Promise<void>;
  onUpdateEnvironment: (update: InstanceEnvironmentUpdate) => Promise<void>;
  onUpdateCustomButtons: (buttons: CustomButton[]) => Promise<void>;
  onUpdateServerBinding: (binding: ServerBindingInfo | null) => Promise<void>;
  onUpdateAutoJoinServer: (autoJoin: boolean) => Promise<void>;
  onVerifyFiles: () => Promise<VerifyInstanceRuntimeResult>;
  onRepairFiles: (repair: MissingRuntime) => Promise<void>;
  onDelete: (skipConfirm?: boolean) => Promise<void>;
}

export interface BasicInfoSectionProps {
  initialName: string;
  coverUrl?: string;
  isInitializing: boolean;
  onUpdateName: (newName: string) => Promise<void>;
  onUpdateCover: () => Promise<void>;
  onSuccess: (msg: string) => void;
  isGlobalSaving: boolean;
  setIsGlobalSaving: (val: boolean) => void;
}

export interface EnvironmentSectionProps {
  currentGameVersion?: string;
  currentLoaderType?: string;
  currentLoaderVersion?: string;
  isInitializing: boolean;
  isGlobalSaving: boolean;
  setIsGlobalSaving: (val: boolean) => void;
  onUpdateEnvironment: (update: InstanceEnvironmentUpdate) => Promise<void>;
  onSuccess: (msg: string) => void;
}

export interface CustomLinksSectionProps {
  initialButtons?: CustomButton[];
  isInitializing: boolean;
  onUpdateCustomButtons: (buttons: CustomButton[]) => Promise<void>;
  onSuccess: (msg: string) => void;
  isGlobalSaving: boolean;
  setIsGlobalSaving: (val: boolean) => void;
}

export interface ServerBindingSectionProps {
  serverBinding?: ServerBindingInfo | null;
  autoJoinServer?: boolean;
  isInitializing: boolean;
  onUpdateServerBinding: (binding: ServerBindingInfo | null) => Promise<void>;
  onUpdateAutoJoinServer: (autoJoin: boolean) => Promise<void>;
  onSuccess: (msg: string) => void;
  isGlobalSaving: boolean;
  setIsGlobalSaving: (val: boolean) => void;
}

export interface MaintenanceSectionProps {
  instanceId: string;
  isInitializing: boolean;
  isGlobalSaving: boolean;
  onVerifyFiles: () => Promise<VerifyInstanceRuntimeResult>;
  onRepairFiles: (repair: MissingRuntime) => Promise<void>;
}

export interface DangerZoneSectionProps {
  instanceName: string;
  isInitializing: boolean;
  onDelete: (skipConfirm?: boolean) => Promise<void>;
  isGlobalSaving: boolean;
  setIsGlobalSaving: (val: boolean) => void;
}

export interface VerifyProgressEventPayload {
  instance_id: string;
  stage: string;
  current: number;
  total: number;
  message?: string;
}

export type VerifyDialogState =
  | 'idle'
  | 'verifying'
  | 'repair'
  | 'repairing'
  | 'clean'
  | 'queued'
  | 'error';

export interface VerifyProgress {
  current: number;
  total: number;
  message: string;
}

export interface ServerBindingEditState {
  name: string;
  ip: string;
  port: string;
}

export type { CustomButton, MissingRuntime, ServerBindingInfo, VerifyInstanceRuntimeResult };
