// /src/ui/primitives/OreSegmentedControl.tsx
import React from 'react';
// 引入抽离的 Hook
import { useSegmentedKeyboard } from '../../hooks/ui/primitives/OreSegmentedControl/useSegmentedKeyboard';

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
  // 1行代码接管所有的键盘监听和逻辑！
  const { triggerPrev, triggerNext } = useSegmentedKeyboard({ tabs, activeTab, onChange });

  return (
    <div className={`flex items-start space-x-2 h-ore-nav ${className}`}>
      
      {/* 左侧快捷键提示 '[' */}
      <div className="h-full w-[32px] inline-flex items-start">
        <button 
          onClick={triggerPrev}
          className="ore-shortcut-btn w-full h-full focus:outline-none"
        >
          [
        </button>
      </div>

      {/* 选项卡容器 */}
      <div className="ore-segmented-track">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`
                ore-segmented-tab px-6 min-w-[120px] h-full
                focus:outline-none focus-visible:ring-2 focus-visible:ring-white
                ${isActive ? 'active' : ''}
              `}
            >
              {tab.icon && (
                <span className={`mr-2 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                  {tab.icon}
                </span>
              )}
              <span className="ore-text-shadow tracking-wide">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 右侧快捷键提示 ']' */}
      <div className="h-full w-[32px] inline-flex items-start">
        <button 
          onClick={triggerNext}
          className="ore-shortcut-btn w-full h-full focus:outline-none"
        >
          ]
        </button>
      </div>

    </div>
  );
};