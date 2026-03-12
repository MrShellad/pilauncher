import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { MultiplayerSection } from '../features/multiplayer/types';
import { useOnlineServers } from '../features/multiplayer/hooks/useOnlineServers';
import { OnlineServersList } from '../features/multiplayer/components/OnlineServersList';
import { MultiplayerOverview } from '../features/multiplayer/components/MultiplayerOverview';

const Multiplayer: React.FC = () => {
  const [activeSection, setActiveSection] = useState<MultiplayerSection>('online-servers');
  const { servers, adSlots, isLoading, error, lastUpdated, fetchServers, apiUrl } = useOnlineServers();

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-black/35 px-6 py-5 text-white sm:px-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.35em] text-cyan-200/70">Multiplayer Hub</p>
          <h1 className="font-minecraft text-3xl tracking-[0.18em] text-white">联机中心</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            社区服务器
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveSection('online-servers')}
            className={`rounded-full border px-4 py-2 text-sm transition ${activeSection === 'online-servers'
                ? 'border-cyan-300 bg-cyan-300/20 text-white'
                : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white'
              }`}
          >
            在线服务器
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('multiplayer')}
            className={`rounded-full border px-4 py-2 text-sm transition ${activeSection === 'multiplayer'
                ? 'border-cyan-300 bg-cyan-300/20 text-white'
                : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white'
              }`}
          >
            多人联机
          </button>
          <button
            type="button"
            onClick={() => void fetchServers()}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            刷新列表
          </button>
        </div>
      </div>

      {activeSection === 'online-servers' && (
        <OnlineServersList
          servers={servers}
          adSlots={adSlots}
          isLoading={isLoading}
          error={error}
          lastUpdated={lastUpdated}
          apiUrl={apiUrl}
        />
      )}

      {activeSection === 'multiplayer' && (
        <MultiplayerOverview onSwitchToOnlineServers={() => setActiveSection('online-servers')} />
      )}
    </div>
  );
};

export default Multiplayer;
