import React, { useEffect, useState } from 'react';
import type { WardrobeSkinModel } from '../types';
import { ThumbnailRenderer } from '../utils/ThumbnailRenderer';

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
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!skinUrl) return;

    ThumbnailRenderer.renderSkin(skinUrl, toViewerModel(model), fullBody ? { fullBody: true, width: 360, height: 480 } : undefined)
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch((e) => console.warn('Failed to render skin thumbnail', e));

    return () => {
      active = false;
    };
  }, [skinUrl, model, fullBody]);

  if (!dataUrl) {
    return <div className={`wardrobe-skin-card-preview animate-pulse bg-white/5 ${className}`} />;
  }

  return (
    <div className={`wardrobe-skin-card-preview flex items-center justify-center ${className}`}>
      <img 
        src={dataUrl} 
        alt="Skin Preview" 
        className={fullBody ? "w-full h-full object-contain drop-shadow-2xl" : "w-[120px] h-[160px] object-contain drop-shadow-lg"} 
        style={fullBody ? undefined : { transform: 'translateY(10px) scale(1.05)' }} 
      />
    </div>
  );
};
