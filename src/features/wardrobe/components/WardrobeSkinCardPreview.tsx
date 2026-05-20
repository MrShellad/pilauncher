import React, { useEffect, useMemo, useState } from 'react';
import type { WardrobeSkinModel } from '../types';
import { ThumbnailRenderer, type SkinThumbnailResult } from '../utils/ThumbnailRenderer';

interface WardrobeSkinCardPreviewProps {
  skinUrl: string;
  model: WardrobeSkinModel;
  className?: string;
  fullBody?: boolean;
}

const toViewerModel = (model: WardrobeSkinModel) => (model === 'slim' ? 'slim' : 'default');

export const WardrobeSkinCardPreview: React.FC<WardrobeSkinCardPreviewProps> = ({
  skinUrl,
  model,
  className = '',
  fullBody = false,
}) => {
  const viewerModel = toViewerModel(model);
  const renderOptions = useMemo(
    () => (fullBody ? { fullBody: true, width: 720, height: 960 } : { width: 360, height: 504 }),
    [fullBody]
  );
  const [views, setViews] = useState<SkinThumbnailResult | null>(() =>
    ThumbnailRenderer.getMemoryCachedSkinViews(skinUrl, viewerModel, renderOptions)
  );

  useEffect(() => {
    let active = true;
    if (!skinUrl) return;

    const cached = ThumbnailRenderer.getMemoryCachedSkinViews(skinUrl, viewerModel, renderOptions);
    if (cached) {
      setViews(cached);
    } else {
      setViews(null);
    }

    ThumbnailRenderer.renderSkinViews(skinUrl, viewerModel, renderOptions)
      .then((nextViews) => {
        if (active) setViews(nextViews);
      })
      .catch((e) => console.warn('Failed to render skin thumbnail', e));

    return () => {
      active = false;
    };
  }, [skinUrl, viewerModel, renderOptions]);

  if (!views) {
    return <div className={`wardrobe-skin-card-preview wardrobe-skin-card-preview--loading ${className}`} />;
  }

  return (
    <div className={`wardrobe-skin-card-preview flex items-center justify-center ${className}`}>
      <div className={`wardrobe-skin-card-preview__flip ${fullBody ? 'is-static' : ''}`}>
        <img
          src={views.front}
          alt="Skin Preview"
          className="wardrobe-skin-card-preview__image wardrobe-skin-card-preview__image--front"
        />
        {!fullBody && (
          <img
            src={views.back}
            alt=""
            aria-hidden="true"
            className="wardrobe-skin-card-preview__image wardrobe-skin-card-preview__image--back"
          />
        )}
      </div>
    </div>
  );
};
