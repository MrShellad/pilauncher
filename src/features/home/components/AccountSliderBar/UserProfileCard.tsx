import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  CheckCircle,
  Gamepad2,
  Laptop,
  Loader2,
  Monitor,
  RefreshCcw,
  Smartphone,
  Trash2,
  XCircle,
} from 'lucide-react';

import type {
  DiscoveredDevice,
  IncomingTransferNotice,
  TransferProgressEvent,
  TrustedDevice,
} from '../../../../hooks/useLan';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';

interface UserProfileCardProps {
  name: string;
  isPremium: boolean;
  hasPremiumAnywhere: boolean;
  accountsCount: number;
  avatarSrc: string | null;
  trusted: TrustedDevice[];
  discovered: DiscoveredDevice[];
  onScan: () => void;
  isScanning: boolean;
  onCycleAccount: () => void;
  onRemoveTrust: (deviceId: string) => void;
  onSelectTrustedDevice: (device: DiscoveredDevice | null) => void;
}

const normalizeDeviceId = (value?: string) => (value || '').trim().toLowerCase();

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  name,
  isPremium,
  hasPremiumAnywhere,
  accountsCount,
  avatarSrc,
  trusted,
  discovered,
  onScan,
  isScanning,
  onCycleAccount,
  onRemoveTrust,
  onSelectTrustedDevice,
}) => {
  const [incomingData, setIncomingData] = useState<IncomingTransferNotice | null>(null);
  const [receiveTargetInstance, setReceiveTargetInstance] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [instances, setInstances] = useState<{ id: string; name: string }[]>([]);
  const [progress, setProgress] = useState<TransferProgressEvent | null>(null);

  useEffect(() => {
    const unlistenReceive = listen<IncomingTransferNotice>('transfer_received', async (event) => {
      const payload = event.payload;
      setIncomingData(payload);
      setProgress(null);

      try {
        const localInstances = await invoke<{ id: string; name: string }[]>('get_local_instances');
        setInstances(localInstances);
        if (payload.type === 'save' && localInstances.length > 0) {
          setReceiveTargetInstance(localInstances[0].id);
        } else {
          setReceiveTargetInstance('');
        }
      } catch {
        setInstances([]);
      }
    });

    const unlistenProgress = listen<TransferProgressEvent>('lan-transfer-progress', (event) => {
      setProgress((previous) => {
        if (!incomingData || event.payload.transferId !== incomingData.id) {
          return previous;
        }
        return event.payload;
      });
    });

    return () => {
      void unlistenReceive.then((dispose) => dispose());
      void unlistenProgress.then((dispose) => dispose());
    };
  }, [incomingData]);

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
      setProgress(null);
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
      setProgress(null);
    } catch (error) {
      alert(`拒绝失败: ${error}`);
    } finally {
      setIsRejecting(false);
    }
  };

  const renderDeviceIcon = (deviceName: string) => {
    const lower = deviceName.toLowerCase();
    if (lower.includes('windows') || lower.includes('mac')) {
      return <Laptop size={16} className="text-gray-400" />;
    }
    if (lower.includes('steamdeck') || lower.includes('rog')) {
      return <Gamepad2 size={16} className="text-gray-400" />;
    }
    if (lower.includes('tv') || lower.includes('box')) {
      return <Monitor size={16} className="text-gray-400" />;
    }
    return <Smartphone size={16} className="text-gray-400" />;
  };

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

  const progressPercent = progress
    ? progress.total > 0
      ? Math.max(0, Math.min(100, Math.round((progress.current / progress.total) * 100)))
      : progress.stage === 'APPLIED' || progress.stage === 'REJECTED' || progress.stage === 'FAILED'
        ? 100
        : 0
    : 0;

  return (
    <>
      <div className="flex flex-col overflow-hidden rounded-sm border-[2px] border-[#313233] bg-[#1E1E1F] shadow-xl">
        <div className="relative h-28 w-full overflow-hidden bg-[#111112]">
          {avatarSrc ? (
            <img src={avatarSrc} className="h-full w-full object-cover opacity-60 mix-blend-screen blur-sm" />
          ) : (
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />
          )}
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-[#1E1E1F] to-transparent p-4">
            <div className="flex items-center gap-3">
              <div
                className={`h-14 w-14 flex-shrink-0 overflow-hidden rounded-sm border-[2px] bg-black/80 shadow-lg ${
                  isPremium ? 'border-[#EAB308]' : 'border-[#313233]'
                }`}
              >
                <img
                  src={avatarSrc || 'https://cravatar.cn/avatars/8667ba71b85a4004af54457a9734eed7?size=64&overlay=true'}
                  className="h-full w-full object-cover rendering-pixelated"
                  alt="Avatar"
                />
              </div>
              <div className="flex flex-col drop-shadow-md">
                <span className={`text-lg font-bold font-minecraft ${isPremium ? 'text-[#FBBF24]' : 'text-white'}`}>
                  {name}
                </span>
                <span className="mt-0.5 flex items-center text-[10px] text-gray-300">
                  {hasPremiumAnywhere ? (
                    <span className="mr-1.5 rounded-sm border border-[#EAB308]/30 bg-[#EAB308]/20 px-1.5 py-0.5 text-[#FBBF24]">
                      Premium 尊享
                    </span>
                  ) : (
                    <span className="mr-1.5 rounded-sm border border-white/10 bg-white/10 px-1.5 py-0.5 text-gray-300">
                      Offline 离线
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t-2 border-[#2A2A2C] bg-[#1A1A1B] p-3">
          <span className="text-xs font-minecraft text-gray-400">当前活动身份</span>
          {accountsCount > 1 && (
            <OreButton variant="secondary" size="sm" onClick={onCycleAccount} className="!h-auto !px-2 !py-1 text-[10px]">
              <RefreshCcw size={12} className="mr-1" /> 切换
            </OreButton>
          )}
        </div>

        <div className="flex flex-col bg-[#141415] p-3">
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500">
            <span>信任设备 ({trusted.length})</span>
            <button
              type="button"
              onClick={onScan}
              className="inline-flex items-center gap-1 rounded-sm border border-white/10 px-1.5 py-0.5 text-[10px] text-gray-300 transition-colors hover:bg-white/10"
              title="刷新在线状态"
            >
              {isScanning ? <Loader2 size={10} className="animate-spin" /> : <RefreshCcw size={10} />}
              刷新
            </button>
          </div>

          <div className="mb-2 rounded-sm border border-sky-500/20 bg-sky-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-sky-100">
            好友关系不会自动等于信任。只有这里的信任设备才允许投送实例和存档。
          </div>

          <div className="custom-scrollbar flex max-h-[180px] flex-col gap-1.5 overflow-y-auto pr-1">
            {trusted.length === 0 && (
              <div className="py-2 text-center text-xs text-gray-500">暂无已信任设备</div>
            )}

            {trusted.map((device) => {
              const onlineInfo = onlineDeviceMap.get(normalizeDeviceId(device.device_id)) ?? null;
              const isOnline = onlineInfo !== null;

              return (
                <FocusItem
                  key={device.device_id}
                  focusKey={`trusted-${device.device_id}`}
                  onEnter={() => isOnline && onSelectTrustedDevice(onlineInfo)}
                >
                  {({ ref, focused }) => (
                    <div
                      className={`flex items-center justify-between rounded-sm border bg-white/5 p-2 text-left transition-all ${
                        isOnline ? 'border-white/10' : 'border-transparent opacity-50'
                      } ${focused && isOnline ? 'bg-white/10 ring-2 ring-white' : ''}`}
                    >
                      <button
                        ref={ref as any}
                        onClick={() => isOnline && onSelectTrustedDevice(onlineInfo)}
                        className={`flex flex-1 items-center gap-2.5 pr-2 outline-none ${
                          isOnline ? 'cursor-pointer' : 'cursor-not-allowed'
                        }`}
                      >
                        {renderDeviceIcon(device.device_name)}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-gray-200">{device.device_name}</div>
                          {device.username && (
                            <div className="truncate text-[10px] text-gray-500">{device.username}</div>
                          )}
                        </div>
                      </button>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {isOnline ? (
                          <span className="flex items-center rounded-sm border border-ore-green/20 bg-ore-green/10 px-1.5 py-0.5 text-[10px] text-ore-green">
                            <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-ore-green" />
                            在线
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-500">离线</span>
                        )}
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemoveTrust(device.device_id);
                          }}
                          className="rounded-sm p-1 text-gray-500 transition-colors hover:bg-red-500/20 hover:text-red-400"
                          title="取消信任，保留好友"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </FocusItem>
              );
            })}
          </div>
        </div>
      </div>

      <OreModal
        isOpen={!!incomingData}
        onClose={rejectIncoming}
        title="收到局域网投送"
        closeOnOutsideClick={false}
      >
        {incomingData && (
          <div className="flex flex-col items-center p-6 font-minecraft">
            <div className="mb-4 rounded-full bg-blue-500/10 p-4">
              <CheckCircle size={40} className="text-blue-400" />
            </div>

            <p className="mb-2 text-center text-white">
              {incomingData.fromUsername || incomingData.from} 向你发送了
              <strong className="mx-1 text-ore-green">
                {incomingData.type === 'instance' ? '实例' : '存档'}
              </strong>
            </p>

            <div className="my-4 w-full border border-[#2A2A2C] bg-[#141415] p-3 text-center">
              <span className="mb-1 block text-xs text-gray-500">
                内容类型: {incomingData.type === 'instance' ? '完整游戏实例' : '世界存档'}
              </span>
              <span className="text-lg text-ore-green">{incomingData.name}</span>
            </div>

            {progress && (
              <div className="mb-4 w-full">
                <div className="mb-2 flex items-center justify-between text-[11px] text-gray-400">
                  <span>{progress.message}</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full transition-all ${
                      progress.status === 'failed'
                        ? 'bg-red-400'
                        : progress.status === 'rejected'
                          ? 'bg-amber-300'
                          : 'bg-blue-400'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {incomingData.type === 'save' && (
              <div className="mb-4 w-full text-left">
                <label className="mb-2 block text-xs text-gray-400">请选择接收该存档的本地实例：</label>
                <FocusItem focusKey="select-receive-instance">
                  {({ ref, focused }) => (
                    <select
                      ref={ref as any}
                      className={`w-full rounded-sm border-2 border-[#2A2A2C] bg-[#141415] p-2 text-white outline-none transition-all ${
                        focused ? 'ring-2 ring-white' : ''
                      }`}
                      value={receiveTargetInstance}
                      onChange={(event) => setReceiveTargetInstance(event.target.value)}
                    >
                      <option value="" disabled>
                        -- 选择本地实例 --
                      </option>
                      {instances.map((instance) => (
                        <option key={instance.id} value={instance.id}>
                          {instance.name}
                        </option>
                      ))}
                    </select>
                  )}
                </FocusItem>
              </div>
            )}

            <div className="mt-4 flex w-full gap-4">
              <OreButton
                className="flex-1"
                variant="secondary"
                onClick={rejectIncoming}
                disabled={isApplying || isRejecting}
              >
                {isRejecting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <XCircle size={16} className="mr-2" />}
                拒绝并丢弃
              </OreButton>
              <OreButton
                className="flex-1 flex justify-center"
                variant="primary"
                onClick={executeApply}
                disabled={isApplying || isRejecting || (incomingData.type === 'save' && !receiveTargetInstance)}
              >
                {isApplying ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                {isApplying ? '正在解压部署...' : '接收并部署'}
              </OreButton>
            </div>
          </div>
        )}
      </OreModal>
    </>
  );
};
