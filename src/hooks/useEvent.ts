// src/hooks/useEvent.ts
import { useEffect, useRef } from 'react';
import { eventBus } from '../utils/eventBus';
import type { AppEventMap } from '../utils/eventBus/events';

/**
 * A React hook to subscribe to the global Event Bus.
 * Automatically unsubscribes when the component unmounts.
 * 
 * @param event The event name to subscribe to
 * @param callback The handler function, which receives the typed payload
 */
export function useEvent<K extends keyof AppEventMap>(
  event: K,
  callback: (payload: AppEventMap[K]) => void
): void {
  // Use a ref to store the callback to avoid re-subscribing if callback changes
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const listener = (payload: AppEventMap[K]) => {
      callbackRef.current(payload);
    };

    const unsubscribe = eventBus.subscribe(event, listener);
    return unsubscribe;
  }, [event]);
}
