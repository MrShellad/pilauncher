import { useCallback } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { useLinearNavigation } from '../../../../../ui/focus/useLinearNavigation';

const NORMAL_FOCUS_ORDER = [
  'mod-btn-snapshot',
  'mod-btn-history',
  'mod-btn-check-updates',
  'mod-btn-folder',
  'mod-btn-cleanup',
  'mod-btn-download',
  'mod-search-input',
  'mod-search-clear',
];

const BATCH_FOCUS_ORDER = [
  'mod-btn-snapshot',
  'mod-btn-history',
  'mod-btn-check-updates',
  'mod-btn-folder',
  'mod-btn-cleanup',
  'mod-btn-download',
  'mod-search-input',
  'mod-search-clear',
  'mod-btn-batch-enable',
  'mod-btn-batch-disable',
  'mod-btn-batch-delete',
  'mod-btn-batch-exit',
];

export const useModPanelFocusNavigation = (isBatchMode: boolean) => {
  const focusOrder = isBatchMode ? BATCH_FOCUS_ORDER : NORMAL_FOCUS_ORDER;
  const { handleLinearArrow } = useLinearNavigation(focusOrder, undefined, false);

  const focusModListEntry = useCallback(() => {
    if (!doesFocusableExist('mod-list-entry')) {
      return false;
    }

    setFocus('mod-list-entry');
    return true;
  }, []);

  const handleTopBarArrow = useCallback((direction: string) => {
    if (direction === 'down') {
      const availableFocusKeys = focusOrder.filter((focusKey) => doesFocusableExist(focusKey));
      const currentFocusKey = getCurrentFocusKey();

      if (
        availableFocusKeys.length > 0 &&
        currentFocusKey === availableFocusKeys[availableFocusKeys.length - 1] &&
        focusModListEntry()
      ) {
        return false;
      }
    }

    return handleLinearArrow(direction);
  }, [focusModListEntry, focusOrder, handleLinearArrow]);

  const handleListNavigateOut = useCallback((direction: 'up' | 'down') => {
    if (direction !== 'up') {
      return false;
    }

    const availableFocusKeys = focusOrder.filter((focusKey) => doesFocusableExist(focusKey));
    const targetFocusKey = availableFocusKeys[availableFocusKeys.length - 1];

    if (!targetFocusKey) {
      return false;
    }

    setFocus(targetFocusKey);
    return true;
  }, [focusOrder]);

  return {
    handleTopBarArrow,
    handleListNavigateOut
  };
};
