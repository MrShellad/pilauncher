import { useEffect, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';

import type { ModMeta } from './modService';
import { resourceService, type ResourceType } from './resourceService';

export type ModIconPriority = 'high' | 'medium' | 'low';
export type ModIconStatus = 'idle' | 'loading' | 'ready' | 'failed';

export interface ModIconSnapshot {
  key: string | null;
  src: string | null;
  status: ModIconStatus;
  isPlaceholder: boolean;
}

export interface IconTargetItem {
  fileName: string;
  cacheKey?: string | null;
  iconAbsolutePath?: string | null;
  offlineJarIconAbsolutePath?: string | null;
  networkIconUrl?: string | null;
  networkInfo?: { icon_url?: string } | null;
  fileSize?: number;
  modifiedAt?: number;
}

interface ModIconDescriptor {
  cacheId: string;
  candidates: string[];
}

interface QueueTask {
  cacheId: string;
  priority: ModIconPriority;
  sequence: number;
  run: () => Promise<string | null>;
}

interface InternalIconState {
  src: string | null;
  status: ModIconStatus;
  updatedAt: number;
}

const EMPTY_ICON: ModIconSnapshot = {
  key: null,
  src: null,
  status: 'idle',
  isPlaceholder: true
};

const MAX_MEMORY_ITEMS = 250;
const MAX_CONCURRENT_TASKS = 6;
const FAILED_RETRY_MS = 30_000;
const PRIORITY_WEIGHT: Record<ModIconPriority, number> = {
  high: 0,
  medium: 1,
  low: 2
};

const preloadImage = (src: string) => {
  return new Promise<string | null>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(src);
    image.onerror = () => resolve(null);
    image.src = src;
  });
};

class ModIconService {
  private memoryCache = new Map<string, string>();
  private states = new Map<string, InternalIconState>();
  private listeners = new Map<string, Set<(snapshot: ModIconSnapshot) => void>>();
  private downloadingMap = new Map<string, Promise<string | null>>();
  private queue: QueueTask[] = [];
  private nextSequence = 0;
  private activeTasks = 0;
  private pendingEmits = new Set<string>();
  private emitFrame: number | null = null;

  async connect(
    mod: IconTargetItem,
    priority: ModIconPriority,
    listener: (snapshot: ModIconSnapshot) => void
  ) {
    const descriptor = await this.resolveDescriptor(mod);
    if (!descriptor) {
      listener(EMPTY_ICON);
      return () => {};
    }

    listener(this.buildSnapshot(descriptor.cacheId));
    const unsubscribe = this.subscribe(descriptor.cacheId, listener);
    void this.getIconFromDescriptor(descriptor, priority);
    return unsubscribe;
  }

  private async resolveDescriptor(mod: IconTargetItem): Promise<ModIconDescriptor | null> {
    const candidates: string[] = [];

    if (mod.iconAbsolutePath) {
      candidates.push(convertFileSrc(mod.iconAbsolutePath));
    }

    if (mod.offlineJarIconAbsolutePath) {
      candidates.push(convertFileSrc(mod.offlineJarIconAbsolutePath));
    }

    const networkIconUrl = mod.networkIconUrl || mod.networkInfo?.icon_url;
    if (networkIconUrl && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      candidates.push(networkIconUrl);
    }

    if (candidates.length === 0) return null;

    return {
      cacheId: [mod.iconAbsolutePath, mod.offlineJarIconAbsolutePath, networkIconUrl].filter(Boolean).join('|'),
      candidates
    };
  }

  private async getIconFromDescriptor(descriptor: ModIconDescriptor, priority: ModIconPriority) {
    const cachedSrc = this.memoryCache.get(descriptor.cacheId);
    if (cachedSrc) {
      this.touchMemory(descriptor.cacheId, cachedSrc);
      this.setState(descriptor.cacheId, 'ready', cachedSrc);
      return this.buildSnapshot(descriptor.cacheId);
    }

    const current = this.states.get(descriptor.cacheId);
    if (
      current?.status === 'failed' &&
      Date.now() - current.updatedAt < FAILED_RETRY_MS
    ) {
      return this.buildSnapshot(descriptor.cacheId);
    }

    if (!this.downloadingMap.has(descriptor.cacheId)) {
      this.setState(descriptor.cacheId, 'loading', current?.src ?? null);
      this.enqueue({
        cacheId: descriptor.cacheId,
        priority,
        sequence: this.nextSequence++,
        run: () => this.loadCandidates(descriptor.cacheId, descriptor.candidates)
      });
    } else {
      this.promoteQueuedPriority(descriptor.cacheId, priority);
    }

    return this.buildSnapshot(descriptor.cacheId);
  }

