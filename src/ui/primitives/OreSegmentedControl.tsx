// /src/ui/primitives/OreSegmentedControl.tsx
import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface OreSegmentedControlProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const OreSegmentedControl: React.FC<OreSegmentedControlProps> = ({
  tabs,
  activeTab,
  onChange,
  className = ''
}) => {
  return (
    <div className={`flex items-start h-[40px] ${className}`}>
      <div className="ore-segmented-track">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              tabIndex={-1} 
              className={`
                ore-segmented-tab px-6 min-w-[120px]
                ${isActive ? 'active' : ''}
              `}
            >
              {tab.icon && (
                <span className={`mr-2 flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                  {tab.icon}
                </span>
              )}
              <span className="ore-text-shadow tracking-wide drop-shadow-md text-[15px]">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};