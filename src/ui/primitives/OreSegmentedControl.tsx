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
  focusable?: boolean;
  focusKeyPrefix?: string;
  onArrowPress?: (direction: string) => boolean | void;
}

export const OreSegmentedControl: React.FC<OreSegmentedControlProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
  focusable = true,
  focusKeyPrefix,
  onArrowPress,
}) => {
  return (
    <div className={`flex items-start ore-segmented-wrapper ${className}`}>
      <div className="ore-segmented-track">
        {tabs.map((tab, idx) => {
          const isActive = activeTab === tab.id;
          const optionFocusKey = focusKeyPrefix ? `${focusKeyPrefix}-${idx}` : undefined;

          const renderButton = (ref?: any, focused: boolean = false) => (
            <button
              ref={ref}
              onClick={() => onChange(tab.id)}
              className={`
                ore-segmented-tab
                ${isActive ? 'active' : ''}
                ${focused ? 'is-focused' : ''}
              `}
              tabIndex={-1}
            >
              {tab.icon && (
                <span className={`mr-2 flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                  {tab.icon}
                </span>
              )}
              <span className="ore-text-shadow tracking-wide drop-shadow-md ore-segmented-label font-minecraft">{tab.label}</span>
            </button>
          );

          if (!focusable) {
            return <React.Fragment key={tab.id}>{renderButton()}</React.Fragment>;
          }

          return (
            <FocusItem
              key={tab.id}
              focusKey={optionFocusKey}
              onArrowPress={onArrowPress}
              onEnter={() => onChange(tab.id)}
            >
              {({ ref, focused }) => renderButton(ref as any, focused)}
            </FocusItem>
          );
        })}
      </div>
    </div>
  );
};