  private subscribe(key: string, listener: (snapshot: ModIconSnapshot) => void) {
    const bucket = this.listeners.get(key) || new Set<(snapshot: ModIconSnapshot) => void>();
    bucket.add(listener);
    this.listeners.set(key, bucket);

    return () => {
      const current = this.listeners.get(key);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  private buildSnapshot(key: string): ModIconSnapshot {
    const cachedSrc = this.memoryCache.get(key);
    const state = this.states.get(key);
    const src = cachedSrc || state?.src || null;
    const status = cachedSrc ? 'ready' : (state?.status || 'idle');

    return {
      key,
      src,
      status,
      isPlaceholder: status !== 'ready' || !src
    };
  }

  private setState(key: string, status: ModIconStatus, src: string | null) {
    this.states.set(key, {
      src,
      status,
      updatedAt: Date.now()
    });
    this.scheduleEmit(key);
  }

  private cacheReadyIcon(key: string, src: string) {
    this.touchMemory(key, src);
    this.setState(key, 'ready', src);
  }

  private touchMemory(key: string, src: string) {
    if (this.memoryCache.has(key)) {
      this.memoryCache.delete(key);
    }
    this.memoryCache.set(key, src);

    while (this.memoryCache.size > MAX_MEMORY_ITEMS) {
      const firstKey = this.memoryCache.keys().next().value;
      if (!firstKey) break;
      this.memoryCache.delete(firstKey);
    }
  }

  private enqueue(task: QueueTask) {
    const existing = this.queue.find((item) => item.cacheId === task.cacheId);
    if (existing) {
      if (PRIORITY_WEIGHT[task.priority] < PRIORITY_WEIGHT[existing.priority]) {
        existing.priority = task.priority;
      }
      return;
    }

    this.queue.push(task);
    this.queue.sort((left, right) => {
      const priorityDiff = PRIORITY_WEIGHT[left.priority] - PRIORITY_WEIGHT[right.priority];
      return priorityDiff !== 0 ? priorityDiff : left.sequence - right.sequence;
    });
    this.pump();
  }

  private promoteQueuedPriority(cacheId: string, priority: ModIconPriority) {
    const queued = this.queue.find((item) => item.cacheId === cacheId);
    if (!queued) return;
    if (PRIORITY_WEIGHT[priority] >= PRIORITY_WEIGHT[queued.priority]) return;
    queued.priority = priority;
    this.queue.sort((left, right) => {
      const priorityDiff = PRIORITY_WEIGHT[left.priority] - PRIORITY_WEIGHT[right.priority];
      return priorityDiff !== 0 ? priorityDiff : left.sequence - right.sequence;
    });
  }

  private pump() {
    while (this.activeTasks < MAX_CONCURRENT_TASKS && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task || this.downloadingMap.has(task.cacheId)) {
        continue;
      }

      this.activeTasks += 1;
      const promise = task.run();
      this.downloadingMap.set(task.cacheId, promise);

      promise.finally(() => {
        this.downloadingMap.delete(task.cacheId);
        this.activeTasks = Math.max(0, this.activeTasks - 1);
        this.pump();
      });
    }
  }

  private async loadCandidates(cacheId: string, candidates: string[]) {
    for (const candidate of candidates) {
      const loaded = await preloadImage(candidate);
      if (loaded) {
        this.cacheReadyIcon(cacheId, loaded);
        return loaded;
      }
    }

    this.setState(cacheId, 'failed', null);
    return null;
  }

  private scheduleEmit(key: string) {
    this.pendingEmits.add(key);
    if (this.emitFrame !== null) return;

    this.emitFrame = window.requestAnimationFrame(() => {
      const keys = [...this.pendingEmits];
      this.pendingEmits.clear();
      this.emitFrame = null;

      for (const item of keys) {
        const snapshot = this.buildSnapshot(item);
        const listeners = this.listeners.get(item);
        if (!listeners) continue;
        for (const listener of listeners) {
          listener(snapshot);
        }
      }
    });
  }
}

const modIconService = new ModIconService();

export interface SubscribeResourceIconOptions {
  instanceId?: string;
  resType?: ResourceType;
}

export const subscribeToResourceIcon = (
  item: IconTargetItem,
  priority: ModIconPriority,
  listener: (snapshot: ModIconSnapshot) => void,
  options?: SubscribeResourceIconOptions | string
) => {
  const opts: SubscribeResourceIconOptions =
    typeof options === 'string'
      ? { instanceId: options, resType: 'mod' }
      : options || {};
  const { instanceId, resType = 'mod' } = opts;

  const resolveIconItem = async () => {
    if (
      instanceId &&
      !item.iconAbsolutePath &&
      !item.offlineJarIconAbsolutePath
    ) {
      try {
        const path = await resourceService.ensureOfflineResourceIcon(instanceId, resType, item.fileName);
        return path ? { ...item, offlineJarIconAbsolutePath: path, iconAbsolutePath: path } : item;
      } catch (error) {
        console.warn('Offline resource icon extraction failed', error);
      }
    }

    return item;
  };

  return resolveIconItem().then((resolvedItem) => (
    modIconService.connect(resolvedItem, priority, listener)
  ));
};

export const subscribeToModIcon = (
  mod: ModMeta,
  priority: ModIconPriority,
  listener: (snapshot: ModIconSnapshot) => void,
  instanceId?: string
) => {
  return subscribeToResourceIcon(mod, priority, listener, { instanceId, resType: 'mod' });
};

export const useResourceIcon = (
  item: IconTargetItem,
  priority: ModIconPriority = 'medium',
  options?: SubscribeResourceIconOptions | string
) => {
  const [snapshot, setSnapshot] = useState<ModIconSnapshot>(EMPTY_ICON);
  const opts: SubscribeResourceIconOptions =
    typeof options === 'string'
      ? { instanceId: options, resType: 'mod' }
      : options || {};
  const { instanceId, resType = 'mod' } = opts;

  useEffect(() => {
    let disposed = false;
    let unsubscribe = () => {};

    void subscribeToResourceIcon(item, priority, (nextSnapshot) => {
      if (!disposed) {
        setSnapshot(nextSnapshot);
      }
    }, { instanceId, resType }).then((disconnect) => {
      if (disposed) {
        disconnect();
        return;
      }
      unsubscribe = disconnect;
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [
    item.cacheKey,
    item.fileName,
    item.fileSize,
    item.modifiedAt,
    item.iconAbsolutePath,
    item.offlineJarIconAbsolutePath,
    item.networkIconUrl,
    item.networkInfo?.icon_url,
    priority,
    instanceId,
    resType
  ]);

  return snapshot;
};

export const useModIcon = (mod: ModMeta, priority: ModIconPriority, instanceId?: string) => {
  return useResourceIcon(mod, priority, { instanceId, resType: 'mod' });
};
