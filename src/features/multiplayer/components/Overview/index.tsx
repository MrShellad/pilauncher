import React from 'react';
import { Plug, RefreshCw } from 'lucide-react';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { useMultiplayerViewModel } from '../../hooks/useMultiplayerViewModel';

import { FlowSelector } from './FlowSelector';
import { HostFlow } from './HostFlow';
import { ClientFlow } from './ClientFlow';
import { LogViewer } from './LogViewer';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';

interface MultiplayerOverviewProps {}

const defaultSidecarLabel = '项目内置 PiHub';

const HEADER_FOCUS_ORDER = ['pihub-start', 'pihub-restart', 'pihub-stop'];

export const MultiplayerOverview: React.FC<MultiplayerOverviewProps> = () => {
  const vm = useMultiplayerViewModel();
  const currentSidecarLabel = vm.session.activeStrategy?.label || defaultSidecarLabel;

  const { handleLinearArrow } = useLinearNavigation(HEADER_FOCUS_ORDER, 'pihub-start');

  return (
    <>
      <header className="ore-multiplayer-panel-header">
        <div className="ore-multiplayer-panel-heading">
          <h2 className="ore-multiplayer-panel-title">PiHub 直连</h2>
          <p className="ore-multiplayer-panel-subtitle">当前接入：{currentSidecarLabel}</p>
        </div>

        {/* 启动状态 & 连接状态 小标签 */}
        <div className="ore-multiplayer-header-status">
          <span
            className="ore-multiplayer-status-badge"
            data-tone={
              vm.session.lifecycle === 'ready'
                ? 'accent'
                : vm.session.lifecycle === 'starting'
                  ? 'warning'
                  : vm.session.lifecycle === 'error'
                    ? 'danger'
                    : undefined
            }
          >
            {vm.session.busyLabel ||
              ({
                idle: '未启动',
                starting: '启动中',
                ready: '已就绪',
                stopped: '已停止',
                error: '启动失败',
              } as Record<string, string>)[vm.session.lifecycle] || vm.session.lifecycle}
          </span>
          <span
            className="ore-multiplayer-status-badge"
            data-tone={
              vm.session.peerConnectionState === 'connected'
                ? 'accent'
                : vm.session.peerConnectionState === 'connecting' || vm.session.peerConnectionState === 'new'
                  ? 'warning'
                  : vm.session.peerConnectionState === 'failed' ||
                    vm.session.peerConnectionState === 'closed' ||
                    vm.session.peerConnectionState === 'disconnected'
                    ? 'danger'
                    : undefined
            }
          >
            {vm.session.peerConnectionState || '等待连接'}
          </span>
        </div>

        <div className="ore-multiplayer-inline-actions">
          <FocusItem focusKey="pihub-start" onArrowPress={handleLinearArrow} onEnter={() => { if (vm.session.lifecycle !== 'starting') void vm.session.start().catch(() => undefined); }}>
            {({ ref, focused }) => (
              <div ref={ref as React.RefObject<HTMLDivElement>} className={`rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
                <OreButton
                  type="button"
                  size="auto"
                  variant="primary"
                  onClick={() => void vm.session.start().catch(() => undefined)}
                  disabled={vm.session.lifecycle === 'starting'}
                  tabIndex={-1}
                >
                  <span className="inline-flex items-center gap-2">
                    <Plug size={16} />
                    打开 PiHub
                  </span>
                </OreButton>
              </div>
            )}
          </FocusItem>

          <FocusItem focusKey="pihub-restart" onArrowPress={handleLinearArrow} onEnter={() => { if (vm.session.lifecycle !== 'starting') void vm.session.restart().catch(() => undefined); }}>
            {({ ref, focused }) => (
              <div ref={ref as React.RefObject<HTMLDivElement>} className={`rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
                <OreButton
                  type="button"
                  size="auto"
                  variant="secondary"
                  onClick={() => void vm.session.restart().catch(() => undefined)}
                  disabled={vm.session.lifecycle === 'starting'}
                  tabIndex={-1}
                >
                  <span className="inline-flex items-center gap-2">
                    <RefreshCw size={16} />
                    重开 PiHub
                  </span>
                </OreButton>
              </div>
            )}
          </FocusItem>

          <FocusItem focusKey="pihub-stop" onArrowPress={handleLinearArrow} onEnter={() => { if (vm.session.lifecycle !== 'idle' && vm.session.lifecycle !== 'starting') void vm.session.stop().catch(() => undefined); }}>
            {({ ref, focused }) => (
              <div ref={ref as React.RefObject<HTMLDivElement>} className={`rounded-sm transition-shadow duration-150 ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
                <OreButton
                  type="button"
                  size="auto"
                  variant="danger"
                  onClick={() => void vm.session.stop().catch(() => undefined)}
                  disabled={vm.session.lifecycle === 'idle' || vm.session.lifecycle === 'starting'}
                  tabIndex={-1}
                >
                  关掉 PiHub
                </OreButton>
              </div>
            )}
          </FocusItem>
        </div>
      </header>

      <div className="ore-multiplayer-scroll">
        <div className="ore-multiplayer-stack">
          {vm.selectedFlow === null ? (
            <div className="ore-multiplayer-chooser">
              <FlowSelector onSelect={vm.setSelectedFlow} />

              {vm.shouldShowIdleLog && (
                <div className="ore-multiplayer-chooser-log">
                  <LogViewer logs={vm.session.logs} lastError={vm.session.lastError} />
                </div>
              )}
            </div>
          ) : (
            <div className="ore-multiplayer-p2p-grid">
              <div className="ore-multiplayer-stack ore-multiplayer-stack--secondary h-full">
                <LogViewer logs={vm.session.logs} lastError={vm.session.lastError} />
              </div>
              <div className="ore-multiplayer-stack ore-multiplayer-stack--primary h-full">
                {vm.selectedFlow === 'host' ? (
                  <HostFlow
                    role={vm.session.role as 'host' | 'client' | null}
                    isBusy={vm.session.isBusy}
                    manualAnswerRequired={vm.session.manualAnswerRequired}
                    inviteCode={vm.session.inviteCode}
                    hostAnswerApplied={vm.session.hostAnswerApplied}
                    hostPort={vm.hostPort}
                    setHostPort={vm.setHostPort}
                    hostSignalingServer={vm.hostSignalingServer}
                    setHostSignalingServer={vm.setHostSignalingServer}
                    hostAnswerInput={vm.hostAnswerInput}
                    setHostAnswerInput={vm.setHostAnswerInput}
                    canCreateRoom={vm.canCreateRoom}
                    canAcceptAnswer={vm.canAcceptAnswer}
                    canReturnToChooser={vm.canReturnToChooser}
                    copyState={vm.copyState}
                    handleCopy={vm.handleCopy}
                    handleCreateRoom={vm.handleCreateRoom}
                    handleAcceptAnswer={vm.handleAcceptAnswer}
                    onReturnToChooser={() => vm.setSelectedFlow(null)}
                    servers={vm.servers}
                    isLoadingServers={vm.isLoadingServers}
                  />
                ) : (
                  <ClientFlow
                    isBusy={vm.session.isBusy}
                    manualAnswerRequired={vm.session.manualAnswerRequired}
                    answerCode={vm.session.answerCode}
                    tunnelInfo={vm.session.tunnelInfo}
                    inviteInput={vm.inviteInput}
                    setInviteInput={vm.setInviteInput}
                    clientProxyPort={vm.clientProxyPort}
                    setClientProxyPort={vm.setClientProxyPort}
                    clientSignalingServer={vm.clientSignalingServer}
                    setClientSignalingServer={vm.setClientSignalingServer}
                    canJoinRoom={vm.canJoinRoom}
                    canReturnToChooser={vm.canReturnToChooser}
                    copyState={vm.copyState}
                    handleCopy={vm.handleCopy}
                    handleJoinRoom={vm.handleJoinRoom}
                    onReturnToChooser={() => vm.setSelectedFlow(null)}
                    servers={vm.servers}
                    isLoadingServers={vm.isLoadingServers}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
