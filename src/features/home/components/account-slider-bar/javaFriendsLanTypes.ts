import type { DiscoveredDevice, TrustedDevice } from '../../../../hooks/useLan';

export interface JavaFriendStatus {
  uuid: string;
  xuid?: string | null;
  name: string;
  isOnline: boolean;
  activity: string;
  canJoin: boolean;
  avatarUrl?: string | null;
}

export interface JavaFriendsStatusPayload {
  friends: JavaFriendStatus[];
  authUpdate: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
}

export interface DeviceInitInfo {
  deviceId: string;
  deviceName: string;
  username: string;
  userUuid: string;
  isPremium: boolean;
  isDonor: boolean;
  launcherVersion: string;
  instanceName?: string;
  instanceId?: string;
  bgUrl: string;
}

export interface MergedFriendItem {
  key: string;
  isLan: boolean;
  isJavaFriend: boolean;
  device?: DiscoveredDevice;
  richInfo?: DeviceInitInfo;
  relationship?: TrustedDevice;
  isTrusted?: boolean;
  isOwnAccount?: boolean;
  javaFriend?: JavaFriendStatus;
}
