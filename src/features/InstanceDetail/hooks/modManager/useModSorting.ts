import { useMemo, useState } from 'react';

import type { ModMeta } from '../../logic/modService';
import { compareText, type ModSortOrder, type ModSortType } from './modManagerShared';

export const useModSorting = (mods: ModMeta[], isLoading: boolean) => {
  const [sortType, setSortType] = useState<ModSortType>('time');
  const [sortOrder, setSortOrder] = useState<ModSortOrder>('desc');

  const sortedMods = useMemo(() => {
    if (isLoading) {
      return mods;
    }

    return [...mods].sort((a, b) => {
      let comparison = 0;
      if (sortType === 'time') {
        comparison = a.modifiedAt - b.modifiedAt;
      } else if (sortType === 'fileName') {
        comparison = compareText(a.fileName, b.fileName);
      } else if (sortType === 'version') {
        comparison = compareText(a.version, b.version);
      } else if (sortType === 'update') {
        comparison = Number(a.hasUpdate) - Number(b.hasUpdate);
        if (comparison === 0) {
          comparison = compareText(a.updateVersionName, b.updateVersionName);
        }
      } else {
        comparison = compareText(a.name || a.fileName, b.name || b.fileName);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [isLoading, mods, sortType, sortOrder]);

  return {
    sortedMods,
    sortType,
    setSortType,
    sortOrder,
    setSortOrder
  };
};
