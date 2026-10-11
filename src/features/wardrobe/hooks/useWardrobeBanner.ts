import { useCallback, useRef, useState } from 'react';

export interface WardrobeBannerState {
  variant: 'important' | 'info' | 'warning' | 'danger';
  message: string;
}

export type ShowWardrobeBanner = (
  variant: WardrobeBannerState['variant'],
  message: string
) => void;

export function useWardrobeBanner() {
  const [activeBanner, setActiveBanner] = useState<WardrobeBannerState | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = useCallback<ShowWardrobeBanner>((variant, message) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setActiveBanner({ variant, message });
    bannerTimerRef.current = setTimeout(() => {
      setActiveBanner(null);
    }, 4000);
  }, []);

  return {
    activeBanner,
    setActiveBanner,
    showBanner,
  };
}
