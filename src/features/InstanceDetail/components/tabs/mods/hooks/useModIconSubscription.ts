import { startTransition, useEffect, useMemo, useRef, useState } from 'react';

import type { ModMeta } from '../../../../logic/modService';
import { subscribeToModIcon, type ModIconPriority, type ModIconSnapshot } from '../../../../logic/modIconService';

const MAX_CACHED_ICON_SNAPSHOTS = 400;

const rememberedIconSnapshots = new Map<string, ModIconSnapshot>();

const getModIconSnapshotKey = (mod: ModMeta) => {
  return [
    mod.cacheKey || mod.fileName,
    mod.fileName,
    mod.modifiedAt || 0,
    mod.fileSize || 0,
    mod.networkIconUrl || mod.networkInfo?.icon_url || ''
  ].join('|');
};

const rememberIconSnapshot = (mod: ModMeta, snapshot: ModIconSnapshot) => {
  if (!snapshot.src) {
    return;
  }

  const key = getModIconSnapshotKey(mod);
  if (rememberedIconSnapshots.has(key)) {
    rememberedIconSnapshots.delete(key);
  }
  rememberedIconSnapshots.set(key, snapshot);

  while (rememberedIconSnapshots.size > MAX_CACHED_ICON_SNAPSHOTS) {
    const firstKey = rememberedIconSnapshots.keys().next().value;
    if (!firstKey) break;
    rememberedIconSnapshots.delete(firstKey);
  }
};

const getRememberedIconSnapshots = (mods: ModMeta[]) => {
  const entries = mods.flatMap((mod) => {
    const snapshot = rememberedIconSnapshots.get(getModIconSnapshotKey(mod));
    return snapshot ? [[mod.fileName, snapshot] as const] : [];
  });

  return Object.fromEntries(entries);
};

const getIconPriority = (
  modIndex: number,
  focusedIndex: number,
  visibleCount: number
): ModIconPriority => {
  if (focusedIndex >= 0 && Math.abs(modIndex - focusedIndex) <= 2) {
    return 'high';
  }

  if (modIndex < Math.min(visibleCount, 10)) {
    return 'high';
  }

  if (focusedIndex >= 0 && Math.abs(modIndex - focusedIndex) <= 8) {
    return 'medium';
  }

  return 'low';
};

interface UseModIconSubscriptionOptions {
  mods: ModMeta[];
  visibleMods: ModMeta[];
  focusedRowFileName: string | null;
}

const getModIconSourceKey = (mod: ModMeta) => {
  return [
    mod.iconAbsolutePath || '',
    mod.networkIconUrl || '',
    mod.networkInfo?.icon_url || ''
  ].join('|');
};

export const useModIconSubscription = ({
  mods,
  visibleMods,
  focusedRowFileName
}: UseModIconSubscriptionOptions) => {
  const [iconSnapshots, setIconSnapshots] = useState<Record<string, ModIconSnapshot>>(() => (
    getRememberedIconSnapshots(mods)
  ));

  const focusedRowIndex = useMemo(() => {
    return mods.findIndex((mod) => mod.fileName === focusedRowFileName);
  }, [focusedRowFileName, mods]);

  const subscriptionsRef = useRef<Map<string, { unsubscribe: () => void; sourceKey: string }>>(new Map());
  const unsubscribeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    setIconSnapshots((current) => {
      let changed = false;
      const next: Record<string, ModIconSnapshot> = { ...current };

      mods.forEach((mod) => {
        const currentSnapshot = current[mod.fileName];
        const rememberedSnapshot = rememberedIconSnapshots.get(getModIconSnapshotKey(mod));
        const nextSnapshot = currentSnapshot || rememberedSnapshot;

        if (nextSnapshot && next[mod.fileName] !== nextSnapshot) {
          next[mod.fileName] = nextSnapshot;
          changed = true;
        }
      });

      if (!changed) {
        return current;
      }

      return next;
    });
  }, [mods]);

  useEffect(() => {
    const currentSubs = subscriptionsRef.current;
    const timers = unsubscribeTimersRef.current;
    const nextFileNames = new Set(visibleMods.map((mod) => mod.fileName));

    for (const [fileName, sub] of currentSubs.entries()) {
      if (!nextFileNames.has(fileName)) {
        if (!timers.has(fileName)) {
          const timer = setTimeout(() => {
            sub.unsubscribe();
            currentSubs.delete(fileName);
            timers.delete(fileName);
          }, 3000);
          timers.set(fileName, timer);
        }
      } else {
        const timer = timers.get(fileName);
        if (timer) {
          clearTimeout(timer);
          timers.delete(fileName);
        }
      }
    }

    visibleMods.forEach((mod, modIndex) => {
      const existing = currentSubs.get(mod.fileName);
      const currentSourceKey = getModIconSourceKey(mod);

      if (!existing || existing.sourceKey !== currentSourceKey) {
        if (existing) {
          existing.unsubscribe();
        }

        const priority = getIconPriority(modIndex, focusedRowIndex, visibleMods.length);
        
        let subDisposed = false;
        let unsubscribe = () => { subDisposed = true; };
        
        currentSubs.set(mod.fileName, {
          unsubscribe: () => { unsubscribe(); },
          sourceKey: currentSourceKey
        });

        void subscribeToModIcon(mod, priority, (snapshot) => {
          if (subDisposed) {
            return;
          }

          rememberIconSnapshot(mod, snapshot);

          startTransition(() => {
            setIconSnapshots((current) => {
              const previous = current[mod.fileName];
              if (
                previous?.key === snapshot.key &&
                previous?.src === snapshot.src &&
                previous?.status === snapshot.status &&
                previous?.isPlaceholder === snapshot.isPlaceholder
              ) {
                return current;
              }

              return {
                ...current,
                [mod.fileName]: snapshot
              };
            });
          });
        }).then((disconnect) => {
          if (subDisposed) {
            disconnect();
          } else {
            unsubscribe = disconnect;
          }
        });
      }
    });
  }, [focusedRowIndex, visibleMods]);

  useEffect(() => {
    return () => {
      unsubscribeTimersRef.current.forEach((timer) => clearTimeout(timer));
      unsubscribeTimersRef.current.clear();
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current.clear();
    };
  }, []);

  return iconSnapshots;
};
