import React from 'react';
import { FocusItem } from '../../../ui/focus/FocusItem';
import type { WardrobeProfile, WardrobeCape } from '../types';
import { WardrobeCapeCardPreview } from './WardrobeCapeCardPreview';

export interface WardrobeCapePanelProps {
  isMicrosoft: boolean;
  isLoadingProfile: boolean;
  profile: WardrobeProfile | null;
  activeCape: WardrobeCape | null;
  onOpenCapeMenu: (cape: WardrobeCape) => void;
}

export const WardrobeCapePanel: React.FC<WardrobeCapePanelProps> = ({
  isMicrosoft,
  isLoadingProfile,
  profile,
  activeCape,
  onOpenCapeMenu,
}) => {
  return (
    <div className="wardrobe-panel-body">
      {!isMicrosoft && (
        <div className="wardrobe-empty-state">
          披风切换需要使用微软正版账号登录。
        </div>
      )}

      {isMicrosoft && isLoadingProfile && (
        <div className="wardrobe-skeleton-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="wardrobe-skeleton-tile" />
          ))}
        </div>
      )}

      {isMicrosoft && !isLoadingProfile && profile?.capes.length === 0 && (
        <div className="wardrobe-empty-state">
          当前账号没有可用披风。
        </div>
      )}

      {isMicrosoft && !isLoadingProfile && !!profile?.capes.length && (
        <div className="wardrobe-cape-grid">
          {profile.capes.map((cape, index) => {
            const isActive = activeCape?.id === cape.id;

            return (
              <FocusItem
                key={cape.id}
                focusKey={`wardrobe-cape-${index}`}
                onEnter={() => onOpenCapeMenu(cape)}
              >
                {({ ref, focused }) => (
                  <button
                    ref={ref as any}
                    type="button"
                    className={`wardrobe-cape-card ${isActive ? 'is-active' : ''} ${focused ? 'is-focused' : ''}`}
                    onClick={() => onOpenCapeMenu(cape)}
                  >
                    <span className="wardrobe-cape-card__art">
                      <WardrobeCapeCardPreview capeUrl={cape.url} className="w-full h-full object-contain" />
                    </span>
                  </button>
                )}
              </FocusItem>
            );
          })}
        </div>
      )}
    </div>
  );
};
