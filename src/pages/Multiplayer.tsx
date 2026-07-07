import React, { useState } from 'react';
import type { MultiplayerSection } from '../features/multiplayer/types';
import { useOnlineServers } from '../features/multiplayer/hooks/useOnlineServers';
import { OnlineServersList } from '../features/multiplayer/components/OnlineServersList';
import { MultiplayerOverview } from '../features/multiplayer/components/Overview';
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { useInputAction } from '../ui/focus/InputDriver';


const Multiplayer: React.FC = () => {
  const showPiHub = false; // 暂时隐藏陶瓦联机
  const [activeSection, setActiveSection] = useState<MultiplayerSection>('online-servers');
  const { servers, adSlots, isLoading, error, fetchServers } = useOnlineServers();

  useInputAction('TAB_LEFT', () => {
    if (showPiHub) setActiveSection('online-servers');
  });
  useInputAction('PAGE_LEFT', () => {
    if (showPiHub) setActiveSection('online-servers');
  });
  useInputAction('TAB_RIGHT', () => {
    if (showPiHub) setActiveSection('multiplayer');
  });
  useInputAction('PAGE_RIGHT', () => {
    if (showPiHub) setActiveSection('multiplayer');
  });

  return (
    <FocusBoundary id="multiplayer-page" isActive={true} className="ore-multiplayer-page">
      {activeSection === 'online-servers' && (
        <OnlineServersList
          servers={servers}
          adSlots={adSlots}
          isLoading={isLoading}
          error={error}
          onRefresh={() => void fetchServers({ force: true })}
        />
      )}

      {activeSection === 'multiplayer' && (
        <MultiplayerOverview />
      )}
    </FocusBoundary>
  );
};

export default Multiplayer;
