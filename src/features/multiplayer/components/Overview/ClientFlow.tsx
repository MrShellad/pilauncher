import React from 'react';
import { ArrowRightLeft, ChevronLeft, Copy, MonitorSmartphone, Users } from 'lucide-react';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OrePinInput } from '../../../../ui/primitives/OrePinInput';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
import type { PiHubTunnelInfo, SignalingServer } from '../../types';
import { getCachedCustomSignaling, setCachedCustomSignaling } from '../../hooks/useMultiplayerViewModel';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';

interface ClientFlowProps {
  isBusy: boolean;
  manualAnswerRequired: boolean;
  inviteInput: string;
  setInviteInput: (val: string) => void;
  clientProxyPort: string;
  setClientProxyPort: (val: string) => void;
  clientSignalingServer: string;
  setClientSignalingServer: (val: string) => void;
  answerCode: string | null;
  tunnelInfo: PiHubTunnelInfo | null;
  canJoinRoom: boolean;
  canReturnToChooser: boolean;
  copyState: string | null;
  handleCopy: (key: string, val?: string | null) => void;
  handleJoinRoom: () => Promise<void>;
  onReturnToChooser: () => void;
  servers: SignalingServer[];
  isLoadingServers: boolean;
}

const SETUP_FOCUS_ORDER = ['client-return-top', 'client-proxy-port', 'client-signal-dropdown', 'client-pin-input', 'client-return-bottom', 'client-join'];
const SETUP_CUSTOM_ORDER = ['client-return-top', 'client-proxy-port', 'client-custom-signal', 'client-signal-back', 'client-pin-input', 'client-return-bottom', 'client-join'];
const ANSWER_FOCUS_ORDER = ['client-return-top', 'client-proxy-port', 'client-signal-dropdown', 'client-pin-input', 'client-return-bottom', 'client-join', 'client-copy-answer'];

