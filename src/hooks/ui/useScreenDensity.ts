import { useState, useEffect } from 'react';

export type ScreenDensity = 'compact' | 'deck' | 'desktop' | 'wide' | 'tv';

export function getScreenDensity(width: number, height: number): ScreenDensity {
  // Mobile landscape / Small window
  if (width <= 960 || height <= 520) {
    return 'compact';
  }
  // Steam Deck / Console
  if (width > 960 && width <= 1366 && height <= 900) {
    return 'deck';
  }
  // Standard PC
  if (width >= 1367 && width < 1920) {
    return 'desktop';
  }
  // 2K PC
  if (width >= 1920 && width < 2560) {
    return 'wide';
  }
  // 4K / TV
  return 'tv';
}

export function useScreenDensity() {
  const [density, setDensity] = useState<ScreenDensity>(() =>
    typeof window !== 'undefined' ? getScreenDensity(window.innerWidth, window.innerHeight) : 'desktop'
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Set initial attribute on load
    const initialDensity = getScreenDensity(window.innerWidth, window.innerHeight);
    document.documentElement.setAttribute('data-density', initialDensity);

    const handleResize = () => {
      const currentDensity = getScreenDensity(window.innerWidth, window.innerHeight);
      setDensity(currentDensity);
      document.documentElement.setAttribute('data-density', currentDensity);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return density;
}
