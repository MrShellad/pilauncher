import React from 'react';
import { Plug, RefreshCw } from 'lucide-react';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { useMultiplayerViewModel } from '../../hooks/useMultiplayerViewModel';

import { FlowSelector } from './FlowSelector';
import { HostFlow } from './HostFlow';
import { ClientFlow } from './ClientFlow';
import { LogViewer } from './LogViewer';

interface MultiplayerOverviewProps {}

const defaultSidecarLabel = '项目内置 PiHub';

export const MultiplayerOverview: React.FC<MultiplayerOverviewProps> = () => {
  const vm = useMultiplayerViewModel();

  return (
    <>
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
