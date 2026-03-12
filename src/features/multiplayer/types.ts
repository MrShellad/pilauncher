export type MultiplayerSection = 'online-servers' | 'multiplayer';

export interface SocialLink {
  label: string;
  value: string;
  url?: string;
}

export interface OnlineServer {
  id: string;
  icon: string;
  name: string;
  onlinePlayers: number;
  maxPlayers?: number;
  ping?: number;
  serverType: string;
  isModded: boolean;
  requiresWhitelist: boolean;
  isSponsored: boolean;
  sponsoredUntil?: string;
  hasPaidFeatures: boolean;
  hasVoiceChat: boolean;
  homepageUrl?: string;
  socials: SocialLink[];
  description?: string;
  address?: string;
}

export interface AdSlot {
  id: string;
  title: string;
  description: string;
  image?: string;
  url?: string;
  expiresAt?: string;
}
