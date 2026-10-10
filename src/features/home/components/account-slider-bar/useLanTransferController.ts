import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import type { MinecraftAccount } from '@/features/account';
import {
  useLan,
  type DiscoveredDevice,
  type IncomingTransferNotice,
  type TransferProgressEvent,
  type TransferRecord,
} from '../../../../hooks/useLan';
import { useInputAction } from '../../../../ui/focus/InputDriver';
import {
  normalizeDeviceId,
  upsertTransferRecord,
} from './lanTransferPresentation';

interface UseLanTransferControllerOptions {
  isOpen: boolean;
  currentAccount?: MinecraftAccount;
  isPremium: boolean;
  deviceId: string;
  deviceName: string;
}

export const useLanTransferController = ({
  isOpen,
  currentAccount,
  isPremium,
  deviceId,
  deviceName,
}: UseLanTransferControllerOptions) => {
  const [transferTarget, setTransferTarget] = useState<DiscoveredDevice | null>(null);
  const [transferType, setTransferType] = useState<'instance' | 'save'>('instance');
  const [instances, setInstances] = useState<{ id: string; name: string }[]>([]);
  const [saves, setSaves] = useState<string[]>([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [selectedSave, setSelectedSave] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [transferHistory, setTransferHistory] = useState<TransferRecord[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, TransferProgressEvent>>({});
  const [incomingData, setIncomingData] = useState<IncomingTransferNotice | null>(null);
  const [receiveTargetInstance, setReceiveTargetInstance] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [focusedDeviceId, setFocusedDeviceId] = useState<string | null>(null);
  const [deviceToRemove, setDeviceToRemove] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const {
    discovered,
    trusted,
    friends,
    isScanning,
    isRequesting,
    incomingRequest,
    resolveTrustRequest,
    scan,
    sendTrustRequest,
    fetchTrusted,
    fetchFriends,
    trustDevice,
    removeTrustedDevice,
  } = useLan();

  const onlineDeviceMap = useMemo(() => {
    const map = new Map<string, DiscoveredDevice>();
    discovered.forEach((device) => {
      const key = normalizeDeviceId(device.device_id);
      if (key) {
        map.set(key, device);
      }
    });
    return map;
  }, [discovered]);

  const selectedTargetOnline = useMemo(() => {
    if (!transferTarget) {
      return null;
    }
    return (
      discovered.find(
        (item) => normalizeDeviceId(item.device_id) === normalizeDeviceId(transferTarget.device_id),
      ) || null
    );
  }, [discovered, transferTarget]);

  const selectedFriend = useMemo(() => {
    if (!transferTarget) {
      return null;
    }
    return (
      friends.find(
        (item) => normalizeDeviceId(item.deviceId) === normalizeDeviceId(transferTarget.device_id),
      ) || null
    );
  }, [friends, transferTarget]);

  const activeProgress = useMemo(() => {
    if (!transferTarget) {
      return null;
    }
    const entries = Object.values(progressMap).filter(
      (item) => normalizeDeviceId(item.remoteDeviceId) === normalizeDeviceId(transferTarget.device_id),
    );
    if (entries.length === 0) {
      return null;
    }
    return entries[entries.length - 1];
  }, [progressMap, transferTarget]);

  const fetchTransferHistory = async (targetDeviceId?: string) => {
    const list = await invoke<TransferRecord[]>('get_transfer_history', {
      remoteDeviceId: targetDeviceId || null,
    });
    setTransferHistory([...list].sort((a, b) => a.createdAt - b.createdAt));
  };

  const fetchLocalInstances = async () => {
    const list = await invoke<{ id: string; name: string }[]>('get_local_instances');
    setInstances(list);
    if (!selectedInstance && list.length > 0) {
      setSelectedInstance(list[0].id);
    }
    return list;
  };

  const fetchSavesForInstance = async (instanceId: string) => {
    const saveList = await invoke<string[]>('get_instance_saves', { instanceId });
    setSaves(saveList);
    setSelectedSave((previous) => (saveList.includes(previous) ? previous : saveList[0] || ''));
  };

  useInputAction('MENU', () => {
    if (focusedDeviceId) {
      setDeviceToRemove(focusedDeviceId);
    }
  });

  useEffect(() => {
    const unlistenReceive = listen<IncomingTransferNotice>('transfer_received', async (event) => {
      const payload = event.payload;
      setIncomingData(payload);

      try {
        const localInstances = await fetchLocalInstances();
        if (payload.type === 'save' && localInstances.length > 0) {
          setReceiveTargetInstance(localInstances[0].id);
        } else {
          setReceiveTargetInstance('');
        }
      } catch {
        setInstances([]);
      }
    });

    return () => {
      void unlistenReceive.then((dispose) => dispose());
    };
  }, []);

  const executeApply = async () => {
    if (!incomingData) {
      return;
    }

    setIsApplying(true);
    try {
      const result = await invoke<string>('apply_received_transfer', {
        transferId: incomingData.id,
        tempPath: incomingData.tempPath,
        transferType: incomingData.type,
        targetInstanceId: incomingData.type === 'save' ? receiveTargetInstance : null,
        remoteDeviceId: incomingData.fromDeviceId,
        remoteDeviceName: incomingData.from,
        remoteUsername: incomingData.fromUsername || '',
        name: incomingData.name,
      });

      if (result !== incomingData.name) {
        alert(`导入完成，检测到同名内容，已自动重命名为 ${result}`);
      } else {
        alert('导入完成，内容已部署到本地目录。');
      }

      setIncomingData(null);
    } catch (error) {
      alert(`部署失败: ${error}`);
    } finally {
      setIsApplying(false);
    }
  };

  const rejectIncoming = async () => {
    if (!incomingData || isRejecting) {
      return;
    }

    setIsRejecting(true);
    try {
      await invoke('reject_received_transfer', {
        transferId: incomingData.id,
        tempPath: incomingData.tempPath,
        transferType: incomingData.type,
        name: incomingData.name,
        remoteDeviceId: incomingData.fromDeviceId,
        remoteDeviceName: incomingData.from,
        remoteUsername: incomingData.fromUsername || '',
      });
      setIncomingData(null);
    } catch (error) {
      alert(`拒绝失败: ${error}`);
    } finally {
      setIsRejecting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setTransferTarget(null);
      setTransferHistory([]);
      setProgressMap({});
      return;
    }

    void Promise.all([fetchTrusted(), fetchFriends()]);
    void scan();

    let timeoutId: number | undefined;
    let cancelled = false;

    const scheduleNext = () => {
      const intervals = [5_000, 10_000, 15_000];
      const randomInterval = intervals[Math.floor(Math.random() * intervals.length)];

      timeoutId = window.setTimeout(async () => {
        if (!cancelled) {
          await scan();
          scheduleNext();
        }
      }, randomInterval);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [fetchFriends, fetchTrusted, isOpen, scan]);

  useEffect(() => {
    if (currentAccount && deviceId) {
      void invoke('update_lan_device_info', {
        info: {
          deviceId,
          deviceName,
          username: currentAccount.name,
          userUuid: currentAccount.uuid,
          isPremium,
          isDonor: false,
          launcherVersion: '1.0.0',
          instanceName: null,
          instanceId: null,
          bgUrl: '/device/bg',
        },
        localBgPath: '',
      }).catch(console.error);
    }
  }, [currentAccount, deviceId, deviceName, isPremium]);

  useEffect(() => {
    if (!transferTarget) {
      return;
    }

    void fetchTransferHistory(transferTarget.device_id).catch(console.error);
    void fetchLocalInstances()
      .then((list) => {
        const defaultInstanceId = selectedInstance || list[0]?.id || '';
        if (transferType === 'save' && defaultInstanceId) {
          return fetchSavesForInstance(defaultInstanceId);
        }
        return undefined;
      })
      .catch(console.error);
  }, [transferTarget]);

  useEffect(() => {
    if (transferType === 'save' && selectedInstance) {
      void fetchSavesForInstance(selectedInstance).catch(console.error);
    }
    if (transferType === 'instance') {
      setSaves([]);
      setSelectedSave('');
    }
  }, [selectedInstance, transferType]);

  useEffect(() => {
    if (!transferTarget) {
      return;
    }

    const latest = discovered.find(
      (item) => normalizeDeviceId(item.device_id) === normalizeDeviceId(transferTarget.device_id),
    );
    if (
      latest &&
      (latest.ip !== transferTarget.ip ||
        latest.port !== transferTarget.port ||
        latest.device_name !== transferTarget.device_name)
    ) {
      setTransferTarget(latest);
    }
  }, [discovered, transferTarget]);

  useEffect(() => {
    const unlistenRecord = listen<TransferRecord>('lan-transfer-record-updated', (event) => {
      const record = event.payload;
      if (
        transferTarget &&
        normalizeDeviceId(record.remoteDeviceId) !== normalizeDeviceId(transferTarget.device_id)
      ) {
        return;
      }
      setTransferHistory((previous) => upsertTransferRecord(previous, record));
    });

    const unlistenProgress = listen<TransferProgressEvent>('lan-transfer-progress', (event) => {
      setProgressMap((previous) => ({
        ...previous,
        [event.payload.transferId]: event.payload,
      }));
    });

    return () => {
      void unlistenRecord.then((dispose) => dispose());
      void unlistenProgress.then((dispose) => dispose());
    };
  }, [transferTarget]);

  useEffect(() => {
    if (!timelineRef.current) {
      return;
    }
    timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
  }, [progressMap, transferHistory, transferTarget]);

  const handleSelectTrustedDevice = async (device: DiscoveredDevice | null) => {
    setTransferTarget(device);
    setTransferHistory([]);
    if (!device) {
      return;
    }

    try {
      const list = await fetchLocalInstances();
      const defaultInstanceId = selectedInstance || list[0]?.id || '';
      if (defaultInstanceId) {
        setSelectedInstance(defaultInstanceId);
      }
      if (transferType === 'save' && defaultInstanceId) {
        await fetchSavesForInstance(defaultInstanceId);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const executePush = async () => {
    if (!transferTarget || !selectedInstance) {
      return;
    }

    setIsPushing(true);
    try {
      await invoke<string>('push_to_device', {
        targetIp: transferTarget.ip,
        targetPort: transferTarget.port,
        transferType,
        targetId: selectedInstance,
        saveName: transferType === 'save' ? selectedSave : null,
        remoteDeviceId: transferTarget.device_id,
        remoteDeviceName: selectedFriend?.deviceName || transferTarget.device_name,
        remoteUsername: selectedFriend?.username || '',
      });
    } catch (error) {
      alert(`推送失败: ${error}`);
    } finally {
      setIsPushing(false);
    }
  };

  return {
    transferTarget,
    setTransferTarget,
    transferType,
    setTransferType,
    instances,
    saves,
    selectedInstance,
    setSelectedInstance,
    selectedSave,
    setSelectedSave,
    isPushing,
    transferHistory,
    progressMap,
    incomingData,
    receiveTargetInstance,
    setReceiveTargetInstance,
    isApplying,
    isRejecting,
    focusedDeviceId,
    setFocusedDeviceId,
    deviceToRemove,
    setDeviceToRemove,
    timelineRef,
    discovered,
    trusted,
    friends,
    isScanning,
    isRequesting,
    incomingRequest,
    resolveTrustRequest,
    scan,
    sendTrustRequest,
    trustDevice,
    removeTrustedDevice,
    onlineDeviceMap,
    selectedTargetOnline,
    selectedFriend,
    activeProgress,
    handleSelectTrustedDevice,
    executePush,
    executeApply,
    rejectIncoming,
  };
};
