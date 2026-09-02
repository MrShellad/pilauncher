// src/hooks/useAchievementEvents.ts
import { useEffect } from 'react';
import { eventBus } from '../utils/eventBus';
import type {
  AchievementUnlockedPayload,
  AchievementSessionSummaryPayload,
} from '../utils/eventBus/events';

export interface UseAchievementEventsOptions {
  onUnlocked?: (payload: AchievementUnlockedPayload) => void;
  onSessionSummary?: (payload: AchievementSessionSummaryPayload) => void;
  filterInstanceId?: string;
}

export function useAchievementEvents(options: UseAchievementEventsOptions = {}) {
  const { onUnlocked, onSessionSummary, filterInstanceId } = options;

  useEffect(() => {
    const unsubUnlocked = eventBus.subscribe('achievement-unlocked', (payload) => {
      if (filterInstanceId && payload.instanceId !== filterInstanceId) {
        return;
      }
      onUnlocked?.(payload);
    });

    const unsubSummary = eventBus.subscribe('achievement-session-summary', (payload) => {
      if (filterInstanceId && payload.instanceId !== filterInstanceId) {
        return;
      }
      onSessionSummary?.(payload);
    });

    return () => {
      unsubUnlocked();
      unsubSummary();
    };
  }, [onUnlocked, onSessionSummary, filterInstanceId]);
}
