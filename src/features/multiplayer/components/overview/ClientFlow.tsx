import React from 'react';
import { ArrowRightLeft, ChevronLeft, MonitorSmartphone, Users } from 'lucide-react';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OrePinInput } from '../../../../ui/primitives/OrePinInput';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import type { useMultiplayerViewModel } from '../../hooks/useMultiplayerViewModel';

interface ClientFlowProps {
  vm: ReturnType<typeof useMultiplayerViewModel>;
}

const SETUP_FOCUS_ORDER = ['client-return-top', 'client-room', 'client-player', 'client-join', 'client-return-bottom'];
const ACTIVE_FOCUS_ORDER = ['client-stop', 'client-return-bottom'];

export const ClientFlow: React.FC<ClientFlowProps> = ({ vm }) => {
  const { session } = vm;
  const isBusy = session.isBusy;
  const roomCode = session.roomCode;
  const isConnected = session.lifecycle === 'connected' || session.lifecycle === 'guesting';
  
  const focusOrder = isConnected ? ACTIVE_FOCUS_ORDER : SETUP_FOCUS_ORDER;
  const { handleLinearArrow } = useLinearNavigation(
    focusOrder,
    vm.canReturnToChooser ? 'client-return-top' : (isConnected ? 'client-stop' : 'client-room'),
    true
  );

  const renderReturnButton = () =>
    vm.canReturnToChooser ? (
      <FocusItem focusKey="client-return-top" onArrowPress={handleLinearArrow} onEnter={() => vm.setSelectedFlow(null)}>
        {({ ref, focused }) => (
          <div ref={ref as React.RefObject<HTMLDivElement>} className={`rounded-sm transition-shadow duration-150 inline-block ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
            <OreButton type="button" variant="secondary" size="auto" onClick={() => vm.setSelectedFlow(null)} tabIndex={-1}>
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
            <p className="text-[13px] text-[#B1B2B5] mt-1 leading-relaxed">输入房间号加入朋友的世界，然后在游戏内连接本地代理。</p>
          </div>
        </div>
        <div className="flex-shrink-0 ml-4 hidden sm:block">{renderReturnButton()}</div>
      </div>

      {!isConnected ? (
        <>
          <div className="flex flex-col gap-3 border-[2px] border-[#1E1E1F]/50 bg-black/70 p-4 shadow-[inset_0_4px_rgba(0,0,0,0.4)] relative z-10">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-[#B1B2B5] font-minecraft font-bold">
              <span className="text-[#FFE866]">填写房主给您的 6 位加入口令</span>
              <span>JOIN_ROOM</span>
            </div>
            <FocusItem focusKey="client-room" onArrowPress={handleLinearArrow}>
              {({ ref, focused }) => (
                <div ref={ref as React.RefObject<HTMLDivElement>} className={`py-2 flex justify-center rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-2 outline-offset-[4px] outline-[#78C6FF]' : ''}`}>
                  <OrePinInput
                    value={vm.clientRoom}
                    onChange={vm.setClientRoom}
                    length={6}
                    disabled={isBusy}
                  />
                </div>
              )}
            </FocusItem>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <FocusItem focusKey="client-player" onArrowPress={handleLinearArrow}>
              {({ ref, focused }) => (
                <div ref={ref as React.RefObject<HTMLDivElement>} className={`rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-[3px] outline-offset-[2px] outline-white' : ''}`}>
                  <OreInput
                    label="玩家昵称 (选填)"
                    value={vm.clientPlayer}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => vm.setClientPlayer(e.target.value)}
                    placeholder="你的名字"
                    disabled={isBusy}
                    tabIndex={-1}
                  />
                </div>
              )}
            </FocusItem>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 mt-2">
            <div className="sm:hidden w-full">
              {vm.canReturnToChooser && (
                <FocusItem focusKey="client-return-bottom" onArrowPress={handleLinearArrow} onEnter={() => vm.setSelectedFlow(null)}>
                  {({ ref, focused }) => (
                    <div ref={ref as React.RefObject<HTMLDivElement>} className={`rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
                      <OreButton type="button" variant="secondary" size="auto" className="!w-full justify-center" onClick={() => vm.setSelectedFlow(null)} tabIndex={-1}>
                        <span className="inline-flex items-center gap-2">
                          <ChevronLeft size={16} />
                          返回选择
                        </span>
                      </OreButton>
                    </div>
                  )}
                </FocusItem>
              )}
            </div>

            <FocusItem focusKey="client-join" onArrowPress={handleLinearArrow} onEnter={() => { if (vm.canJoinRoom) void vm.handleJoinRoom().catch(() => undefined); }}>
              {({ ref, focused }) => (
                <div ref={ref as React.RefObject<HTMLDivElement>} className={`w-full sm:w-auto rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
                  <OreButton
                    type="button"
                    variant="primary"
                    size="auto"
                    className="!w-full sm:!w-auto justify-center"
                    onClick={() => void vm.handleJoinRoom().catch(() => undefined)}
                    disabled={!vm.canJoinRoom || !vm.clientRoom.trim()}
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
        </>
      ) : (
        <div className="flex flex-col gap-3 mt-4 border-[2px] border-[#1E1E1F]/50 bg-black/70 p-4 shadow-[inset_0_4px_rgba(0,0,0,0.4)] relative z-10">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-[#B1B2B5] font-minecraft font-bold">
            <span className="text-[#FFE866]">已加入房间: {roomCode}</span>
            <span>CONNECTED</span>
          </div>

          <div className="flex items-center gap-3 px-3 py-4 bg-[#78C6FF]/10 border border-[#78C6FF]/20 rounded-sm">
            <div className="flex items-center gap-2 text-[12px] text-[#8CB3FF] font-bold">
              <MonitorSmartphone size={16} />
              请在游戏内通过 "多人游戏"直连添加地址
            </div>
            <div className="flex-1 text-right text-lg font-minecraft font-bold text-white tracking-wider">
              127.0.0.1
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <FocusItem focusKey="client-stop" onArrowPress={handleLinearArrow} onEnter={() => void session.stop()}>
              {({ ref, focused }) => (
                <div ref={ref as React.RefObject<HTMLDivElement>} className={`rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
                  <OreButton
                    type="button"
                    variant="danger"
                    size="auto"
                    onClick={() => void session.stop()}
                    tabIndex={-1}
                  >
                    断开连接
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
