import React from 'react';
import { CheckCircle, ChevronLeft, Copy, Server } from 'lucide-react';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OrePinInput } from '../../../../ui/primitives/OrePinInput';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
import type { PiHubRole, SignalingServer } from '../../types';

interface HostFlowProps {
  role: PiHubRole;
  isBusy: boolean;
  manualAnswerRequired: boolean;
  hostPort: string;
  setHostPort: (val: string) => void;
  hostSignalingServer: string;
  setHostSignalingServer: (val: string) => void;
  hostAnswerInput: string;
  setHostAnswerInput: (val: string) => void;
  inviteCode: string | null;
  hostAnswerApplied: boolean;
  canCreateRoom: boolean;
  canAcceptAnswer: boolean;
  canReturnToChooser: boolean;
  copyState: string | null;
  handleCopy: (key: string, val?: string | null) => void;
  handleCreateRoom: () => Promise<void>;
  handleAcceptAnswer: () => Promise<void>;
  onReturnToChooser: () => void;
  servers: SignalingServer[];
  isLoadingServers: boolean;
}

export const HostFlow: React.FC<HostFlowProps> = ({
  role,
  isBusy,
  manualAnswerRequired,
  hostPort,
  setHostPort,
  hostSignalingServer,
  setHostSignalingServer,
  hostAnswerInput,
  setHostAnswerInput,
  inviteCode,
  hostAnswerApplied,
  canCreateRoom,
  canAcceptAnswer,
  canReturnToChooser,
  copyState,
  handleCopy,
  handleCreateRoom,
  handleAcceptAnswer,
  onReturnToChooser,
  servers,
  isLoadingServers
}) => {
  const [showCustomSignaling, setShowCustomSignaling] = React.useState(false);
  const [isPinAnimating, setIsPinAnimating] = React.useState(false);
  const prevInviteCode = React.useRef(inviteCode);

  React.useEffect(() => {
    if (inviteCode && !prevInviteCode.current) {
      setIsPinAnimating(true);
      const timer = setTimeout(() => setIsPinAnimating(false), 2000); // 2s max animation time
      return () => clearTimeout(timer);
    }
    prevInviteCode.current = inviteCode;
  }, [inviteCode]);

  const renderReturnButton = () =>
    canReturnToChooser ? (
      <OreButton type="button" variant="secondary" size="auto" onClick={onReturnToChooser}>
        <span className="inline-flex items-center gap-2">
          <ChevronLeft size={16} />
          返回选择
        </span>
      </OreButton>
    ) : null;

  return (
    <div className="flex flex-col gap-4 border-[2px] border-[#6CC349]/40 bg-gradient-to-b from-[#255C1B]/90 to-[#172017]/95 p-4 shadow-[inset_0_2px_rgba(108,195,73,0.3),0_10px_30px_rgba(60,133,39,0.3)] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#6CC349]/20 blur-[80px] pointer-events-none" />

      <div className="flex items-start justify-between border-b-[2px] border-white/10 pb-4 relative z-10">
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-[52px] h-[52px] bg-black/20 border-[2px] border-[#1e1e1f] shadow-[inset_0_-2px_rgba(0,0,0,0.3)] flex items-center justify-center text-[#6cc349]">
            <Server size={24} />
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-minecraft text-white tracking-widest">我要开房</h3>
              <span className="px-2 py-0.5 border-[2px] border-white/10 bg-white/5 text-[11px] uppercase tracking-widest text-[#FFE866] font-minecraft font-bold">Host Flow</span>
            </div>
            <p className="text-[13px] text-[#B1B2B5] mt-1 leading-relaxed">生成邀请码，把本地世界交给朋友加入。</p>
          </div>
        </div>
        <div className="flex-shrink-0 ml-4 hidden sm:block">{renderReturnButton()}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <OreInput
          label="Minecraft 服务端端口"
          value={hostPort}
          onChange={(event: any) => setHostPort(event.target.value)}
          inputMode="numeric"
          placeholder="25565"
          disabled={isBusy}
        />
        <div className="flex flex-col gap-1 w-full justify-end">
          <label className="text-[12px] font-minecraft font-bold uppercase tracking-wider text-[#B1B2B5]">
            信令服务器 {isLoadingServers ? '(测速中...)' : ''}
          </label>
          {showCustomSignaling ? (
            <div className="relative">
              <OreInput
                value={hostSignalingServer}
                onChange={(event: any) => setHostSignalingServer(event.target.value)}
                placeholder="wss://signal.example.com"
                disabled={isBusy}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#78c6ff] hover:text-white"
                onClick={() => {
                  setShowCustomSignaling(false);
                  if (servers.length > 0) setHostSignalingServer(servers[0].url);
                }}
              >
                返回列表
              </button>
            </div>
          ) : (
            <OreDropdown
              disabled={isBusy}
              value={hostSignalingServer}
              options={[
                ...servers.map((s) => ({
                  label: `${s.region} - ${s.provider} ${s.measuredLatencyMs ? `(${s.measuredLatencyMs}ms)` : ''}`,
                  value: s.url
                })),
                { label: '自定义路线...', value: 'custom' }
              ]}
              onChange={(val) => {
                if (val === 'custom') {
                  setShowCustomSignaling(true);
                  setHostSignalingServer('');
                } else {
                  setHostSignalingServer(val);
                }
              }}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-4 border-[2px] border-[#1E1E1F]/50 bg-black/40 backdrop-blur-md p-4 shadow-[inset_0_4px_rgba(0,0,0,0.4)] relative z-10">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-[#B1B2B5] font-minecraft font-bold">
          <span className="text-[#FFE866]">生成并复制口令发给朋友</span>
          <span>CREATE & COPY</span>
        </div>
        
        <div 
          className={`py-2 relative ${inviteCode ? 'cursor-pointer group' : ''}`}
          onClick={() => {
            if (inviteCode) {
               handleCopy('invite', `【PiLauncher】我开启了房间，邀请码是：${inviteCode}，快来加入吧！`);
            }
          }}
        >
          <div className="pointer-events-none flex justify-center">
            <OrePinInput
              value={inviteCode || ''}
              onChange={() => {}}
              length={6}
              disabled={!inviteCode}
              isAnimating={isPinAnimating}
              isAlive={true}
            />
          </div>
          
          {inviteCode && (
            <div className="absolute inset-0 bg-[#6CC349]/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
              <span className="bg-[#172017]/90 text-white border-[1px] border-[#6CC349] text-sm px-3 py-1 font-bold inline-flex items-center gap-2 shadow-[0_0_10px_rgba(108,195,73,0.3)]">
                {copyState === 'invite' ? <CheckCircle size={16} className="text-[#6CC349]" /> : <Copy size={16} />}
                {copyState === 'invite' ? '分享文案已复制！' : '点击复制分享文案'}
              </span>
            </div>
          )}
        </div>

        {!inviteCode && (
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 mt-2">
            <div className="sm:hidden w-full">
              {canReturnToChooser && (
                <OreButton type="button" variant="secondary" size="auto" className="!w-full justify-center" onClick={onReturnToChooser}>
                  <span className="inline-flex items-center gap-2">
                    <ChevronLeft size={16} />
                    返回选择
                  </span>
                </OreButton>
              )}
            </div>

            <OreButton
              type="button"
              variant="primary"
              size="auto"
              className="!w-full sm:!w-auto justify-center"
              onClick={() => void handleCreateRoom().catch(() => undefined)}
              disabled={!canCreateRoom}
            >
              创建房间并生成口令
            </OreButton>
          </div>
        )}
      </div>

      {inviteCode && (
        <div className="flex flex-col gap-3 border-[2px] border-[#1E1E1F]/50 bg-black/40 backdrop-blur-md p-4 shadow-[inset_0_4px_rgba(0,0,0,0.4)] relative z-10">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-[#B1B2B5] font-minecraft font-bold">
          <span className="text-[#FFE866]">填入朋友的应答码</span>
          <span>{manualAnswerRequired ? '手动必填' : '自动回传后可省略'}</span>
        </div>
        <textarea
          className="w-full min-h-[4rem] border-[2px] border-[#1E1E1F] bg-[#141415] p-3 text-[#FFFFFF] font-mono placeholder:text-[#58585A] resize-y shadow-[inset_2px_2px_rgba(255,255,255,0.05)] text-sm leading-normal focus:outline-none focus:border-white transition-colors"
          value={hostAnswerInput}
          onChange={(event: any) => setHostAnswerInput(event.target.value)}
          placeholder="当对方通过 JOIN_ROOM 生成 answer_code 后，把内容粘贴到这里"
          disabled={isBusy || role === 'client'}
        />
        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-2">
          {hostAnswerApplied && (
            <div className="inline-flex items-center justify-center gap-2 px-3 py-2 border-[2px] border-[#3C8527] bg-[#3C8527]/20 text-[#6CC349] font-bold text-sm shadow-[inset_0_-2px_#1D4D13] w-full sm:w-auto">
              <CheckCircle size={16} />
              已应用远端应答
            </div>
          )}
          <OreButton
            type="button"
            variant="primary"
            size="auto"
            className="!w-full sm:!w-auto justify-center"
            onClick={() => void handleAcceptAnswer().catch(() => undefined)}
            disabled={!canAcceptAnswer}
          >
            导入应答码
          </OreButton>
        </div>
      </div>
      )}
    </div>
  );
};
