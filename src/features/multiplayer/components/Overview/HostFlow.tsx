import React from 'react';
import { ChevronLeft, Server, Copy, CheckCircle } from 'lucide-react';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import type { useMultiplayerViewModel } from '../../hooks/useMultiplayerViewModel';

interface HostFlowProps {
  vm: ReturnType<typeof useMultiplayerViewModel>;
}

const SETUP_FOCUS_ORDER = ['host-return-top', 'host-room', 'host-player', 'host-create', 'host-return-bottom'];
const ACTIVE_FOCUS_ORDER = ['host-room-copy', 'host-stop', 'host-return-bottom'];

export const HostFlow: React.FC<HostFlowProps> = ({ vm }) => {
  const { session } = vm;
  const isBusy = session.isBusy;
  const roomCode = session.roomCode;
  
  const focusOrder = roomCode ? ACTIVE_FOCUS_ORDER : SETUP_FOCUS_ORDER;
  const { handleLinearArrow } = useLinearNavigation(
    focusOrder,
    vm.canReturnToChooser ? 'host-return-top' : (roomCode ? 'host-room-copy' : 'host-room'),
    true
  );

  const renderReturnButton = () =>
    vm.canReturnToChooser ? (
      <FocusItem focusKey="host-return-top" onArrowPress={handleLinearArrow} onEnter={() => vm.setSelectedFlow(null)}>
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
            <p className="text-[13px] text-[#B1B2B5] mt-1 leading-relaxed">提供房间号给朋友，他们可以随时加入。</p>
          </div>
        </div>
        <div className="flex-shrink-0 ml-4 hidden sm:block">{renderReturnButton()}</div>
      </div>

      {!roomCode ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FocusItem focusKey="host-room" onArrowPress={handleLinearArrow}>
              {({ ref, focused }) => (
                <div ref={ref as React.RefObject<HTMLDivElement>} className={`rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-[3px] outline-offset-[2px] outline-white' : ''}`}>
                  <OreInput
                    label="自定义房间号 (留空自动生成)"
                    value={vm.hostRoom}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => vm.setHostRoom(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    placeholder="例如: A1B2C3"
                    disabled={isBusy}
                    maxLength={6}
                    tabIndex={-1}
                  />
                </div>
              )}
            </FocusItem>

            <FocusItem focusKey="host-player" onArrowPress={handleLinearArrow}>
              {({ ref, focused }) => (
                <div ref={ref as React.RefObject<HTMLDivElement>} className={`rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-[3px] outline-offset-[2px] outline-white' : ''}`}>
                  <OreInput
                    label="玩家昵称 (选填)"
                    value={vm.hostPlayer}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => vm.setHostPlayer(e.target.value)}
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
                <FocusItem focusKey="host-return-bottom" onArrowPress={handleLinearArrow} onEnter={() => vm.setSelectedFlow(null)}>
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

            <FocusItem focusKey="host-create" onArrowPress={handleLinearArrow} onEnter={() => { if (vm.canCreateRoom) void vm.handleCreateRoom().catch(() => undefined); }}>
              {({ ref, focused }) => (
                <div ref={ref as React.RefObject<HTMLDivElement>} className={`w-full sm:w-auto rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
                  <OreButton
                    type="button"
                    variant="primary"
                    size="auto"
                    className="!w-full sm:!w-auto justify-center"
                    onClick={() => void vm.handleCreateRoom().catch(() => undefined)}
                    disabled={!vm.canCreateRoom}
                    tabIndex={-1}
                  >
                    创建联机房间
                  </OreButton>
                </div>
              )}
            </FocusItem>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 mt-4 border-[2px] border-[#1E1E1F]/50 bg-black/70 p-4 shadow-[inset_0_4px_rgba(0,0,0,0.4)] relative z-10">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-[#B1B2B5] font-minecraft font-bold">
            <span className="text-[#FFE866]">房间已创建，复制房间号发给朋友</span>
            <span>ROOM CREATED</span>
          </div>

          <FocusItem focusKey="host-room-copy" onArrowPress={handleLinearArrow} onEnter={() => { if (roomCode) vm.handleCopy('room', roomCode); }}>
            {({ ref, focused }) => (
              <div
                ref={ref as React.RefObject<HTMLDivElement>}
                className={`py-2 relative cursor-pointer group ${focused ? 'outline outline-2 outline-offset-[4px] outline-[#6CC349]' : ''}`}
                onClick={() => {
                  if (roomCode) {
                    vm.handleCopy('room', roomCode);
                  }
                }}
              >
                <div className="pointer-events-none flex justify-center text-3xl font-minecraft tracking-wider text-white">
                  {roomCode}
                </div>

                <div className="absolute inset-0 bg-[#0F1A10]/85 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="bg-[#172017]/90 text-white border-[1px] border-[#6CC349] text-sm px-3 py-1 font-bold inline-flex items-center gap-2 shadow-[0_0_10px_rgba(108,195,73,0.3)]">
                    {vm.copyState === 'room' ? <CheckCircle size={16} className="text-[#6CC349]" /> : <Copy size={16} />}
                    {vm.copyState === 'room' ? '房间号已复制！' : '点击复制房间号'}
                  </span>
                </div>
              </div>
            )}
          </FocusItem>

          <div className="flex justify-end mt-4">
            <FocusItem focusKey="host-stop" onArrowPress={handleLinearArrow} onEnter={() => void session.stop()}>
              {({ ref, focused }) => (
                <div ref={ref as React.RefObject<HTMLDivElement>} className={`rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
                  <OreButton
                    type="button"
                    variant="danger"
                    size="auto"
                    onClick={() => void session.stop()}
                    tabIndex={-1}
                  >
                    停止并退出房间
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
