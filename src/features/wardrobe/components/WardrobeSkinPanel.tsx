import React from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus } from 'lucide-react';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useInputAction } from '../../../ui/focus/InputDriver';
import { WardrobeSkinCardPreview } from './WardrobeSkinCardPreview';
import type { SkinCardAsset } from '../types';

export interface WardrobeSkinPanelProps {
  skinCards: SkinCardAsset[];
  onChooseSkin: () => void;
  onOpenSkinMenu: (asset: SkinCardAsset) => void;
  onPreview: (asset: SkinCardAsset) => void;
}

interface SkinCardItemProps {
  asset: SkinCardAsset;
  onOpenSkinMenu: (asset: SkinCardAsset) => void;
  onPreview: (asset: SkinCardAsset) => void;
}

const SkinCardItem = React.memo(({ asset, onOpenSkinMenu, onPreview }: SkinCardItemProps) => {
  const { t } = useTranslation();
  const isComponentFocusedRef = React.useRef(false);

  useInputAction('ACTION_Y', () => {
    if (isComponentFocusedRef.current) {
      onPreview(asset);
    }
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onPreview(asset);
  };

  return (
    <FocusItem
      focusKey={`wardrobe-skin-${asset.id}`}
      onEnter={() => onOpenSkinMenu(asset)}
    >
      {({ ref, focused }) => {
        isComponentFocusedRef.current = focused;
        return (
          <button
            ref={ref as any}
            type="button"
            className={`wardrobe-skin-card ${asset.isActive ? 'is-active' : ''} ${focused ? 'is-focused' : ''}`}
            onClick={() => onOpenSkinMenu(asset)}
            onContextMenu={handleContextMenu}
          >
            <div className="wardrobe-skin-card__preview-wrap">
              {asset.isActive && <span className="wardrobe-card-active-badge">{t('wardrobe.activeBadge')}</span>}
              <WardrobeSkinCardPreview skinUrl={asset.skinUrl} model={asset.variant} />
            </div>
            <div className="wardrobe-skin-card__meta font-minecraft">
              <span className="wardrobe-skin-card__title">{asset.title}</span>
              <span className="wardrobe-skin-card__subtitle">{asset.subtitle}</span>
            </div>
          </button>
        );
      }}
    </FocusItem>
  );
});

export const WardrobeSkinPanel: React.FC<WardrobeSkinPanelProps> = ({
  skinCards,
  onChooseSkin,
  onOpenSkinMenu,
  onPreview,
}) => {
  const { t } = useTranslation();
  return (
    <div className="wardrobe-panel-body font-minecraft">
      <div className="wardrobe-skin-grid">
        <FocusItem focusKey="wardrobe-upload-card" onEnter={onChooseSkin}>
          {({ ref, focused }) => (
            <button
              ref={ref as any}
              type="button"
              className={`wardrobe-upload-card ${focused ? 'is-focused' : ''}`}
              onClick={onChooseSkin}
            >
              <span className="wardrobe-upload-card__icon">
                <ImagePlus size={34} />
              </span>
              <span className="wardrobe-skin-card__title">{t('wardrobe.uploadCard.title')}</span>
              <span className="wardrobe-skin-card__subtitle">
                {t('wardrobe.uploadCard.subtitle')}
              </span>
            </button>
          )}
        </FocusItem>

        {skinCards.map((asset) => (
          <SkinCardItem
            key={asset.id}
            asset={asset}
            onOpenSkinMenu={onOpenSkinMenu}
            onPreview={onPreview}
          />
        ))}
      </div>
    </div>
  );
};
