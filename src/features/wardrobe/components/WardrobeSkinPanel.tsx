import React from 'react';
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
  index: number;
  onOpenSkinMenu: (asset: SkinCardAsset) => void;
  onPreview: (asset: SkinCardAsset) => void;
}

const SkinCardItem = React.memo(({ asset, index, onOpenSkinMenu, onPreview }: SkinCardItemProps) => {
  const isComponentFocusedRef = React.useRef(false);

  useInputAction('ACTION_X', () => {
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
      focusKey={`wardrobe-skin-${index}`}
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
              <span className="wardrobe-skin-card__title">本地上传</span>
              <span className="wardrobe-skin-card__subtitle">
                上传后进入资产库
              </span>
            </button>
          )}
        </FocusItem>

        {skinCards.map((asset, index) => (
          <SkinCardItem
            key={asset.id}
            asset={asset}
            index={index}
            onOpenSkinMenu={onOpenSkinMenu}
            onPreview={onPreview}
          />
        ))}
      </div>
    </div>
  );
};
