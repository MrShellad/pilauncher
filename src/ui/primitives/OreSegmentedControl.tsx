// /src/ui/primitives/OreSegmentedControl.tsx
import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

import { FocusItem } from '../focus/FocusItem';

interface OreSegmentedControlProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
  focusable?: boolean;
  focusKeyPrefix?: string;
  onArrowPress?: (direction: string) => boolean | void;
}

export const OreSegmentedControl: React.FC<OreSegmentedControlProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
  style,
  focusable = true,
  focusKeyPrefix,
  onArrowPress,
}) => {
  return (
    <div className={`flex items-start ore-segmented-wrapper ${className}`} style={style}>
      <div className="ore-segmented-track" role="tablist">
        {tabs.map((tab, idx) => {
          const isActive = activeTab === tab.id;
          const optionFocusKey = focusKeyPrefix ? `${focusKeyPrefix}-${idx}` : undefined;

          const renderButton = (ref?: any, focused: boolean = false, tabIndex: number = -1) => (
            <button
              ref={ref}
              onClick={() => onChange(tab.id)}
              role="tab"
              aria-selected={isActive}
              className={`
                ore-segmented-tab
                ${isActive ? 'active' : ''}
                ${focused ? 'is-focused' : ''}
              `}
              tabIndex={tabIndex}
            >
              {tab.icon && (
                <span className={`mr-1.5 inline-flex items-center justify-center flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                  {tab.icon}
                </span>
              )}
              <span className="ore-text-shadow tracking-wide drop-shadow-md ore-segmented-label font-minecraft leading-none inline-flex items-center">{tab.label}</span>
            </button>
          );

          if (!focusable) {
            return <React.Fragment key={tab.id}>{renderButton(undefined, false, -1)}</React.Fragment>;
          }

          return (
            <FocusItem
              key={tab.id}
              focusKey={optionFocusKey}
              onArrowPress={onArrowPress}
              onEnter={() => onChange(tab.id)}
            >
              {({ ref, focused, tabIndex }) => renderButton(ref as any, focused, tabIndex)}
            </FocusItem>
          );
        })}
      </div>
    </div>
  );
};