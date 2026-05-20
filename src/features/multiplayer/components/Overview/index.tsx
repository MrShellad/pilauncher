import React from 'react';
import { useMultiplayerViewModel } from '../../hooks/useMultiplayerViewModel';

import { FlowSelector } from './FlowSelector';
import { HostFlow } from './HostFlow';
import { ClientFlow } from './ClientFlow';
import { LogViewer } from './LogViewer';

export const MultiplayerOverview: React.FC = () => {
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
                    vm={vm}
                  />
                ) : (
                  <ClientFlow
                    vm={vm}
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
