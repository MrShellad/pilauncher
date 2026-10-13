import React from 'react';

import { GamepadButtonIcon } from '../../../ui/components/GamepadButtonIcon';
import type { DownloadTabConfig } from './filterBarModel';
import {
  filterControlHintClassName,
  getFilterTabButtonClassName,
} from './filterBarStyles';
import type { TabType } from '../hooks/useResourceDownload';

interface FilterBarTabsProps {
  activeTab: TabType;
  tabs: DownloadTabConfig[];
  onTabChange: (tab: TabType) => void;
  isCompactOrDeck: boolean;
}

export const FilterBarTabs: React.FC<FilterBarTabsProps> = ({
  activeTab,
  tabs,
  onTabChange,
  isCompactOrDeck,
}) => {
  const tabButtonClassName = getFilterTabButtonClassName(isCompactOrDeck);

  return (
    <div className="flex min-h-[var(--filter-control-h)] items-center justify-center gap-[var(--filter-col-gap)]">
      <div className="flex shrink-0 items-center">
        <GamepadButtonIcon button="LT" size="lg" className={filterControlHintClassName} />
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center">
        <div className="flex min-w-0 max-w-[var(--filter-tab-max-w)] flex-1 flex-wrap items-center justify-center gap-[var(--filter-col-gap)]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onTabChange(tab.id)}
                className={`${tabButtonClassName} ${isActive ? 'bg-[#3C8527] !text-white' : 'bg-[#E4E7EB] !text-[#121314] hover:bg-[#F0F3F6]'}`}
                style={{
                  boxShadow: isActive
                    ? 'inset 0 -0.1875rem #1D4D13, inset 0.125rem 0.125rem rgba(255,255,255,0.18), inset -0.125rem -0.3125rem rgba(255,255,255,0.08)'
                    : 'inset 0 -0.1875rem #58585A, inset 0.125rem 0.125rem rgba(255,255,255,0.8), inset -0.125rem -0.3125rem rgba(255,255,255,0.45)',
                }}
              >
                <Icon className={`size-[var(--filter-tab-icon)] ${isActive ? '!text-white' : '!text-[#121314]'} ${isCompactOrDeck ? '!mr-0' : ''}`} />
                {!isCompactOrDeck && <span className="truncate">{tab.label}</span>}
                {isActive && (
                  <span
                    className="absolute bg-white/90"
                    style={{
                      left: 'var(--filter-tab-indicator-inset)',
                      right: 'var(--filter-tab-indicator-inset)',
                      bottom: 'var(--filter-tab-indicator-bottom)',
                      height: 'var(--filter-tab-indicator-h)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex shrink-0 items-center">
        <GamepadButtonIcon button="RT" size="lg" className={filterControlHintClassName} />
      </div>
    </div>
  );
};
