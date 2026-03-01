// /src/features/Download/components/BottomNav.tsx
import React from 'react';
import type { TabType } from '../hooks/useResourceDownload';

interface BottomNavProps {
  activeTab: TabType;
  tabs: { id: TabType, label: string, icon: any }[];
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, tabs }) => {
  return (
    <div className="absolute bottom-0 w-full h-16 bg-black/60 backdrop-blur-xl border-t border-white/10 flex items-center justify-between px-8 z-20">
      <div className="text-gray-400 font-minecraft text-sm bg-black/40 border border-white/10 px-3 py-1 rounded-sm shadow-inner hidden md:block">
        [LT] / PgUp
      </div>
      
      <div className="flex space-x-8 w-full justify-center md:w-auto">
        {tabs.map(tab => (
          <div key={tab.id} className={`flex items-center font-minecraft text-lg transition-all duration-300 relative ${activeTab === tab.id ? 'text-white' : 'text-gray-500'}`}>
            <tab.icon size={18} className={`mr-2 transition-colors ${activeTab === tab.id ? 'text-ore-green' : ''}`} />
            {tab.label}
            {activeTab === tab.id && <div className="absolute -bottom-5 w-full h-[3px] bg-ore-green rounded-t-sm shadow-[0_0_8px_rgba(74,222,128,0.8)]" />}
          </div>
        ))}
      </div>

      <div className="text-gray-400 font-minecraft text-sm bg-black/40 border border-white/10 px-3 py-1 rounded-sm shadow-inner hidden md:block">
        [RT] / PgDn
      </div>
    </div>
  );
};