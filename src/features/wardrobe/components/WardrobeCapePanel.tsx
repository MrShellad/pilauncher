import React from 'react';
import { useTranslation } from 'react-i18next';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useInputAction } from '../../../ui/focus/InputDriver';
import type { WardrobeProfile, WardrobeCape, WardrobeSkinModel } from '../types';
import { WardrobeCapeCardPreview } from './WardrobeCapeCardPreview';

export interface WardrobeCapePanelProps {
  isMicrosoft: boolean;
  isLoadingProfile: boolean;
  profile: WardrobeProfile | null;
  activeCape: WardrobeCape | null;
  currentSkinUrl: string | null;
  currentSkinModel: WardrobeSkinModel;
  onOpenCapeMenu: (cape: WardrobeCape) => void;
  onPreview: (cape: WardrobeCape) => void;
}

interface CapeCardItemProps {
  cape: WardrobeCape;
  isActive: boolean;
  currentSkinUrl: string | null;
  currentSkinModel: WardrobeSkinModel;
  onOpenCapeMenu: (cape: WardrobeCape) => void;
  onPreview: (cape: WardrobeCape) => void;
}

const CapeCardItem = React.memo(({
  cape,
  isActive,
  currentSkinUrl,
  currentSkinModel,
  onOpenCapeMenu,
  onPreview,
}: CapeCardItemProps) => {
  const { t } = useTranslation();
  const isComponentFocusedRef = React.useRef(false);

  useInputAction('ACTION_Y', () => {
    if (isComponentFocusedRef.current) {
      onPreview(cape);
    }
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onPreview(cape);
  };

  return (
    <FocusItem
      focusKey={`wardrobe-cape-${cape.id}`}
      onEnter={() => onOpenCapeMenu(cape)}
    >
      {({ ref, focused }) => {
        isComponentFocusedRef.current = focused;
        return (
          <button
            ref={ref as any}
            type="button"
            className={`wardrobe-cape-card ${isActive ? 'is-active' : ''} ${focused ? 'is-focused' : ''}`}
            onClick={() => onOpenCapeMenu(cape)}
            onContextMenu={handleContextMenu}
          >
            {isActive && <span className="wardrobe-card-active-badge">{t('wardrobe.activeBadge')}</span>}
            <span className="wardrobe-cape-card__art">
              <WardrobeCapeCardPreview
                capeUrl={cape.url}
                skinUrl={currentSkinUrl}
                skinModel={currentSkinModel}
                className="w-full h-full object-contain"
              />
            </span>
          </button>
        );
      }}
    </FocusItem>
  );
});

export const WardrobeCapePanel: React.FC<WardrobeCapePanelProps> = ({
  isMicrosoft,
  isLoadingProfile,
  profile,
  activeCape,
  currentSkinUrl,
  currentSkinModel,
  onOpenCapeMenu,
  onPreview,
}) => {
  const { t } = useTranslation();

  return (
    <div className="wardrobe-panel-body">
      {!isMicrosoft && (
        <div className="wardrobe-empty-state">
          {t('wardrobe.microsoftRequired')}
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
          {t('wardrobe.noCapes')}
        </div>
      )}

      {isMicrosoft && !isLoadingProfile && !!profile?.capes.length && (
        <div className="wardrobe-cape-grid">
          {[...profile.capes]
            .sort((a, b) => {
              const aActive = activeCape?.id === a.id;
              const bActive = activeCape?.id === b.id;
              return aActive === bActive ? 0 : aActive ? -1 : 1;
            })
            .map((cape) => (
            <CapeCardItem
              key={cape.id}
              cape={cape}
              isActive={activeCape?.id === cape.id}
              currentSkinUrl={currentSkinUrl}
              currentSkinModel={currentSkinModel}
              onOpenCapeMenu={onOpenCapeMenu}
              onPreview={onPreview}
            />
          ))}
        </div>
      )}
    </div>
  );
};
