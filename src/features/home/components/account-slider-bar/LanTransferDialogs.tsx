import React from 'react';
import { CheckCircle, Loader2, ShieldCheck, Trash2, UserPlus, XCircle } from 'lucide-react';

import type {
  IncomingTransferNotice,
  IncomingTrustRequest,
  TransferProgressEvent,
} from '../../../../hooks/useLan';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { getTransferProgressPercent } from './lanTransferPresentation';

interface LanTransferDialogsProps {
  incomingRequest: IncomingTrustRequest | null;
  incomingData: IncomingTransferNotice | null;
  progressMap: Record<string, TransferProgressEvent>;
  instances: { id: string; name: string }[];
  receiveTargetInstance: string;
  isApplying: boolean;
  isRejecting: boolean;
  deviceToRemove: string | null;
  onResolveTrustRequest: (accept: boolean) => void | Promise<void>;
  onRejectIncoming: () => void | Promise<void>;
  onApplyIncoming: () => void | Promise<void>;
  onReceiveTargetInstanceChange: (instanceId: string) => void;
  onDeviceToRemoveChange: (deviceId: string | null) => void;
  onRemoveTrustedDevice: (deviceId: string) => void | Promise<void>;
}

export const LanTransferDialogs: React.FC<LanTransferDialogsProps> = ({
  incomingRequest,
  incomingData,
  progressMap,
  instances,
  receiveTargetInstance,
  isApplying,
  isRejecting,
  deviceToRemove,
  onResolveTrustRequest,
  onRejectIncoming,
  onApplyIncoming,
  onReceiveTargetInstanceChange,
  onDeviceToRemoveChange,
  onRemoveTrustedDevice,
}) => (
  <>
    <OreModal
      isOpen={!!incomingRequest}
      onClose={() => onResolveTrustRequest(false)}
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
          <OreButton className="flex-1 !h-[clamp(3rem,5vh,4.75rem)] !text-[length:clamp(1rem,1.1vw,1.375rem)] !text-[#111214] !m-0" variant="secondary" onClick={() => onResolveTrustRequest(false)}>
            拒绝
          </OreButton>
          <OreButton className="flex-1 !h-[clamp(3rem,5vh,4.75rem)] !text-[length:clamp(1rem,1.1vw,1.375rem)] !text-white !m-0" variant="primary" onClick={() => onResolveTrustRequest(true)}>
            {incomingRequest?.requestKind === 'trusted' ? '接受并信任' : '接受并加为好友'}
          </OreButton>
        </div>
      </div>
    </OreModal>

    <OreModal
      isOpen={!!incomingData}
      onClose={onRejectIncoming}
      title="收到局域网投送"
      closeOnOutsideClick={false}
    >
      {incomingData && (
        <div className="flex flex-col items-center p-6 font-minecraft">
          <div className="mb-4 rounded-full bg-blue-500/10 p-4">
            <CheckCircle size={40} className="text-blue-400" />
          </div>

          <p className="mb-2 text-center text-white font-minecraft">
            {incomingData.fromUsername || incomingData.from} 向你发送了
            <strong className="mx-1 text-ore-green">
              {incomingData.type === 'instance' ? '实例' : '存档'}
            </strong>
          </p>

          <div className="my-4 w-full border border-[#2A2A2C] bg-[#141415] p-3 text-center">
            <span className="mb-1 block text-xs text-gray-500">
              内容类型: {incomingData.type === 'instance' ? '完整游戏实例' : '世界存档'}
            </span>
            <span className="text-lg text-ore-green font-bold">{incomingData.name}</span>
          </div>

          {progressMap[incomingData.id] && (
            <div className="mb-4 w-full">
              <div className="mb-2 flex items-center justify-between text-[11px] text-gray-400">
                <span>{progressMap[incomingData.id].message}</span>
                <span>{getTransferProgressPercent(progressMap[incomingData.id])}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full transition-all ${
                    progressMap[incomingData.id].stage === 'FAILED'
                      ? 'bg-red-400'
                      : progressMap[incomingData.id].stage === 'REJECTED'
                        ? 'bg-amber-300'
                        : 'bg-blue-400'
                  }`}
                  style={{ width: `${getTransferProgressPercent(progressMap[incomingData.id])}%` }}
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
                    ref={ref as React.RefObject<HTMLSelectElement>}
                    className={`w-full rounded-sm border-2 border-[#2A2A2C] bg-[#141415] p-2 text-white outline-none transition-all ${
                      focused ? 'ring-2 ring-white' : ''
                    }`}
                    value={receiveTargetInstance}
                    onChange={(event) => onReceiveTargetInstanceChange(event.target.value)}
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
              className="flex-1 !m-0"
              variant="secondary"
              onClick={onRejectIncoming}
              disabled={isApplying || isRejecting}
            >
              {isRejecting ? (
                <Loader2 size="clamp(1rem,1.2vw,1.5rem)" className="mr-2 animate-spin" />
              ) : (
                <XCircle size="clamp(1rem,1.2vw,1.5rem)" className="mr-2" />
              )}
              拒绝并丢弃
            </OreButton>
            <OreButton
              className="flex-1 flex justify-center !m-0"
              variant="primary"
              onClick={onApplyIncoming}
              disabled={isApplying || isRejecting || (incomingData.type === 'save' && !receiveTargetInstance)}
            >
              {isApplying ? (
                <Loader2 size="clamp(1rem,1.2vw,1.5rem)" className="mr-2 animate-spin" />
              ) : null}
              {isApplying ? '正在解压部署...' : '接收并部署'}
            </OreButton>
          </div>
        </div>
      )}
    </OreModal>

    <OreModal
      isOpen={!!deviceToRemove}
      onClose={() => onDeviceToRemoveChange(null)}
      title="取消信任设备"
    >
      <div className="flex flex-col items-center p-6">
        <div className="mb-4 rounded-full bg-red-500/10 p-4">
          <Trash2 size={40} className="text-red-400" />
        </div>
        <p className="mb-2 text-center text-white font-minecraft">
          确定要取消信任该设备吗？
        </p>
        <p className="mb-8 max-w-xs text-center text-xs leading-relaxed text-gray-400">
          取消信任后，该设备将无法向你发起实例和存档投送，但你们仍会保持好友关系。
        </p>
        <div className="flex w-full gap-4">
          <OreButton className="flex-1 !h-[clamp(3rem,5vh,4.75rem)] !text-[length:clamp(1rem,1.1vw,1.375rem)] !text-[#111214] !m-0" variant="secondary" onClick={() => onDeviceToRemoveChange(null)}>
            取消
          </OreButton>
          <OreButton
            className="flex-1 !h-[clamp(3rem,5vh,4.75rem)] !text-[length:clamp(1rem,1.1vw,1.375rem)] !text-white !m-0"
            variant="danger"
            onClick={() => {
              if (deviceToRemove) {
                void onRemoveTrustedDevice(deviceToRemove);
                onDeviceToRemoveChange(null);
              }
            }}
          >
            确定取消
          </OreButton>
        </div>
      </div>
    </OreModal>
  </>
);
