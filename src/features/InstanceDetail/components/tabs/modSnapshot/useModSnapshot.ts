import { useCallback, useEffect, useMemo, useState } from 'react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { useLinearNavigation } from '../../../../../ui/focus/useLinearNavigation';
import type { InstanceSnapshot, ModMeta, SnapshotDiff } from '../../../../logic/modService';
import { computeRollbackDiff } from './modSnapshotUtils';

export const TIMELINE_ROW_FOCUS_KEY_PREFIX = 'mod-snapshot-timeline';
export const ROLLBACK_FOCUS_KEY = 'mod-snapshot-rollback';

export const getTimelineFocusKey = (snapshotId: string) => `${TIMELINE_ROW_FOCUS_KEY_PREFIX}-${snapshotId}`;

export interface UseModSnapshotProps {
  isOpen: boolean;
  history: InstanceSnapshot[];
  currentMods: ModMeta[];
  diffs: Record<string, SnapshotDiff>;
  onDiffRequest: (oldId: string, newId: string) => void;
  onRollback: (snapshotId: string) => void;
}

export const useModSnapshot = ({
  isOpen,
  history,
  currentMods,
  diffs,
  onDiffRequest,
  onRollback
}: UseModSnapshotProps) => {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [rollbackConfirmTarget, setRollbackConfirmTarget] = useState<string | null>(null);

  const timelineFocusKeys = useMemo(
    () => history.map((snapshot) => getTimelineFocusKey(snapshot.id)),
    [history]
  );

  const defaultFocusKey = selectedSnapshotId
    ? getTimelineFocusKey(selectedSnapshotId)
    : timelineFocusKeys[0];

  const { handleLinearArrow: handleTimelineLinearArrow } = useLinearNavigation(
    timelineFocusKeys,
    defaultFocusKey,
    false,
    isOpen
  );

  useEffect(() => {
    if (!isOpen) {
      setSelectedSnapshotId(null);
      setRollbackConfirmTarget(null);
      return;
    }

    if (history.length === 0) {
      setSelectedSnapshotId(null);
      return;
    }

    const hasSelectedSnapshot = history.some((snapshot) => snapshot.id === selectedSnapshotId);
    if (!hasSelectedSnapshot) {
      setSelectedSnapshotId(history[0].id);
    }
  }, [history, isOpen, selectedSnapshotId]);

  useEffect(() => {
    if (!selectedSnapshotId || history.length === 0) {
      return;
    }

    const currentIndex = history.findIndex((snapshot) => snapshot.id === selectedSnapshotId);
    if (currentIndex < 0 || currentIndex >= history.length - 1) {
      return;
    }

    const previousSnapshotId = history[currentIndex + 1].id;
    const diffKey = `${previousSnapshotId}->${selectedSnapshotId}`;
    if (!diffs[diffKey]) {
      onDiffRequest(previousSnapshotId, selectedSnapshotId);
    }
  }, [diffs, history, onDiffRequest, selectedSnapshotId]);

  const rollbackTargetIndex = rollbackConfirmTarget
    ? history.findIndex((s) => s.id === rollbackConfirmTarget)
    : -1;
  const rollbackTargetSnapshot = rollbackTargetIndex >= 0 ? history[rollbackTargetIndex] : null;

  const rollbackDiff = useMemo(() => {
    if (!rollbackTargetSnapshot || !rollbackConfirmTarget) return null;
    return computeRollbackDiff(currentMods, rollbackTargetSnapshot.mods);
  }, [currentMods, rollbackTargetSnapshot, rollbackConfirmTarget]);

  const handleRollbackClick = useCallback(() => {
    if (!selectedSnapshotId) return;
    setRollbackConfirmTarget(selectedSnapshotId);
  }, [selectedSnapshotId]);

  const handleRollbackConfirm = useCallback(() => {
    if (!rollbackConfirmTarget) return;
    onRollback(rollbackConfirmTarget);
    setRollbackConfirmTarget(null);
  }, [rollbackConfirmTarget, onRollback]);

  const handleRollbackCancel = useCallback(() => {
    setRollbackConfirmTarget(null);
  }, []);

  const selectedSnapshot = history.find((snapshot) => snapshot.id === selectedSnapshotId) || null;
  const currentIndex = selectedSnapshot
    ? history.findIndex((snapshot) => snapshot.id === selectedSnapshot.id)
    : -1;
  const previousSnapshot =
    currentIndex >= 0 && currentIndex < history.length - 1 ? history[currentIndex + 1] : null;
  const currentDiff = previousSnapshot && selectedSnapshotId ? diffs[`${previousSnapshot.id}->${selectedSnapshotId}`] : null;

  const handleTimelineArrow = (snapshotId: string) => (direction: string) => {
    if (direction === 'up' || direction === 'down') {
      return handleTimelineLinearArrow(direction);
    }

    if (direction === 'right' && selectedSnapshot) {
      setSelectedSnapshotId(snapshotId);
      setFocus(ROLLBACK_FOCUS_KEY);
      return false;
    }

    return undefined;
  };

  const handleRollbackArrow = (direction: string) => {
    if (direction === 'left' && selectedSnapshotId) {
      setFocus(getTimelineFocusKey(selectedSnapshotId));
      return false;
    }

    return undefined;
  };

  return {
    selectedSnapshotId,
    setSelectedSnapshotId,
    rollbackConfirmTarget,
    rollbackDiff,
    rollbackTargetIndex,
    selectedSnapshot,
    currentIndex,
    previousSnapshot,
    currentDiff,
    defaultFocusKey,
    handleRollbackClick,
    handleRollbackConfirm,
    handleRollbackCancel,
    handleTimelineArrow,
    handleRollbackArrow
  };
};
