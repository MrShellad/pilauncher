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
  sortId: number;
  createdAt?: string;
}

export interface ServerBindableInstance {
  id: string;
  name: string;
  version: string;
  loader: string;
}

export interface ServerBindingRecord {
  uuid: string;
  name: string;
  ip: string;
  port: number;
}

export interface AdSlot {
  id: string;
  title: string;
  description: string;
  image?: string;
  url?: string;
  expiresAt?: string;
}

export type TerracottaRole = 'host' | 'client' | null;
export type TerracottaLifecycle = 'idle' | 'downloading' | 'starting' | 'scanning' | 'guesting' | 'connected' | 'exception';
export type TerracottaLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'STDERR';

export interface TerracottaLogEntry {
  id: string;
  level: TerracottaLogLevel;
  message: string;
  timestamp: string;
  source: 'stdout' | 'stderr';
}

export interface TerracottaStatePayload {
  state: TerracottaLifecycle | string;
  index: number;
  type?: string;
  room?: string;
  player?: string;
  public_nodes?: string[];
  [key: string]: any;
}

export interface TerracottaSnapshot {
  lifecycle: TerracottaLifecycle;
  role: TerracottaRole;
  logs: TerracottaLogEntry[];
  isBusy: boolean;
  busyLabel: string | null;
  roomCode: string | null;
  lastError: string | null;
  isInstalled: boolean | null; // null = still checking
  downloadStatus: 'idle' | 'resolving' | 'downloading' | 'extracting' | 'done';
  downloadUrl: string | null;
}

export interface CreateRoomInput {
  room?: string;
  player?: string;
  public_nodes?: string[];
}

export interface JoinRoomInput {
  room: string;
  player?: string;
  public_nodes?: string[];
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
