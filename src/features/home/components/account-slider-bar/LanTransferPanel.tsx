import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Loader2, Send } from 'lucide-react';

import type {
  DiscoveredDevice,
  TransferProgressEvent,
  TransferRecord,
  TrustedDevice,
} from '../../../../hooks/useLan';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
import { OreProgressBar } from '../../../../ui/primitives/OreProgressBar';
import {
  formatTransferTimestamp,
  getTransferKindLabel,
  getTransferProgressPercent,
  getTransferStatusMeta,
} from './lanTransferPresentation';

interface LanTransferPanelProps {
  transferTarget: DiscoveredDevice | null;
  selectedFriend: TrustedDevice | null;
  selectedTargetOnline: DiscoveredDevice | null;
  timelineRef: React.RefObject<HTMLDivElement | null>;
  transferHistory: TransferRecord[];
  progressMap: Record<string, TransferProgressEvent>;
  transferType: 'instance' | 'save';
  instances: { id: string; name: string }[];
  saves: string[];
  selectedInstance: string;
  selectedSave: string;
  activeProgress: TransferProgressEvent | null;
  isPushing: boolean;
  onCloseTransfer: () => void;
  onTransferTypeChange: (value: 'instance' | 'save') => void;
  onSelectedInstanceChange: (value: string) => void;
  onSelectedSaveChange: (value: string) => void;
  onPush: () => void | Promise<void>;
}

const transferDropdownClassName = 'w-full ore-ms-dropdown';

export const LanTransferPanel: React.FC<LanTransferPanelProps> = ({
  transferTarget,
  selectedFriend,
  selectedTargetOnline,
  timelineRef,
  transferHistory,
  progressMap,
  transferType,
  instances,
  saves,
  selectedInstance,
  selectedSave,
  activeProgress,
  isPushing,
  onCloseTransfer,
  onTransferTypeChange,
  onSelectedInstanceChange,
  onSelectedSaveChange,
  onPush,
}) => {
  const instanceOptions = useMemo(
    () => instances.map((instance) => ({ label: instance.name, value: instance.id })),
    [instances],
  );
  const saveOptions = useMemo(
    () => saves.map((save) => ({ label: save, value: save })),
    [saves],
  );

  return (
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

              <FocusItem focusKey="btn-back-transfer" onEnter={onCloseTransfer}>
                {({ ref, focused }) => (
                  <button
                    ref={ref as React.RefObject<HTMLButtonElement>}
                    onClick={onCloseTransfer}
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
                const statusMeta = getTransferStatusMeta(record.status);
                const progress = progressMap[record.transferId];
                const percent = getTransferProgressPercent(progress);
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
                          {formatTransferTimestamp(record.createdAt)}
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
                      ref={ref as React.RefObject<HTMLButtonElement>}
                      onClick={() => onTransferTypeChange('instance')}
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
                      ref={ref as React.RefObject<HTMLButtonElement>}
                      onClick={() => onTransferTypeChange('save')}
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
                    onChange={onSelectedInstanceChange}
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
                      onChange={onSelectedSaveChange}
                      disabled={saveOptions.length === 0}
                      className={transferDropdownClassName}
                    />
                  </div>
                )}
              </div>

              {activeProgress && (
                <div className="ore-ms-active-progress mt-3 rounded-sm border p-3">
                  <OreProgressBar
                    percent={getTransferProgressPercent(activeProgress)}
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
                  onClick={onPush}
                  disabled={
                    isPushing ||
                    !selectedTargetOnline ||
                    !selectedInstance ||
                    (transferType === 'save' && !selectedSave)
                  }
                  variant="primary"
                  className="min-w-[clamp(11.25rem,14vw,18rem)] justify-center !h-[clamp(2.75rem,4.8vh,4.5rem)] !text-[length:clamp(0.875rem,1vw,1.25rem)] !text-white [&_svg]:!text-white !m-0"
                >
                  {isPushing ? (
                    <Loader2 size="clamp(1rem,1.2vw,1.5rem)" className="mr-2 animate-spin" />
                  ) : (
                    <Send size="clamp(1rem,1.2vw,1.5rem)" className="mr-2" />
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
  );
};
