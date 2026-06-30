// src/utils/eventBus/index.ts
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { AppEventMap } from './events';

export type EventCallback<T> = (payload: T) => void;

class TypedEventBus {
  private listeners: { [K in keyof AppEventMap]?: Set<EventCallback<AppEventMap[K]>> } = {};
  private tauriUnlisteners: { [K in keyof AppEventMap]?: Promise<UnlistenFn> } = {};

  // List of events that originate from the Tauri Rust backend
  private tauriEvents: Set<keyof AppEventMap> = new Set([
    'game-log',
    'game-exit',
    'resource-download-progress',
    'native-gamepad-event',
    'trust_request_received',
    'trust_list_updated',
    'incoming-trust-request',
    'save-backup-progress',
    'instance-runtime-verify-progress',
    'instance-mods-scan-progress',
    'third-party-import-progress',
    'snapshot-progress',
    'instance-deployment-progress',
    'instance-deployment-speed',
    'download-task-log',
    'launcher-update-progress',
    'java-installed-auto-set'
  ]);

  /**
   * Subscribe to an event.
   * Returns an unsubscribe function.
   */
  subscribe<K extends keyof AppEventMap>(
    event: K,
    callback: EventCallback<AppEventMap[K]>
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as any;
    }
    this.listeners[event]!.add(callback);

    // If it's a Tauri backend event, bridge it asynchronously if not already bridged
    if (this.tauriEvents.has(event) && !this.tauriUnlisteners[event]) {
      this.setupTauriBridge(event);
    }

    return () => this.unsubscribe(event, callback);
  }

  /**
   * Publish/dispatch an event in memory.
   */
  publish<K extends keyof AppEventMap>(event: K, payload: AppEventMap[K]): void {
    const list = this.listeners[event];
    if (list) {
      list.forEach((cb) => {
        try {
          cb(payload);
        } catch (e) {
          console.error(`Error in event listener callback for "${String(event)}":`, e);
        }
      });
    }
  }

  /**
   * Unsubscribe a callback.
   */
  private unsubscribe<K extends keyof AppEventMap>(
    event: K,
    callback: EventCallback<AppEventMap[K]>
  ): void {
    const list = this.listeners[event];
    if (list) {
      list.delete(callback);
      if (list.size === 0) {
        delete this.listeners[event];

        // Clean up the Tauri IPC channel if nobody is listening
        const unlistenerPromise = this.tauriUnlisteners[event];
        if (unlistenerPromise) {
          delete this.tauriUnlisteners[event];
          unlistenerPromise.then((unlisten) => unlisten());
        }
      }
    }
  }

  /**
   * Connects Tauri IPC events to our Event Bus.
   */
  private setupTauriBridge<K extends keyof AppEventMap>(event: K): void {
    let resolveUnlistener: (fn: UnlistenFn) => void = () => {};
    const promise = new Promise<UnlistenFn>((resolve) => {
      resolveUnlistener = resolve;
    });

    this.tauriUnlisteners[event] = promise;

    listen<any>(String(event), (tauriEvent) => {
      // Forward the Tauri payload to local Event Bus subscribers
      this.publish(event, tauriEvent.payload);
    })
      .then((unlisten) => {
        // If it was already unsubscribed in the meantime, call unlisten immediately
        if (!this.tauriUnlisteners[event]) {
          unlisten();
        } else {
          resolveUnlistener(unlisten);
        }
      })
      .catch((err) => {
        console.error(`Failed to register Tauri event bridge for: ${String(event)}`, err);
        delete this.tauriUnlisteners[event];
      });
  }
}

export const eventBus = new TypedEventBus();
export type { AppEventMap };
