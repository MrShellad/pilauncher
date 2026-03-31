import React from 'react';
import { Plug, RefreshCw } from 'lucide-react';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { useMultiplayerViewModel } from '../../hooks/useMultiplayerViewModel';
import { StatusStrip } from './StatusStrip';
import { FlowSelector } from './FlowSelector';
import { HostFlow } from './HostFlow';
import { ClientFlow } from './ClientFlow';
import { LogViewer } from './LogViewer';

interface MultiplayerOverviewProps {}

const defaultSidecarLabel = '项目内置 PiHub';

export const MultiplayerOverview: React.FC<MultiplayerOverviewProps> = () => {
  const vm = useMultiplayerViewModel();
  const currentSidecarLabel = vm.session.activeStrategy?.label || defaultSidecarLabel;

  return (
    <section className="ore-multiplayer-surface">
      <header className="ore-multiplayer-panel-header">
        <div className="ore-multiplayer-panel-heading">
          <h2 className="ore-multiplayer-panel-title">PiHub 直连</h2>
          <p className="ore-multiplayer-panel-subtitle">当前接入：{currentSidecarLabel}</p>
        </div>

        <div className="ore-multiplayer-inline-actions">
          <OreButton
            type="button"
            size="auto"
            variant="secondary"
            onClick={() => void vm.session.start().catch(() => undefined)}
            disabled={vm.session.lifecycle === 'starting'}
          >
            <span className="inline-flex items-center gap-2">
              <Plug size={16} />
              打开 PiHub
            </span>
          </OreButton>
          <OreButton
            type="button"
            size="auto"
            variant="secondary"
            onClick={() => void vm.session.restart().catch(() => undefined)}
            disabled={vm.session.lifecycle === 'starting'}
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCw size={16} />
              重开 PiHub
            </span>
          </OreButton>
          <OreButton
            type="button"
            size="auto"
            variant="danger"
            onClick={() => void vm.session.stop().catch(() => undefined)}
            disabled={vm.session.lifecycle === 'idle' || vm.session.lifecycle === 'starting'}
          >
            关掉 PiHub
          </OreButton>
        </div>
      </header>

      <div className="ore-multiplayer-scroll">
        <div className="ore-multiplayer-stack">
          <StatusStrip
            lifecycle={vm.session.lifecycle}
            busyLabel={vm.session.busyLabel}
            peerConnectionState={vm.session.peerConnectionState}
            tunnelInfo={vm.session.tunnelInfo}
            localProxyPort={vm.session.localProxyPort}
            role={vm.session.role}
            selectedFlow={vm.selectedFlow}
          />

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
              <div className="ore-multiplayer-stack ore-multiplayer-stack--secondary">
                <LogViewer logs={vm.session.logs} lastError={vm.session.lastError} />
              </div>
              <div className="ore-multiplayer-stack ore-multiplayer-stack--primary">
                {vm.selectedFlow === 'host' ? (
                  <HostFlow
                    role={vm.session.role as any}
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
    </section>
  );
};
