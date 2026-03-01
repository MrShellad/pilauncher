// /src/features/Download/components/BottomNav.tsx
import React from 'react';
import type { TabType } from '../hooks/useResourceDownload';

interface BottomNavProps {
  activeTab: TabType;
  tabs: { id: TabType, label: string, icon: any }[];
  onTabChange: (id: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, tabs, onTabChange }) => {
  return (
    <div className="w-full h-16 bg-black/60 backdrop-blur-xl border-t border-white/10 flex items-center justify-between px-8 z-20 flex-shrink-0">
      <div className="text-gray-400 font-minecraft text-sm bg-black/40 border border-white/10 px-3 py-1 rounded-sm shadow-inner hidden md:block">
        [LT] / PgUp
      </div>
      
      <div className="flex space-x-8 w-full justify-center md:w-auto">
        {tabs.map(tab => (
          // ✅ 彻底移除 <FocusItem>，空间导航引擎再也无法进入这里
          <div 
            key={tab.id}
            onClick={() => onTabChange(tab.id)} // 依然保留鼠标点击支持
            className={`flex items-center font-minecraft text-lg transition-all duration-300 relative cursor-pointer px-4 py-2 rounded-sm hover:bg-white/10 ${activeTab === tab.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <tab.icon size={18} className={`mr-2 transition-colors ${activeTab === tab.id ? 'text-ore-green' : ''}`} />
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-ore-green rounded-t-sm shadow-[0_0_8px_rgba(74,222,128,0.8)]" />}
          </div>
        ))}
      </div>

      <div className="text-gray-400 font-minecraft text-sm bg-black/40 border border-white/10 px-3 py-1 rounded-sm shadow-inner hidden md:block">
        [RT] / PgDn
      </div>
    </div>
  );
};