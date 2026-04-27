import { startTransition, useEffect, useMemo, useState } from 'react';

import type { ModMeta } from '../../../logic/modService';
import { subscribeToModIcon, type ModIconPriority, type ModIconSnapshot } from '../../../logic/modIconService';

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

export const useModIconSubscription = ({
  mods,
  visibleMods,
  focusedRowFileName
}: UseModIconSubscriptionOptions) => {
  const [iconSnapshots, setIconSnapshots] = useState<Record<string, ModIconSnapshot>>({});

  const focusedRowIndex = useMemo(() => {
    return mods.findIndex((mod) => mod.fileName === focusedRowFileName);
  }, [focusedRowFileName, mods]);

  useEffect(() => {
    const activeFileNames = new Set(mods.map((mod) => mod.fileName));

    setIconSnapshots((current) => {
      const nextEntries = Object.entries(current).filter(([fileName]) => activeFileNames.has(fileName));
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }

      return Object.fromEntries(nextEntries);
    });
  }, [mods]);

  useEffect(() => {
    let disposed = false;
    const disposers: Array<() => void> = [];

    visibleMods.forEach((mod, modIndex) => {
      const priority = getIconPriority(modIndex, focusedRowIndex, visibleMods.length);

      void subscribeToModIcon(mod, priority, (snapshot) => {
        if (disposed) {
          return;
        }

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
        if (disposed) {
          disconnect();
          return;
        }

        disposers.push(disconnect);
      });
    });

    return () => {
      disposed = true;
      disposers.forEach((dispose) => dispose());
    };
  }, [focusedRowIndex, visibleMods]);

  return iconSnapshots;
};
