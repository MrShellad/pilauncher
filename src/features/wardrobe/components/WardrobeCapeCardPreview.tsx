import React, { useEffect, useState } from 'react';
import { ThumbnailRenderer } from '../utils/ThumbnailRenderer';

interface WardrobeCapeCardPreviewProps {
  capeUrl: string;
  className?: string;
}

export const WardrobeCapeCardPreview: React.FC<WardrobeCapeCardPreviewProps> = ({
  capeUrl,
  className = '',
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!capeUrl) return;

    ThumbnailRenderer.renderCape(capeUrl)
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch((e) => console.warn('Failed to render cape thumbnail', e));

    return () => {
      active = false;
    };
  }, [capeUrl]);

  if (!dataUrl) {
    return <div className={`animate-pulse bg-white/5 ${className}`} />;
  }

  return (
    <img 
      src={dataUrl} 
      alt="Cape Preview" 
      className={`object-contain drop-shadow-[0_0_8px_rgba(0,0,0,0.3)] ${className}`} 
    />
  );
};
