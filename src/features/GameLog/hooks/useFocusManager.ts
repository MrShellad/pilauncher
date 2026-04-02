import { useCallback, useEffect, useMemo, useRef } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useLauncherStore } from '../../../store/useLauncherStore';
import { useGamepadModStore } from '../../../store/useGamepadModStore';
import { INITIAL_DOWNLOAD_FOCUS_KEY } from '../../Settings/components/tabs/download/downloadSettings.constants';

export const useFocusManager = (isOpen: boolean) => {
  const activeTab = useLauncherStore((state) => state.activeTab);
  const lastFocusBeforeOpenRef = useRef<string | null>(null);

  const fallbackFocusKeysByTab = useMemo<Record<string, string[]>>(() => ({
    home: ['play-button', 'instance-button', 'settings-button', 'btn-profile', 'btn-login'],
    instances: ['action-new', 'view-grid', 'view-list'],
    downloads: ['download-search-input', 'download-grid-item-0'],
    settings: [
      'settings-device-name',
      'settings-java-autodetect',
      INITIAL_DOWNLOAD_FOCUS_KEY,
      'btn-add-ms',
      'color-preset-0',
    ],
    'new-instance': ['card-custom', 'btn-back-menu'],
    'instance-detail': [
      'overview-btn-play',
      'basic-input-name',
      'java-entry-point',
      'save-btn-history',
      'mod-btn-history',
      'btn-open-resourcepack-folder',
      'btn-open-shader-folder',
    ],
    'instance-mod-download': [
      'instance-mod-page-back',
      'inst-filter-search',
      'download-grid-item-0',
    ],
  }), []);

  const restoreFocusToCurrentPage = useCallback(() => {
    const lastFocus = lastFocusBeforeOpenRef.current;
    if (lastFocus && doesFocusableExist(lastFocus)) {
      setFocus(lastFocus);
      return;
    }

    const candidates = fallbackFocusKeysByTab[activeTab] || [];
    const target = candidates.find((focusKey) => doesFocusableExist(focusKey));
    if (target) setFocus(target);
  }, [activeTab, fallbackFocusKeysByTab]);

  useEffect(() => {
    if (isOpen) {
      const currentFocus = getCurrentFocusKey();
      if (currentFocus && currentFocus !== 'SN:ROOT' && !currentFocus.startsWith('log-')) {
        lastFocusBeforeOpenRef.current = currentFocus;
      }

      const timer = setTimeout(() => {
        const isGamepadPromptOpen = useGamepadModStore.getState().isOpen;
        if (!isGamepadPromptOpen) {
          setFocus('log-area');
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return { restoreFocusToCurrentPage };
};
