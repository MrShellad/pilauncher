import { useCallback, useEffect, useMemo, useRef } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { useSettingsStore } from '../../../../../store/useSettingsStore';
import { DEFAULT_SETTINGS } from '../../../../../types/settings';
import {
  DOWNLOAD_PROXY_OPTIONS,
  DOWNLOAD_SOURCE_CATEGORIES,
  INITIAL_DOWNLOAD_FOCUS_KEY
} from './downloadSettings.constants';

export const useDownloadSettingsController = (extraFocusKeys: string[] = []) => {
  const { settings, updateDownloadSetting } = useSettingsStore();
  const download = settings.download || DEFAULT_SETTINGS.download;
  const minecraftMetaSource = download.minecraftMetaSource || 'bangbang93';

  const focusOrder = useMemo(() => {
    const keys: string[] = [
      'settings-download-minecraft-meta-source-0',
      'settings-download-minecraft-meta-source-1'
    ];

    DOWNLOAD_SOURCE_CATEGORIES.forEach(({ key, data }) => {
      data.forEach((_, idx) => {
        keys.push(`settings-download-source-${key}-${idx}`);
      });
    });

    keys.push(
      'settings-download-auto-latency',
      'settings-download-speed-unit-0',
      'settings-download-speed-unit-1',
      'settings-download-speed-limit',
      'settings-download-concurrency',
      'settings-download-chunked-enable',
      'settings-download-chunked-threads',
      'settings-download-chunked-threshold',
      'settings-download-timeout',
      'settings-download-retry',
      'settings-download-verify-hash'
    );

    DOWNLOAD_PROXY_OPTIONS.forEach((_, idx) => {
      keys.push(`settings-download-proxy-type-${idx}`);
    });

    if (download.proxyType !== 'none') {
      keys.push('settings-download-proxy-host', 'settings-download-proxy-port');
    }

    keys.push(...extraFocusKeys);

    return keys;
  }, [download.proxyType, extraFocusKeys]);

  const handleLinearArrow = useCallback(
    (direction: string) => {
      if (direction !== 'up' && direction !== 'down') return true;

      const availableKeys = focusOrder.filter((key) => doesFocusableExist(key));
      if (availableKeys.length === 0) return true;

      const currentKey = getCurrentFocusKey();
      const index = availableKeys.indexOf(currentKey);

      if (index < 0) {
        setFocus(availableKeys[0]);
        return false;
      }

      const nextIndex =
        direction === 'down'
          ? Math.min(availableKeys.length - 1, index + 1)
          : Math.max(0, index - 1);

      if (nextIndex !== index) {
        setFocus(availableKeys[nextIndex]);
      }

      return false;
    },
    [focusOrder]
  );

  const initializedFocusRef = useRef(false);

  useEffect(() => {
    if (initializedFocusRef.current) return;

    const timer = setTimeout(() => {
      const currentKey = getCurrentFocusKey();
      if (currentKey && doesFocusableExist(currentKey)) {
        initializedFocusRef.current = true;
        return;
      }

      if (doesFocusableExist(INITIAL_DOWNLOAD_FOCUS_KEY)) {
        setFocus(INITIAL_DOWNLOAD_FOCUS_KEY);
      } else {
        const firstVisible = focusOrder.find((key) => doesFocusableExist(key));
        if (firstVisible) {
          setFocus(firstVisible);
        }
      }

      initializedFocusRef.current = true;
    }, 120);

    return () => clearTimeout(timer);
  }, [focusOrder]);

  return {
    download,
    minecraftMetaSource,
    sourceCategories: DOWNLOAD_SOURCE_CATEGORIES,
    proxyOptions: DOWNLOAD_PROXY_OPTIONS,
    updateDownloadSetting,
    handleLinearArrow
  };
};
