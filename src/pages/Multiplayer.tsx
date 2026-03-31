import React, { useState } from 'react';
import type { MultiplayerSection } from '../features/multiplayer/types';
import { useOnlineServers } from '../features/multiplayer/hooks/useOnlineServers';
import { OnlineServersList } from '../features/multiplayer/components/OnlineServersList';
import { MultiplayerOverview } from '../features/multiplayer/components/Overview';
import { OreToggleButton } from '../ui/primitives/OreToggleButton';
import { useTranslation } from 'react-i18next';

import '../style/pages/Multiplayer.css';

const Multiplayer: React.FC = () => {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<MultiplayerSection>('online-servers');
  const { servers, adSlots, isLoading, error, lastUpdated, fetchServers, apiUrl } = useOnlineServers();

  return (
    <div className="ore-multiplayer-page">
      <div className="ore-multiplayer-shell">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border-b-[2px] border-[#1e1e1f] bg-gradient-to-b from-[#48494A]/90 to-[#313233]/80 shadow-[inset_0_-4px_rgba(0,0,0,0.18)] relative z-10">
          <div className="flex flex-col gap-1 pr-4">
            <h1 className="m-0 text-white font-minecraft text-[clamp(24px,2.5vw,32px)] leading-none tracking-[0.08em] drop-shadow-[3px_3px_0_rgba(0,0,0,0.32)]">
              {t('multiplayer.title')}
            </h1>
            <p className="m-0 text-[#d0d1d4] text-[14px] leading-[1.45] max-w-[38rem]">
              {t('multiplayer.description')}
            </p>
          </div>

          <div className="w-full md:w-auto flex-shrink-0 mt-2 md:mt-0">
            <OreToggleButton
              options={[
                { label: t('multiplayer.onlineServers'), value: 'online-servers' },
                { label: t('multiplayer.piHub'), value: 'multiplayer' }
              ]}
              value={activeSection}
              onChange={(value) => setActiveSection(value as MultiplayerSection)}
              size="lg"
              focusable={false}
              className="!w-full md:!w-[24rem]"
            />
          </div>
        </header>

        <div className="ore-multiplayer-body">
          {activeSection === 'online-servers' && (
            <OnlineServersList
              servers={servers}
              adSlots={adSlots}
              isLoading={isLoading}
              error={error}
              lastUpdated={lastUpdated}
              apiUrl={apiUrl}
              onRefresh={() => void fetchServers()}
            />
          )}

          {activeSection === 'multiplayer' && (
            <MultiplayerOverview />
          )}
        </div>
      </div>
    </div>
  );
};

export default Multiplayer;
