import React, { useCallback, useEffect } from 'react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import type { LucideIcon } from 'lucide-react';

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useInputAction } from '../../../ui/focus/InputDriver';
import { ControlHint } from '../../../ui/components/ControlHint';
import type { TabType } from '../hooks/useResourceDownload';

interface BottomNavProps {
  activeTab: TabType;
  tabs: { id: TabType; label: string; icon: LucideIcon }[];
  onTabChange: (id: TabType) => void;
}

const getFocusKey = (tabId: TabType) => `download-bottom-tab-${tabId}`;

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, tabs, onTabChange }) => {
  const switchTabBy = useCallback((direction: -1 | 1) => {
    const activeElement = document.activeElement as HTMLElement | null;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) return;
    if (document.querySelector('.fixed.inset-0')) return;

    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = tabs.length - 1;
    if (nextIndex >= tabs.length) nextIndex = 0;

    const nextTab = tabs[nextIndex];
    onTabChange(nextTab.id);

    requestAnimationFrame(() => {
      const nextFocusKey = getFocusKey(nextTab.id);
      if (doesFocusableExist(nextFocusKey)) setFocus(nextFocusKey);
    });
  }, [activeTab, onTabChange, tabs]);

  useInputAction('PAGE_LEFT', () => switchTabBy(-1));
  useInputAction('PAGE_RIGHT', () => switchTabBy(1));

  useEffect(() => {
    const handlePageKeys = (event: KeyboardEvent) => {
      if (event.key !== 'PageUp' && event.key !== 'PageDown') return;
      event.preventDefault();
      switchTabBy(event.key === 'PageDown' ? 1 : -1);
    };

    window.addEventListener('keydown', handlePageKeys);
    return () => window.removeEventListener('keydown', handlePageKeys);
  }, [switchTabBy]);

  return (
    <div className="z-20 flex w-full flex-shrink-0 border-t-[2px] border-[#1E1E1F] bg-[#48494A] px-4 py-3 shadow-[inset_0_2px_0_rgba(255,255,255,0.12)]">
      <div className="mx-auto flex w-full max-w-[1500px] items-center gap-3">
        <div className="hidden min-w-[180px] items-center gap-2 lg:flex">
          <div className="hidden items-center gap-2 intent-gamepad:flex">
            <ControlHint label="LT" variant="trigger" tone="dark" />
            <span className="font-minecraft text-xs uppercase tracking-[0.18em] text-[#E6E8EB]">上一类</span>
          </div>
          <div className="flex items-center gap-2 intent-gamepad:hidden">
            <ControlHint label="PgUp" variant="keyboard" tone="neutral" />
            <span className="font-minecraft text-xs uppercase tracking-[0.18em] text-[#E6E8EB]">上一类</span>
          </div>
        </div>

        <FocusBoundary id="download-bottom-nav" className="flex min-w-0 flex-1">
          <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2 md:flex-nowrap">
            {tabs.map((tab, index) => (
              <FocusItem
                key={tab.id}
                focusKey={getFocusKey(tab.id)}
                onEnter={() => onTabChange(tab.id)}
                onArrowPress={(direction) => {
                  if (direction === 'left' || direction === 'right') {
                    const nextIndex = direction === 'right'
                      ? (index + 1) % tabs.length
                      : (index - 1 + tabs.length) % tabs.length;
                    setFocus(getFocusKey(tabs[nextIndex].id));
                    return false;
                  }

                  if (direction === 'down') return false;
                  return true;
                }}
              >
                {({ ref, focused }) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const focusRef = ref as React.MutableRefObject<HTMLButtonElement | null>;

                  return (
                    <button
                      ref={focusRef}
                      type="button"
                      tabIndex={0}
                      onClick={() => onTabChange(tab.id)}
                      onFocus={() => setFocus(getFocusKey(tab.id))}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowLeft') {
                          event.preventDefault();
                          switchTabBy(-1);
                        } else if (event.key === 'ArrowRight') {
                          event.preventDefault();
                          switchTabBy(1);
                        } else if (event.key === 'Home') {
                          event.preventDefault();
                          onTabChange(tabs[0].id);
                          setTimeout(() => setFocus(getFocusKey(tabs[0].id)), 0);
                        } else if (event.key === 'End') {
                          event.preventDefault();
                          const lastTab = tabs[tabs.length - 1];
                          onTabChange(lastTab.id);
                          setTimeout(() => setFocus(getFocusKey(lastTab.id)), 0);
                        } else if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onTabChange(tab.id);
                        }
                      }}
                      className={`
                        relative flex h-[52px] min-w-[180px] flex-1 items-center justify-center gap-3 border-[2px] border-[#1E1E1F] px-4 pb-[4px]
                        font-minecraft text-sm uppercase tracking-[0.14em] outline-none transition-none
                        ${isActive
                          ? 'bg-[#3C8527] text-white'
                          : 'bg-[#D0D1D4] text-black hover:bg-[#E6E8EB]'}
                        ${focused ? 'outline outline-2 outline-offset-[3px] outline-white z-10' : ''}
                      `}
                      style={{
                        boxShadow: isActive
                          ? 'inset 0 -4px #1D4D13, inset 2px 2px rgba(255,255,255,0.18), inset -2px -6px rgba(255,255,255,0.08)'
                          : 'inset 0 -4px #58585A, inset 2px 2px rgba(255,255,255,0.65), inset -2px -6px rgba(255,255,255,0.35)'
                      }}
                    >
                      <Icon size={18} className={isActive ? 'text-white' : 'text-black'} />
                      <span className="truncate">{tab.label}</span>
                      {isActive && <span className="absolute inset-x-3 bottom-1 h-[2px] bg-white/90" />}
                    </button>
                  );
                }}
              </FocusItem>
            ))}
          </div>
        </FocusBoundary>

        <div className="hidden min-w-[180px] items-center justify-end gap-2 lg:flex">
          <div className="hidden items-center gap-2 intent-gamepad:flex">
            <span className="font-minecraft text-xs uppercase tracking-[0.18em] text-[#E6E8EB]">下一类</span>
            <ControlHint label="RT" variant="trigger" tone="dark" />
          </div>
          <div className="flex items-center gap-2 intent-gamepad:hidden">
            <span className="font-minecraft text-xs uppercase tracking-[0.18em] text-[#E6E8EB]">下一类</span>
            <ControlHint label="PgDn" variant="keyboard" tone="neutral" />
          </div>
        </div>
      </div>
    </div>
  );
};
