export type MultiplayerSection = 'online-servers' | 'multiplayer';

export interface SocialLink {
  label: string;
  value: string;
  url?: string;
}

export interface FeatureTag {
  label: string;
  iconSvg?: string;
  color?: string;
}

export interface OnlineServer {
  id: string;
  icon: string;
  hero?: string;
  name: string;
  versions?: string[];
  onlinePlayers: number;
  maxPlayers?: number;
  ping?: number;
  serverType: string;
  isModded: boolean;
  modpackUrl?: string;
  requiresWhitelist: boolean;
  isSponsored: boolean;
  sponsoredUntil?: string;
  hasPaidFeatures: boolean;
  ageRecommendation?: string;
  hasVoiceChat: boolean;
  homepageUrl?: string;
  socials: SocialLink[];
  description?: string;
  address?: string;
  features?: FeatureTag[];
  mechanics?: FeatureTag[];
  elements?: FeatureTag[];
  community?: FeatureTag[];
  tags?: string[];
}

export interface AdSlot {
  id: string;
  title: string;
  description: string;
  image?: string;
  url?: string;
  expiresAt?: string;
}

export type PiHubRole = 'host' | 'client' | null;
export type PiHubLifecycle = 'idle' | 'starting' | 'ready' | 'stopped' | 'error';
export type PiHubLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'STDERR';
export type PiHubRequestAction = 'CREATE_ROOM' | 'JOIN_ROOM' | 'HOST_ACCEPT_ANSWER' | 'GET_SIGNALING_SERVERS';

export interface PiHubLaunchStrategy {
  name: string;
  label: string;
  pathHint: string;
}

export interface PiHubLogEntry {
  id: string;
  level: PiHubLogLevel;
  message: string;
  timestamp: string;
  source: 'stdout' | 'stderr';
}

export interface PiHubTunnelInfo {
  proxyPort: number;
  routeMethod?: string;
  latencyMs?: number;
}

export interface PiHubSnapshot {
  lifecycle: PiHubLifecycle;
  role: PiHubRole;
  activeStrategy: PiHubLaunchStrategy | null;
  logs: PiHubLogEntry[];
  isBusy: boolean;
  busyLabel: string | null;
  inviteCode: string | null;
  answerCode: string | null;
  lastError: string | null;
  peerConnectionState: string | null;
  hostAnswerApplied: boolean;
  tunnelInfo: PiHubTunnelInfo | null;
  signalingServer: string | null;
  targetMcPort: number | null;
  localProxyPort: number | null;
  manualAnswerRequired: boolean;
  startedAt: string | null;
  lastRequestAt: string | null;
}

export interface CreateRoomInput {
  targetMcPort: number;
  signalingServer?: string;
}

export interface JoinRoomInput {
  inviteCode: string;
  localProxyPort: number;
  signalingServer?: string;
}

export interface SignalingServer {
  id: string;
  url: string;
  region: string;
  provider: string;
  priority: number;
  weight: number;
  secure: boolean;
  features: {
    p2p: boolean;
    relay: boolean;
  };
  limits: {
    max_connections: number;
  };
  measuredLatencyMs?: number;
}

export interface SignalingEnvConfig {
  version: string;
  updated_at: number;
  ttl: number;
  servers: SignalingServer[];
}