export const ClientFlow: React.FC<ClientFlowProps> = ({
  isBusy,
  manualAnswerRequired,
  inviteInput,
  setInviteInput,
  clientProxyPort,
  setClientProxyPort,
  clientSignalingServer,
  setClientSignalingServer,
  answerCode,
  tunnelInfo,
  canJoinRoom,
  canReturnToChooser,
  copyState,
  handleCopy,
  handleJoinRoom,
  onReturnToChooser,
  servers,
  isLoadingServers
}) => {
  const cachedSignaling = getCachedCustomSignaling();
  const [showCustomSignaling, setShowCustomSignaling] = React.useState(!!cachedSignaling && clientSignalingServer === cachedSignaling);

  const focusOrder = answerCode
    ? ANSWER_FOCUS_ORDER
    : showCustomSignaling
      ? SETUP_CUSTOM_ORDER
      : SETUP_FOCUS_ORDER;

  const { handleLinearArrow } = useLinearNavigation(
    focusOrder,
    canReturnToChooser ? 'client-return-top' : 'client-proxy-port'
  );

  const renderReturnButton = () =>
    canReturnToChooser ? (
      <FocusItem focusKey="client-return-top" onArrowPress={handleLinearArrow} onEnter={onReturnToChooser}>
        {({ ref, focused }) => (
          <div ref={ref as React.RefObject<HTMLDivElement>} className={`rounded-sm transition-shadow duration-150 inline-block ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
            <OreButton type="button" variant="secondary" size="auto" onClick={onReturnToChooser} tabIndex={-1}>
              <span className="inline-flex items-center gap-2">
                <ChevronLeft size={16} />
                返回选择
              </span>
            </OreButton>
          </div>
        )}
      </FocusItem>
    ) : null;

  return (
    <div className="flex flex-col gap-4 border-[2px] border-[#78C6FF]/40 bg-gradient-to-b from-[#1B3666]/90 to-[#121620]/95 p-4 shadow-[inset_0_2px_rgba(120,198,255,0.3),0_10px_30px_rgba(46,107,229,0.3)] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#78C6FF]/20 blur-[80px] pointer-events-none" />

      <div className="flex items-start justify-between border-b-[2px] border-white/10 pb-4 relative z-10">
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-[52px] h-[52px] bg-black/20 border-[2px] border-[#1e1e1f] shadow-[inset_0_-2px_rgba(0,0,0,0.3)] flex items-center justify-center text-[#78c6ff]">
            <Users size={24} />
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-minecraft text-white tracking-widest">我要加入房间</h3>
              <span className="px-2 py-0.5 border-[2px] border-white/10 bg-white/5 text-[11px] uppercase tracking-widest text-[#FFE866] font-minecraft font-bold">Join Flow</span>
            </div>
            <p className="text-[13px] text-[#B1B2B5] mt-1 leading-relaxed">输入邀请码，在本地建立一个可以直连的代理端口。</p>
          </div>
        </div>
        <div className="flex-shrink-0 ml-4 hidden sm:block">{renderReturnButton()}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FocusItem focusKey="client-proxy-port" onArrowPress={handleLinearArrow}>
          {({ ref, focused }) => (
            <div ref={ref as React.RefObject<HTMLDivElement>} className={`rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-[3px] outline-offset-[2px] outline-white' : ''}`}>
              <OreInput
                label="本地代理端口"
                value={clientProxyPort}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setClientProxyPort(event.target.value)}
                inputMode="numeric"
                placeholder="50001"
                disabled={isBusy}
                tabIndex={-1}
              />
            </div>
          )}
        </FocusItem>

        <div className="flex flex-col gap-1 w-full justify-end">
          <label className="text-[12px] font-minecraft font-bold uppercase tracking-wider text-[#B1B2B5]">
            信令服务器 {isLoadingServers ? '(测速中...)' : ''}
          </label>
          {showCustomSignaling ? (
            <div className="relative">
              <FocusItem focusKey="client-custom-signal" onArrowPress={handleLinearArrow}>
                {({ ref, focused }) => (
                  <div ref={ref as React.RefObject<HTMLDivElement>} className={`rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-[3px] outline-offset-[2px] outline-white' : ''}`}>
                    <OreInput
                      value={clientSignalingServer}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                        const val = event.target.value;
                        setClientSignalingServer(val);
                        setCachedCustomSignaling(val);
                      }}
                      placeholder="wss://signal.example.com"
                      disabled={isBusy}
                      tabIndex={-1}
                    />
                  </div>
                )}
              </FocusItem>
              <FocusItem focusKey="client-signal-back" onArrowPress={handleLinearArrow} onEnter={() => { setShowCustomSignaling(false); if (servers.length > 0) setClientSignalingServer(servers[0].url); }}>
                {({ ref, focused }) => (
                  <button
                    ref={ref as React.RefObject<HTMLButtonElement>}
                    type="button"
                    className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#78c6ff] hover:text-white rounded-sm px-1 ${focused ? 'outline outline-2 outline-offset-2 outline-[#78c6ff]' : ''}`}
                    onClick={() => {
                      setShowCustomSignaling(false);
                      if (servers.length > 0) setClientSignalingServer(servers[0].url);
                    }}
                    tabIndex={-1}
                  >
                    返回列表
                  </button>
                )}
              </FocusItem>
            </div>
          ) : (
            <FocusItem focusKey="client-signal-dropdown" onArrowPress={handleLinearArrow}>
              {({ ref, focused }) => (
                <div ref={ref as React.RefObject<HTMLDivElement>} className={`rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-[3px] outline-offset-[2px] outline-white' : ''}`}>
                  <OreDropdown
                    disabled={isBusy}
                    value={clientSignalingServer}
                    options={[
                      ...servers.map((s) => ({
                        label: `${s.region} - ${s.provider} ${s.measuredLatencyMs ? `(${s.measuredLatencyMs}ms)` : ''}`,
                        value: s.url
                      })),
                      ...(cachedSignaling ? [{ label: `历史设定 (${cachedSignaling})`, value: cachedSignaling }] : []),
                      { label: '自定义路线...', value: 'custom' }
                    ]}
                    onChange={(val) => {
                      if (val === 'custom') {
                        setShowCustomSignaling(true);
                        setClientSignalingServer('');
                      } else {
                        setClientSignalingServer(val);
                      }
                    }}
                  />
                </div>
              )}
            </FocusItem>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-[2px] border-[#1E1E1F]/50 bg-black/70 p-4 shadow-[inset_0_4px_rgba(0,0,0,0.4)] relative z-10">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-[#B1B2B5] font-minecraft font-bold">
          <span className="text-[#FFE866]">填写房主给您的 6 位加入口令</span>
          <span>JOIN_ROOM</span>
        </div>
        <FocusItem focusKey="client-pin-input" onArrowPress={handleLinearArrow}>
          {({ ref, focused }) => (
            <div ref={ref as React.RefObject<HTMLDivElement>} className={`py-2 flex justify-center rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-2 outline-offset-[4px] outline-[#78C6FF]' : ''}`}>
              <OrePinInput
                value={inviteInput}
                onChange={setInviteInput}
                length={6}
                disabled={isBusy}
              />
            </div>
          )}
        </FocusItem>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2 border-t border-white/5 pt-4">
          <div className="flex items-center gap-3 px-3 py-2 bg-[#78C6FF]/10 border border-[#78C6FF]/20 rounded-sm">
            <div className="flex items-center gap-2 text-[12px] text-[#8CB3FF] font-bold">
              <MonitorSmartphone size={14} />
              连接地址
            </div>
            <div className="text-sm font-minecraft font-bold text-white tracking-wider">
              127.0.0.1:{tunnelInfo?.proxyPort || clientProxyPort}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center gap-3 w-full sm:w-auto">
            {canReturnToChooser && (
              <FocusItem focusKey="client-return-bottom" onArrowPress={handleLinearArrow} onEnter={onReturnToChooser}>
                {({ ref, focused }) => (
                  <div ref={ref as React.RefObject<HTMLDivElement>} className={`w-full sm:w-auto rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
                    <OreButton type="button" variant="secondary" size="auto" className="!w-full sm:!w-auto justify-center" onClick={onReturnToChooser} tabIndex={-1}>
                      <span className="inline-flex items-center gap-2">
                        <ChevronLeft size={16} />
                        返回
                      </span>
                    </OreButton>
                  </div>
                )}
              </FocusItem>
            )}

            <FocusItem focusKey="client-join" onArrowPress={handleLinearArrow} onEnter={() => { if (canJoinRoom) void handleJoinRoom().catch(() => undefined); }}>
              {({ ref, focused }) => (
                <div ref={ref as React.RefObject<HTMLDivElement>} className={`w-full sm:w-auto rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
                  <OreButton
                    type="button"
                    variant="primary"
                    size="auto"
                    className="!w-full sm:!w-auto justify-center"
                    onClick={() => void handleJoinRoom().catch(() => undefined)}
                    disabled={!canJoinRoom}
                    tabIndex={-1}
                  >
                    <span className="inline-flex items-center gap-2">
                      <ArrowRightLeft size={16} />
                      加入房间
                    </span>
                  </OreButton>
                </div>
              )}
            </FocusItem>
          </div>
        </div>
      </div>

      {answerCode && (
        <div className="flex flex-col gap-3 mt-2 border-[2px] border-[#1E1E1F]/50 bg-black/70 p-4 shadow-[inset_0_4px_rgba(0,0,0,0.4)] relative z-10">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-[#B1B2B5] font-minecraft font-bold">
            <span className="text-[#FFE866]">发给房主这个应答码</span>
            <span>{manualAnswerRequired ? '请手动发送' : '已自动发送，可作兜底'}</span>
          </div>
          <div className="w-full border-[2px] border-[#1E1E1F] bg-[#141415] p-3 text-[#FFFFFF] font-mono break-all min-h-[4rem] shadow-[inset_2px_2px_rgba(255,255,255,0.05)] text-sm leading-normal select-all">
            {answerCode}
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-3 mt-2">
            <FocusItem focusKey="client-copy-answer" onArrowPress={handleLinearArrow} onEnter={() => handleCopy('answer', answerCode)}>
              {({ ref, focused }) => (
                <div ref={ref as React.RefObject<HTMLDivElement>} className={`w-full sm:w-auto rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
                  <OreButton
                    type="button"
                    variant="secondary"
                    size="auto"
                    className="!w-full sm:!w-auto justify-center"
                    onClick={() => handleCopy('answer', answerCode)}
                    tabIndex={-1}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Copy size={16} />
                      {copyState === 'answer' ? '已复制应答码' : '复制应答码'}
                    </span>
                  </OreButton>
                </div>
              )}
            </FocusItem>
          </div>
        </div>
      )}
    </div>
  );
};
