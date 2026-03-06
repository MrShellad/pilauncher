// /src/ui/primitives/OreSegmentedControl.tsx
import React, { useState } from 'react';
import { useInputAction } from '../focus/InputDriver'; // ✅ 引入全局输入驱动

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
  // 用于渲染物理按下的视觉反馈
  const [visualPress, setVisualPress] = useState<'prev' | 'next' | null>(null);

  const triggerPrev = () => {
    const idx = tabs.findIndex(t => t.id === activeTab);
    if (idx > 0) {
      onChange(tabs[idx - 1].id);
      setVisualPress('prev');
      setTimeout(() => setVisualPress(null), 100); // 100ms后回弹
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

  // ✅ 完美接管：全局监听 [ ] 键和手柄扳机键
  useInputAction('PAGE_LEFT', triggerPrev);
  useInputAction('PAGE_RIGHT', triggerNext);

  return (
    <div className={`flex items-start space-x-2 h-ore-nav ${className}`}>
      
      {/* 左侧快捷键提示 '[' */}
      <div className="h-full w-[32px] inline-flex items-start">
        <button 
          onClick={triggerPrev}
          tabIndex={-1} // 禁用原生焦点
          className={`ore-shortcut-btn w-full h-full focus:outline-none ${visualPress === 'prev' ? 'is-pressed' : ''}`}
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
              tabIndex={-1} // 禁用原生焦点
              className={`
                ore-segmented-tab px-6 min-w-[120px] h-full focus:outline-none
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
      <div className="h-full w-[32px] inline-flex items-start">
        <button 
          onClick={triggerNext}
          tabIndex={-1} // 禁用原生焦点
          className={`ore-shortcut-btn w-full h-full focus:outline-none ${visualPress === 'next' ? 'is-pressed' : ''}`}
        >
          ]
        </button>
      </div>

    </div>
  );
};