import type { MinecraftAccount } from '@/features/account';
import type { DiscoveredDevice, TrustedDevice } from '../../../../hooks/useLan';
import type {
  DeviceInitInfo,
  JavaFriendStatus,
  MergedFriendItem,
} from './javaFriendsLanTypes';

export const normalizeDeviceId = (value?: string) => (value || '').trim().toLowerCase();

export const getDeviceKey = (device: DiscoveredDevice) =>
  normalizeDeviceId(device.device_id) || `${device.ip}:${device.port}`;

interface MergeJavaFriendsAndLanItemsOptions {
  candidateDevices: DiscoveredDevice[];
  onlineJavaFriends: JavaFriendStatus[];
  richInfos: Record<string, DeviceInitInfo>;
  lanFriendMap: Map<string, TrustedDevice>;
  trustedDeviceIds: Set<string>;
  accounts: MinecraftAccount[];
}

export const mergeJavaFriendsAndLanItems = ({
  candidateDevices,
  onlineJavaFriends,
  richInfos,
  lanFriendMap,
  trustedDeviceIds,
  accounts,
}: MergeJavaFriendsAndLanItemsOptions) => {
  const list: MergedFriendItem[] = [];
  const matchedJavaUuids = new Set<string>();
  const matchedJavaNames = new Set<string>();

  candidateDevices.forEach((device) => {
    const key = getDeviceKey(device);
    const richInfo = richInfos[key];
    const deviceId = normalizeDeviceId(richInfo?.deviceId || device.device_id);
    const relationship = lanFriendMap.get(deviceId);

    let matchedFriend: JavaFriendStatus | undefined;
    if (richInfo) {
      matchedFriend = onlineJavaFriends.find((friend) => {
        if (friend.uuid && richInfo.userUuid) {
          return friend.uuid.toLowerCase() === richInfo.userUuid.toLowerCase();
        }
        if (friend.name && richInfo.username) {
          return friend.name.toLowerCase() === richInfo.username.toLowerCase();
        }
        return false;
      });
    }

    if (matchedFriend) {
      if (matchedFriend.uuid) {
        matchedJavaUuids.add(matchedFriend.uuid.toLowerCase());
      }
      if (matchedFriend.name) {
        matchedJavaNames.add(matchedFriend.name.toLowerCase());
      }
    }

    list.push({
      key: `lan-${key}`,
      isLan: true,
      isJavaFriend: !!matchedFriend,
      device,
      richInfo,
      relationship,
      isTrusted: trustedDeviceIds.has(deviceId),
      isOwnAccount: richInfo ? accounts.some((account) => account.uuid === richInfo.userUuid) : false,
      javaFriend: matchedFriend,
    });
  });

  onlineJavaFriends.forEach((friend) => {
    const uuidKey = friend.uuid?.toLowerCase();
    const nameKey = friend.name?.toLowerCase();

    if ((uuidKey && matchedJavaUuids.has(uuidKey)) || (nameKey && matchedJavaNames.has(nameKey))) {
      return;
    }

    list.push({
      key: `java-${friend.uuid || friend.name}`,
      isLan: false,
      isJavaFriend: true,
      javaFriend: friend,
    });
  });

  return list.sort((first, second) => {
    if (first.isLan !== second.isLan) {
      return first.isLan ? -1 : 1;
    }

    if (first.isLan) {
      const firstIsOwn = first.isOwnAccount || false;
      const secondIsOwn = second.isOwnAccount || false;
      if (firstIsOwn !== secondIsOwn) {
        return firstIsOwn ? -1 : 1;
      }

      const firstIsFriend = !!first.relationship || first.isJavaFriend;
      const secondIsFriend = !!second.relationship || second.isJavaFriend;
      if (firstIsFriend !== secondIsFriend) {
        return firstIsFriend ? -1 : 1;
      }

      const firstName = first.richInfo?.username || first.device?.device_name || '';
      const secondName = second.richInfo?.username || second.device?.device_name || '';
      return firstName.localeCompare(secondName);
    }

    const firstName = first.javaFriend?.name || '';
    const secondName = second.javaFriend?.name || '';
    return firstName.localeCompare(secondName);
  });
};
