import { useCallback, useEffect, useMemo, useState } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { useInputAction } from '../../../../../ui/focus/InputDriver';
import { useLinearNavigation } from '../../../../../ui/focus/useLinearNavigation';
import type { ModMeta } from '../../../logic/modService';
import {
  DEFAULT_MOD_LIST_EXIT_FOCUS_KEY,
  getModRowActionFocusKey,
  getModRowFocusKey,
  LIST_ENTRY_FOCUS_KEY,
  ROW_ACTIONS,
  type RowAction,
  type SafeFocusFallback
} from './modListShared';

interface UseModListFocusOptions {
  mods: ModMeta[];
  inputMode: string;
  onNavigateOut?: (direction: 'up' | 'down') => boolean;
  onSelectMod: (mod: ModMeta) => void;
  onToggleSelection: (fileName: string) => void;
  exitFocusKey?: string;
}

export const useModListFocus = ({
  mods,
  inputMode,
  onNavigateOut,
  onSelectMod,
  onToggleSelection,
  exitFocusKey = DEFAULT_MOD_LIST_EXIT_FOCUS_KEY
}: UseModListFocusOptions) => {
  const requiresRowOperation = inputMode !== 'mouse';
  const [focusedRowFileName, setFocusedRowFileName] = useState<string | null>(mods[0]?.fileName ?? null);
  const [operationRowFileName, setOperationRowFileName] = useState<string | null>(null);

  const rowFocusKeyByFileName = useMemo(() => {
    return new Map(mods.map((mod) => [mod.fileName, getModRowFocusKey(mod.fileName)]));
  }, [mods]);

  const rowFocusOrder = useMemo(() => {
    return mods.map((mod) => rowFocusKeyByFileName.get(mod.fileName) ?? getModRowFocusKey(mod.fileName));
  }, [mods, rowFocusKeyByFileName]);

  const getAvailableRowFocusOrder = useCallback(() => {
    return rowFocusOrder.filter((focusKey) => focusKey && doesFocusableExist(focusKey));
  }, [rowFocusOrder]);

  const focusKeyToFileName = useMemo(() => {
    const map = new Map<string, string>();

    mods.forEach((mod) => {
      const rowKey = rowFocusKeyByFileName.get(mod.fileName);
      if (rowKey) {
        map.set(rowKey, mod.fileName);
      }

      ROW_ACTIONS.forEach((action) => {
        map.set(getModRowActionFocusKey(mod.fileName, action), mod.fileName);
      });
    });

    return map;
  }, [mods, rowFocusKeyByFileName]);

  const { handleLinearArrow } = useLinearNavigation(
    rowFocusOrder,
    rowFocusOrder[0],
    true,
    mods.length > 0 && operationRowFileName === null
  );

  const focusRow = useCallback((fileName: string) => {
    const rowFocusKey = rowFocusKeyByFileName.get(fileName) ?? getModRowFocusKey(fileName);
    if (!doesFocusableExist(rowFocusKey)) {
      return;
    }

    setFocus(rowFocusKey);
  }, [rowFocusKeyByFileName]);

  const getSafeFocusKey = useCallback((fallback: SafeFocusFallback = 'current') => {
    const currentFocusKey = getCurrentFocusKey();
    if (currentFocusKey && focusKeyToFileName.has(currentFocusKey) && doesFocusableExist(currentFocusKey)) {
      return currentFocusKey;
    }

    const preferredFileName = operationRowFileName ?? focusedRowFileName;
    if (preferredFileName) {
      if (operationRowFileName === preferredFileName) {
        const toggleFocusKey = getModRowActionFocusKey(preferredFileName, 'toggle');
        if (doesFocusableExist(toggleFocusKey)) {
          return toggleFocusKey;
        }
      }

      const rowFocusKey = rowFocusKeyByFileName.get(preferredFileName);
      if (rowFocusKey && doesFocusableExist(rowFocusKey)) {
        return rowFocusKey;
      }
    }

    const availableRowFocusOrder = getAvailableRowFocusOrder();

    if (fallback === 'first') {
      return availableRowFocusOrder[0] ?? null;
    }

    if (fallback === 'last') {
      return availableRowFocusOrder[availableRowFocusOrder.length - 1] ?? null;
    }

    return availableRowFocusOrder[0] ?? null;
  }, [focusKeyToFileName, focusedRowFileName, getAvailableRowFocusOrder, operationRowFileName, rowFocusKeyByFileName]);

  const restoreSafeFocus = useCallback((fallback: SafeFocusFallback = 'current') => {
    const targetFocusKey = getSafeFocusKey(fallback);
    if (!targetFocusKey || !doesFocusableExist(targetFocusKey)) {
      return;
    }

    setFocus(targetFocusKey);
  }, [getSafeFocusKey]);

  const enterRowOperation = useCallback((fileName: string) => {
    setFocusedRowFileName(fileName);
    setOperationRowFileName(fileName);

    const actionFocusKey = getModRowActionFocusKey(fileName, 'toggle');
    window.setTimeout(() => {
      if (doesFocusableExist(actionFocusKey)) {
        setFocus(actionFocusKey);
      }
    }, 20);
  }, []);

  const clearOperationRow = useCallback(() => {
    setOperationRowFileName(null);
  }, []);

  const exitRowOperation = useCallback(() => {
    if (!operationRowFileName) {
      return;
    }

    const rowFileName = operationRowFileName;
    setOperationRowFileName(null);
    window.setTimeout(() => focusRow(rowFileName), 20);
  }, [focusRow, operationRowFileName]);

  const getFocusedMod = useCallback(() => {
    const currentFocusKey = getCurrentFocusKey();
    if (!currentFocusKey) {
      return null;
    }

    const fileName = focusKeyToFileName.get(currentFocusKey);
    if (!fileName) {
      return null;
    }

    return mods.find((mod) => mod.fileName === fileName) ?? null;
  }, [focusKeyToFileName, mods]);

  const handleCancelHierarchy = useCallback(() => {
    const currentFocusKey = getCurrentFocusKey();
    if (!currentFocusKey) {
      return false;
    }

    if (currentFocusKey === LIST_ENTRY_FOCUS_KEY) {
      if (doesFocusableExist(exitFocusKey)) {
        setFocus(exitFocusKey);
        return true;
      }

      return false;
    }

    const focusedFileName = focusKeyToFileName.get(currentFocusKey);
    if (!focusedFileName) {
      return false;
    }

    if (operationRowFileName === focusedFileName) {
      exitRowOperation();
      return true;
    }

    const rowFocusKey = rowFocusKeyByFileName.get(focusedFileName) ?? getModRowFocusKey(focusedFileName);
    if (currentFocusKey !== rowFocusKey) {
      focusRow(focusedFileName);
      return true;
    }

    if (doesFocusableExist(exitFocusKey)) {
      setFocus(exitFocusKey);
      return true;
    }

    return true;
  }, [exitFocusKey, exitRowOperation, focusKeyToFileName, focusRow, operationRowFileName, rowFocusKeyByFileName]);

  useEffect(() => {
    if (mods.length === 0) {
      setFocusedRowFileName(null);
      setOperationRowFileName(null);
      return;
    }

    if (focusedRowFileName && !mods.some((mod) => mod.fileName === focusedRowFileName)) {
      setFocusedRowFileName(mods[0].fileName);
    }

    if (operationRowFileName && !mods.some((mod) => mod.fileName === operationRowFileName)) {
      setOperationRowFileName(null);
    }
  }, [focusedRowFileName, mods, operationRowFileName]);

  useEffect(() => {
    const handleEscapeCapture = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (!handleCancelHierarchy()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('keydown', handleEscapeCapture, true);
    return () => window.removeEventListener('keydown', handleEscapeCapture, true);
  }, [handleCancelHierarchy]);

  useInputAction('ACTION_X', () => {
    const focusedMod = getFocusedMod();
    if (!focusedMod) {
      return;
    }

    onToggleSelection(focusedMod.fileName);
  });

  useInputAction('ACTION_Y', () => {
    const focusedMod = getFocusedMod();
    if (!focusedMod) {
      return;
    }

    onSelectMod(focusedMod);
  });

  const handleRowArrow = useCallback((direction: string) => {
    if (operationRowFileName) {
      return false;
    }

    if (direction !== 'up' && direction !== 'down') {
      return false;
    }

    const currentFocusKey = getCurrentFocusKey();
    const availableRowFocusOrder = getAvailableRowFocusOrder();
    const firstRowKey = availableRowFocusOrder[0];
    const lastRowKey = availableRowFocusOrder[availableRowFocusOrder.length - 1];

    if (direction === 'up' && currentFocusKey && firstRowKey && currentFocusKey === firstRowKey) {
      return !(onNavigateOut?.('up') ?? false);
    }

    if (direction === 'down' && currentFocusKey && lastRowKey && currentFocusKey === lastRowKey) {
      return !(onNavigateOut?.('down') ?? false);
    }

    return handleLinearArrow(direction);
  }, [getAvailableRowFocusOrder, handleLinearArrow, onNavigateOut, operationRowFileName]);

  const handleActionArrow = useCallback((fileName: string, action: RowAction, direction: string) => {
    if (inputMode === 'mouse') {
      return true;
    }

    if (operationRowFileName !== fileName) {
      return false;
    }

    if (direction === 'up' || direction === 'down') {
      const currentRowKey = rowFocusKeyByFileName.get(fileName) ?? getModRowFocusKey(fileName);
      const availableRows = getAvailableRowFocusOrder();
      const currentIndex = availableRows.indexOf(currentRowKey);

      if (direction === 'up' && currentIndex === 0) {
        setOperationRowFileName(null);
        window.setTimeout(() => {
          if (!(onNavigateOut?.('up') ?? false) && doesFocusableExist(currentRowKey)) {
            setFocus(currentRowKey);
          }
        }, 20);
        return false;
      }

      const nextIndex = direction === 'down'
        ? Math.min(availableRows.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1);
      const targetRowKey = currentIndex >= 0 ? availableRows[nextIndex] : currentRowKey;

      setOperationRowFileName(null);
      window.setTimeout(() => {
        if (targetRowKey && doesFocusableExist(targetRowKey)) {
          setFocus(targetRowKey);
          return;
        }

        if (doesFocusableExist(currentRowKey)) {
          setFocus(currentRowKey);
        }
      }, 20);
      return false;
    }

    if (direction === 'left' || direction === 'right') {
      const index = ROW_ACTIONS.indexOf(action);
      const nextIndex = direction === 'right'
        ? Math.min(ROW_ACTIONS.length - 1, index + 1)
        : Math.max(0, index - 1);

      const nextFocusKey = getModRowActionFocusKey(fileName, ROW_ACTIONS[nextIndex]);
      if (doesFocusableExist(nextFocusKey)) {
        setFocus(nextFocusKey);
      }
      return false;
    }

    return false;
  }, [getAvailableRowFocusOrder, inputMode, onNavigateOut, operationRowFileName, rowFocusKeyByFileName]);

  const preventLockedAction = useCallback((fileName: string, event?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
    if (!requiresRowOperation || operationRowFileName === fileName) {
      return false;
    }

    event?.preventDefault?.();
    event?.stopPropagation?.();
    setFocusedRowFileName(fileName);
    focusRow(fileName);
    return true;
  }, [focusRow, operationRowFileName, requiresRowOperation]);

  const getRowFocusKey = useCallback((fileName: string) => {
    return rowFocusKeyByFileName.get(fileName) ?? getModRowFocusKey(fileName);
  }, [rowFocusKeyByFileName]);

  return {
    requiresRowOperation,
    focusedRowFileName,
    operationRowFileName,
    defaultFocusKey: rowFocusOrder[0] || LIST_ENTRY_FOCUS_KEY,
    trapFocus: requiresRowOperation && operationRowFileName !== null,
    setFocusedRowFileName,
    clearOperationRow,
    focusRow,
    restoreSafeFocus,
    enterRowOperation,
    handleCancelHierarchy,
    handleRowArrow,
    handleActionArrow,
    preventLockedAction,
    getRowFocusKey,
    getActionFocusKey: getModRowActionFocusKey
  };
};
