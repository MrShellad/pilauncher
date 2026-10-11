import React, { useEffect, useState } from 'react';

interface CachedImageEntry {
  objectUrl?: string;
  promise?: Promise<string>;
}

interface LoadedImage {
  source: string;
  resolvedSource: string;
}

const globalImageCache = new Map<string, CachedImageEntry>();

const loadCachedImage = (src: string) => {
  const cached = globalImageCache.get(src);
  if (cached?.objectUrl) return Promise.resolve(cached.objectUrl);
  if (cached?.promise) return cached.promise;

  const promise = fetch(src, { cache: 'force-cache' })
    .then((response) => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.blob();
    })
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      globalImageCache.set(src, { objectUrl });
      return objectUrl;
    })
    .catch((error) => {
      globalImageCache.delete(src);
      throw error;
    });

  globalImageCache.set(src, { promise });
  return promise;
};

export const CachedServerImage: React.FC<
  React.ImgHTMLAttributes<HTMLImageElement> & { src?: string }
> = ({ src, ...props }) => {
  const [loadedImage, setLoadedImage] = useState<LoadedImage | null>(null);
  const cachedObjectUrl = src ? globalImageCache.get(src)?.objectUrl : undefined;
  const resolvedSource =
    src && loadedImage?.source === src ? loadedImage.resolvedSource : cachedObjectUrl;

  useEffect(() => {
    if (!src || cachedObjectUrl) {
      return;
    }

    let isActive = true;
    loadCachedImage(src)
      .then((url) => {
        if (isActive) {
          setLoadedImage({ source: src, resolvedSource: url });
        }
      })
      .catch(() => {
        if (isActive) {
          setLoadedImage({ source: src, resolvedSource: src });
        }
      });

    return () => {
      isActive = false;
    };
  }, [cachedObjectUrl, src]);

  return <img src={resolvedSource || undefined} {...props} />;
};
