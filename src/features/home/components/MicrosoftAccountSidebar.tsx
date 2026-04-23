import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ArrowLeft, Loader2, Send, ShieldCheck, UserPlus } from 'lucide-react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import type {
  DiscoveredDevice,
  TransferProgressEvent,
  TransferRecord,
} from '../../../hooks/useLan';
import { useLan } from '../../../hooks/useLan';
import { useAccountStore } from '../../../store/useAccountStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useInputAction } from '../../../ui/focus/InputDriver';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../ui/primitives/OreDropdown';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreProgressBar } from '../../../ui/primitives/OreProgressBar';
import defaultAvatar from '../../../assets/home/account/128.png';
import '../../../style/features/home/MicrosoftAccountSidebar.css';
import { LanRadar } from './AccountSliderBar/LanRadar';
import { UserProfileCard } from './AccountSliderBar/UserProfileCard';

interface MicrosoftAccountSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const normalizeDeviceId = (value?: string) => (value || '').trim().toLowerCase();

const formatTimestamp = (timestamp?: number | null) => {
  if (!timestamp) {
    return '刚刚';
  }

  const value = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMinutes < 1) {
    return '刚刚';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} 天前`;
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getTransferKindLabel = (transferType: string) =>
  transferType === 'save' ? '存档' : '实例';

const getStatusMeta = (status: string) => {
  switch (status) {
    case 'packing':
      return { label: '打包中', className: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    case 'sending':
      return { label: '发送中', className: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    case 'receiving':
      return { label: '接收中', className: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    case 'received':
      return { label: '已接收', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'applying':
      return { label: '部署中', className: 'bg-amber-500/15 text-amber-200 border-amber-500/30' };
    case 'applied':
      return { label: '已导入', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'rejected':
      return { label: '已拒绝', className: 'bg-amber-500/15 text-amber-200 border-amber-500/30' };
    case 'failed':
      return { label: '失败', className: 'bg-red-500/15 text-red-300 border-red-500/30' };
    default:
      return { label: status || '未知', className: 'bg-white/10 text-gray-300 border-white/15' };
  }
};

const getProgressPercent = (progress?: TransferProgressEvent | null) => {
  if (!progress) {
    return 0;
  }
  if (progress.total > 0) {
    return Math.max(0, Math.min(100, Math.round((progress.current / progress.total) * 100)));
  }
  if (['RECEIVED', 'REJECTED', 'FAILED', 'APPLIED'].includes(progress.stage)) {
    return 100;
  }
  return 0;
};

const transferDropdownClassName =
  'w-full ore-ms-dropdown';

const upsertRecord = (list: TransferRecord[], record: TransferRecord) => {
  const next = list.filter((item) => item.transferId !== record.transferId);
  next.push(record);
  next.sort((a, b) => a.createdAt - b.createdAt);
  return next;
};

export const MicrosoftAccountSidebar: React.FC<MicrosoftAccountSidebarProps> = ({
  isOpen,
  onClose,
}) => {
  const { accounts, activeAccountId, setActiveAccount } = useAccountStore();
  const { settings } = useSettingsStore();
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<DiscoveredDevice | null>(null);
  const [transferType, setTransferType] = useState<'instance' | 'save'>('instance');
  const [instances, setInstances] = useState<{ id: string; name: string }[]>([]);
  const [saves, setSaves] = useState<string[]>([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [selectedSave, setSelectedSave] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [transferHistory, setTransferHistory] = useState<TransferRecord[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, TransferProgressEvent>>({});

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

  const currentAccount = accounts.find((item) => item.uuid === activeAccountId);
  const isPremium = currentAccount?.type?.toLowerCase() === 'microsoft';
  const hasPremiumAnywhere = accounts.some((item) => item.type?.toLowerCase() === 'microsoft');
  const lastFocusRef = useRef<string | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

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

  const instanceOptions = useMemo(
    () => instances.map((instance) => ({ label: instance.name, value: instance.id })),
    [instances],
  );
  const saveOptions = useMemo(() => saves.map((save) => ({ label: save, value: save })), [saves]);

  const handleCycleAccount = () => {
    if (accounts.length <= 1) {
      return;
    }
    const currentIndex = accounts.findIndex((item) => item.uuid === activeAccountId);
    const nextIndex = (currentIndex + 1) % accounts.length;
    setActiveAccount(accounts[nextIndex].uuid);
  };

  const handleClose = () => {
    onClose();
    const last = lastFocusRef.current;
    const fallback = 'btn-profile';
    const target =
      last && doesFocusableExist(last) ? last : doesFocusableExist(fallback) ? fallback : null;
    if (target) {
      window.setTimeout(() => setFocus(target), 80);
    }
  };

  const fetchTransferHistory = async (deviceId?: string) => {
    const list = await invoke<TransferRecord[]>('get_transfer_history', {
      remoteDeviceId: deviceId || null,
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

  useEffect(() => {
    if (isOpen) {
      const current = getCurrentFocusKey();
      if (current && current !== 'SN:ROOT') {
        lastFocusRef.current = current;
      }
    }
  }, [isOpen]);

  useInputAction('CANCEL', () => {
    if (isOpen) {
      handleClose();
    }
  });

  useEffect(() => {
    if (!isOpen) {
      setTransferTarget(null);
      setTransferHistory([]);
      setProgressMap({});
      return;
    }

    void Promise.all([fetchTrusted(), fetchFriends()]);
    void scan();

    const timer = window.setInterval(() => {
      void scan();
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [fetchFriends, fetchTrusted, isOpen, scan]);

  useEffect(() => {
    if (currentAccount && settings.general.deviceId) {
      void invoke('update_lan_device_info', {
        info: {
          deviceId: settings.general.deviceId,
          deviceName: settings.general.deviceName,
          username: currentAccount.name,
          userUuid: currentAccount.uuid,
          isPremium: isPremium,
          isDonor: false,
          launcherVersion: '1.0.0',
          instanceName: null,
          instanceId: null,
          bgUrl: '/device/bg',
        },
        localBgPath: '',
      }).catch(console.error);
    }
  }, [currentAccount, isPremium, settings.general.deviceId, settings.general.deviceName]);

  useEffect(() => {
    if (!currentAccount) {
      return;
    }

    const fetchAvatar = async () => {
      try {
        const localPath = await invoke<string>('get_or_fetch_account_avatar', {
          uuid: currentAccount.uuid,
          username: currentAccount.name,
        });
        const cacheBuster = currentAccount.skinUrl?.split('?t=')[1] || 'init';
        setAvatarSrc(`${convertFileSrc(localPath)}?t=${cacheBuster}`);
      } catch {
        setAvatarSrc(defaultAvatar);
      }
    };

    void fetchAvatar();
  }, [currentAccount]);

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
      setTransferHistory((previous) => upsertRecord(previous, record));
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

  if (!currentAccount) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <FocusBoundary
            id="account-sidebar-boundary"
            trapFocus={true}
            onEscape={handleClose}
            className="fixed inset-0 z-[100] flex outline-none"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="ore-ms-sidebar-overlay absolute inset-0 cursor-pointer"
              onClick={handleClose}
            />

            <motion.div
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onAnimationComplete={() => setFocus('account-sidebar-boundary')}
              className="ore-ms-sidebar-shell absolute left-0 top-0 bottom-0 flex w-full flex-col md:w-[85vw] lg:w-[75vw] xl:w-[1000px]"
            >
              <div className="custom-scrollbar ore-ms-sidebar-scroll flex h-full flex-col overflow-y-auto p-6">
                <div className="mb-6 flex flex-1 flex-col gap-6 sm:flex-row">
                  <div className="flex w-full flex-shrink-0 flex-col gap-6 sm:w-[320px]">
                    <UserProfileCard
                      name={currentAccount.name}
                      isPremium={isPremium}
                      hasPremiumAnywhere={hasPremiumAnywhere}
                      accountsCount={accounts.length}
                      avatarSrc={avatarSrc}
                      trusted={trusted}
                      onScan={scan}
                      isScanning={isScanning}
                      onCycleAccount={handleCycleAccount}
                      discovered={discovered}
                      onRemoveTrust={removeTrustedDevice}
                      onSelectTrustedDevice={handleSelectTrustedDevice}
                    />

                    <LanRadar
                      discovered={discovered}
                      trusted={trusted}
                      friends={friends}
                      isScanning={isScanning}
                      isRequesting={isRequesting}
                      onRequestTrust={sendTrustRequest}
                      onTrustDevice={trustDevice}
                    />
                  </div>

                  <div className="ore-ms-transfer-column hidden min-w-0 flex-1 flex-col sm:flex">
                    <AnimatePresence mode="wait">
                      {transferTarget ? (
                        <motion.div
                          key={`transfer-${transferTarget.device_id}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="ore-ms-transfer-panel flex h-full flex-col rounded-sm border-[2px]"
                        >
                          <div className="ore-ms-transfer-header flex items-center justify-between border-b-2 p-4 rounded-t-[inherit]">
                            <div>
                              <h3 className="ore-ms-transfer-title flex items-center text-base font-bold font-minecraft">
                                <Send size={16} className="mr-2 text-blue-400" />
                                隔空投送会话
                              </h3>
                              <div className="ore-ms-transfer-meta mt-1 flex flex-wrap items-center gap-2 text-xs">
                                <span>{selectedFriend?.username || transferTarget.device_name}</span>
                                <span>{selectedTargetOnline ? '在线' : '离线'}</span>
                                <span>{transferTarget.ip}</span>
                                {selectedFriend?.trustLevel === 'trusted' && (
                                  <span className="rounded-sm border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">
                                    已信任
                                  </span>
                                )}
                              </div>
                            </div>

                            <FocusItem focusKey="btn-back-transfer" onEnter={() => setTransferTarget(null)}>
                              {({ ref, focused }) => (
                                <button
                                  ref={ref as any}
                                  onClick={() => setTransferTarget(null)}
                                  className={`ore-ms-back-btn ${focused ? 'is-focused' : ''}`}
                                >
                                  <ArrowLeft size={18} />
                                </button>
                              )}
                            </FocusItem>
                          </div>

                          <div
                            ref={timelineRef}
                            className="custom-scrollbar ore-ms-transfer-timeline flex-1 space-y-4 overflow-y-auto p-4"
                          >
                            {transferHistory.length === 0 && (
                              <div className="ore-ms-empty-state flex h-full items-center justify-center rounded-sm p-6 text-center text-sm">
                                暂无和这台设备的投送记录。发送一个实例或存档后，这里会按聊天时间线展示状态。
                              </div>
                            )}
                            {transferHistory.map((record) => {
                              const isOutgoing = record.direction === 'outgoing';
                              const statusMeta = getStatusMeta(record.status);
                              const progress = progressMap[record.transferId];
                              const percent = getProgressPercent(progress);
                              const actor = isOutgoing
                                ? '你'
                                : record.remoteUsername || record.remoteDeviceName || '对方';

                              return (
                                <div
                                  key={record.transferId}
                                  className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div
                                    className={`ore-ms-transfer-bubble max-w-[85%] rounded-2xl border px-4 py-3 ${
                                      isOutgoing
                                        ? 'ore-ms-transfer-bubble-outgoing text-white'
                                        : 'ore-ms-transfer-bubble-incoming text-gray-100'
                                    }`}
                                  >
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                      <span className="text-[11px] text-[#D0D1D4]">
                                        {actor}
                                        {isOutgoing ? ' 在 ' : ' 于 '}
                                        {formatTimestamp(record.createdAt)}
                                        {isOutgoing ? ' 发出了 ' : ' 发来了 '}
                                        {getTransferKindLabel(record.transferType)}
                                      </span>
                                      <span
                                        className={`rounded-full border px-2 py-0.5 text-[10px] ${statusMeta.className}`}
                                      >
                                        {statusMeta.label}
                                      </span>
                                    </div>

                                    <div className="text-sm font-semibold">{record.name}</div>

                                    {progress && (
                                      <div className="mt-3">
                                        <OreProgressBar
                                          percent={percent}
                                          label={
                                            <span className="truncate normal-case tracking-normal text-gray-300">
                                              {progress.message}
                                            </span>
                                          }
                                          className="ore-ms-inline-progress !space-y-1 !px-0 [&>div:last-child]:!text-[11px] [&>div:last-child]:!font-medium [&>div:last-child]:!tracking-normal [&>div:last-child]:!normal-case"
                                        />
                                      </div>
                                    )}

                                    {record.errorMessage && (
                                      <div className="mt-2 text-[11px] text-red-300">
                                        {record.errorMessage}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="ore-ms-transfer-footer border-t-2 p-4 rounded-b-[inherit]">
                            <div className="mb-3 flex gap-2">
                              <FocusItem focusKey="btn-transfer-type-instance">
                                {({ ref, focused }) => (
                                  <button
                                    ref={ref as any}
                                    onClick={() => setTransferType('instance')}
                                    className={`ore-ms-transfer-type-btn ${
                                      transferType === 'instance' ? 'is-active-instance' : ''
                                    } ${focused ? 'is-focused' : ''}`}
                                  >
                                    发送实例
                                  </button>
                                )}
                              </FocusItem>

                              <FocusItem focusKey="btn-transfer-type-save">
                                {({ ref, focused }) => (
                                  <button
                                    ref={ref as any}
                                    onClick={() => setTransferType('save')}
                                    className={`ore-ms-transfer-type-btn ${
                                      transferType === 'save' ? 'is-active-save' : ''
                                    } ${focused ? 'is-focused' : ''}`}
                                  >
                                    发送存档
                                  </button>
                                )}
                              </FocusItem>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <label className="mb-2 block text-xs text-gray-400">选择实例</label>
                                <OreDropdown
                                  focusKey="select-transfer-inst"
                                  options={instanceOptions}
                                  value={selectedInstance}
                                  onChange={setSelectedInstance}
                                  disabled={instanceOptions.length === 0}
                                  className={transferDropdownClassName}
                                />
                              </div>

                              {transferType === 'save' && (
                                <div>
                                  <label className="mb-2 block text-xs text-gray-400">选择存档</label>
                                  <OreDropdown
                                    focusKey="select-transfer-save"
                                    options={saveOptions}
                                    value={selectedSave}
                                    onChange={setSelectedSave}
                                    disabled={saveOptions.length === 0}
                                    className={transferDropdownClassName}
                                  />
                                </div>
                              )}
                            </div>

                            {activeProgress && (
                              <div className="ore-ms-active-progress mt-3 rounded-sm border p-3">
                                <OreProgressBar
                                  percent={getProgressPercent(activeProgress)}
                                  label={
                                    <span className="truncate normal-case tracking-normal text-gray-300">
                                      {activeProgress.message}
                                    </span>
                                  }
                                  className="ore-ms-inline-progress !space-y-1 !px-0 [&>div:last-child]:!text-xs [&>div:last-child]:!font-medium [&>div:last-child]:!tracking-normal [&>div:last-child]:!normal-case"
                                />
                              </div>
                            )}

                            <div className="mt-4 flex items-center gap-3">
                              <div className="ore-ms-transfer-tip flex-1 text-xs">
                                {selectedTargetOnline
                                  ? '接收端在线，可以直接开始打包并投送。'
                                  : '设备当前离线，无法发起投送。'}
                              </div>
                              <OreButton
                                onClick={executePush}
                                disabled={
                                  isPushing ||
                                  !selectedTargetOnline ||
                                  !selectedInstance ||
                                  (transferType === 'save' && !selectedSave)
                                }
                                variant="primary"
                                className="min-w-[180px] justify-center !h-11"
                              >
                                {isPushing ? (
                                  <Loader2 size={16} className="mr-2 animate-spin" />
                                ) : (
                                  <Send size={16} className="mr-2" />
                                )}
                                {isPushing ? '准备发送...' : '开始投送'}
                              </OreButton>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="placeholder"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="ore-ms-placeholder flex h-full flex-col items-center justify-center rounded-sm border-[2px]"
                        >
                          <div className="ore-ms-placeholder-content flex max-w-[320px] flex-col items-center text-center font-minecraft">
                            <span className="mb-4 text-4xl opacity-50">⌁</span>
                            <p className="mb-2 text-lg text-gray-300">隔空投送时间线</p>
                            <p className="text-xs leading-relaxed opacity-70">
                              从左侧信任设备列表选择在线设备后，这里会展示双方的实例或存档传输记录、接收结果和实时进度。
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>
          </FocusBoundary>
        )}
      </AnimatePresence>

      <OreModal
        isOpen={!!incomingRequest}
        onClose={() => resolveTrustRequest(false)}
        title={incomingRequest?.requestKind === 'trusted' ? '收到信任请求' : '收到好友请求'}
        closeOnOutsideClick={false}
      >
        <div className="flex flex-col items-center p-6">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-blue-500/50 bg-blue-500/20">
            {incomingRequest?.requestKind === 'trusted' ? (
              <ShieldCheck size={28} className="text-blue-400" />
            ) : (
              <UserPlus size={28} className="text-blue-400" />
            )}
          </div>

          <p className="mb-2 text-center text-lg text-white font-minecraft">
            {incomingRequest?.deviceName}
            {incomingRequest?.requestKind === 'trusted' ? ' 请求将你设为信任设备' : ' 请求添加你为好友'}
          </p>

          <p className="mb-8 max-w-xs text-center text-xs leading-relaxed text-gray-400">
            {incomingRequest?.requestKind === 'trusted'
              ? '接受后，对方设备会直接获得实例和存档投送权限。'
              : '接受后只建立好友关系，不会自动开放实例和存档投送，仍需手动提升为信任设备。'}
          </p>

          <div className="flex w-full gap-4">
            <OreButton className="flex-1 !h-12" variant="secondary" onClick={() => resolveTrustRequest(false)}>
              拒绝
            </OreButton>
            <OreButton className="flex-1 !h-12" variant="primary" onClick={() => resolveTrustRequest(true)}>
              {incomingRequest?.requestKind === 'trusted' ? '接受并信任' : '接受并加为好友'}
            </OreButton>
          </div>
        </div>
      </OreModal>
    </>
  );
};
