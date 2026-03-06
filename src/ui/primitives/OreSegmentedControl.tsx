// /src/ui/primitives/OreSegmentedControl.tsx
import React, { useState } from 'react';
import { useInputAction } from '../focus/InputDriver';

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
  const [visualPress, setVisualPress] = useState<'prev' | 'next' | null>(null);

  const triggerPrev = () => {
    const idx = tabs.findIndex(t => t.id === activeTab);
    if (idx > 0) {
      onChange(tabs[idx - 1].id);
      setVisualPress('prev');
      setTimeout(() => setVisualPress(null), 100);
    }
  };

  const triggerNext = () => {
    const idx = tabs.findIndex(t => t.id === activeTab);
    if (idx < tabs.length - 1) {
      onChange(tabs[idx + 1].id);
      setVisualPress('next');
      setTimeout(() => setVisualPress(null), 100);
    }
  };

  useInputAction('PAGE_LEFT', triggerPrev);
  useInputAction('PAGE_RIGHT', triggerNext);

  return (
    // ✅ 修复1：使用 items-start (顶部对齐)，这样按钮下沉时也不会拉扯周围的元素
    <div className={`flex items-start space-x-2 h-[40px] ${className}`}>
      
      {/* 左侧快捷键提示 '[' */}
      <button 
        onClick={triggerPrev}
        tabIndex={-1} 
        // 移除了 absolute 等多余样式，回归最纯粹的组件类名
        className={`ore-shortcut-btn ${visualPress === 'prev' ? 'is-pressed' : ''}`}
      >
        [
      </button>

      {/* 选项卡容器 */}
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
              <span className="ore-text-shadow tracking-wide">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 右侧快捷键提示 ']' */}
      <button 
        onClick={triggerNext}
        tabIndex={-1} 
        className={`ore-shortcut-btn ${visualPress === 'next' ? 'is-pressed' : ''}`}
      >
        ]
      </button>

    </div>
  );
};