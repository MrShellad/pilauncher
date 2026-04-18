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
  const [dataUrl, setDataUrl] = useState<string | null>(() => {
    // 初始尝试从内存缓存获取，实现瞬间显示
    const extra = `${toViewerModel(model)}_${!!fullBody}_${fullBody ? '360x480' : '120x160'}`;
    return ThumbnailRenderer.getMemoryCached('skin', skinUrl, extra);
  });

  useEffect(() => {
    let active = true;
    if (!skinUrl) return;

    // 再次调用 renderSkin (它内部会自动处理缓存逻辑)
    ThumbnailRenderer.renderSkin(
      skinUrl, 
      toViewerModel(model), 
      fullBody ? { fullBody: true, width: 360, height: 480 } : undefined
    )
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
        className="w-full h-full object-contain drop-shadow-2xl"
        style={fullBody ? undefined : { transform: 'scale(1.2) translateY(5px)' }} 
      />
    </div>
  );
};
