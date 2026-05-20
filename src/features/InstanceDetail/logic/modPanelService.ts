import type { ModMeta } from './modService';

export interface ModFileCleanupItem {
  originalFileName: string;
  suggestedFileName: string;
}

const DISABLED_SUFFIX = '.disabled';
const CLEANUP_TAG_PATTERN = /(?:\[[^\]]*[^\x00-\x7F][^\]]*\]|【[^】]*】)\s*/g;

const stripDisabledSuffix = (fileName: string) => {
  if (!fileName.endsWith(DISABLED_SUFFIX)) {
    return { baseName: fileName, isDisabled: false };
  }

  return {
    baseName: fileName.slice(0, -DISABLED_SUFFIX.length),
    isDisabled: true
  };
};

export const getToggledModFileName = (fileName: string, enable: boolean) => {
  if (enable) {
    return fileName.endsWith(DISABLED_SUFFIX)
      ? fileName.slice(0, -DISABLED_SUFFIX.length)
      : fileName;
  }

  return fileName.endsWith(DISABLED_SUFFIX)
    ? fileName
    : `${fileName}${DISABLED_SUFFIX}`;
};

export const analyzeModFileCleanupCandidates = (mods: ModMeta[]): ModFileCleanupItem[] => {
  const items: ModFileCleanupItem[] = [];

  for (const mod of mods) {
    const { baseName, isDisabled } = stripDisabledSuffix(mod.fileName);
    const cleanedBaseName = baseName
      .replace(CLEANUP_TAG_PATTERN, '')
      .trim()
      .replace(/^[-\s]+/, '');

    if (!cleanedBaseName || cleanedBaseName === baseName) {
      continue;
    }

    items.push({
      originalFileName: mod.fileName,
      suggestedFileName: isDisabled ? `${cleanedBaseName}${DISABLED_SUFFIX}` : cleanedBaseName
    });
  }

  return items;
};

export const filterModsByQuery = (mods: ModMeta[], searchQuery: string) => {
  const query = searchQuery.trim().toLowerCase();
  if (!query) {
    return mods;
  }

  return mods.filter((mod) => {
    const haystack = [
      mod.name,
      mod.fileName,
      mod.description,
      mod.version,
      mod.networkInfo?.title,
      mod.networkInfo?.description
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
};

export const toggleSelectedModFile = (selectedMods: Set<string>, fileName: string) => {
  const next = new Set(selectedMods);

  if (next.has(fileName)) {
    next.delete(fileName);
  } else {
    next.add(fileName);
  }

  return next;
};

export const toggleSelectAllModFiles = (mods: ModMeta[], selectedMods: Set<string>) => {
  if (mods.length > 0 && selectedMods.size === mods.length) {
    return new Set<string>();
  }

  return new Set(mods.map((mod) => mod.fileName));
};

export const pruneDeletedModSelections = (selectedMods: Set<string>, fileNames: string[]) => {
  if (selectedMods.size === 0 || fileNames.length === 0) {
    return selectedMods;
  }

  const next = new Set(selectedMods);
  fileNames.forEach((fileName) => next.delete(fileName));
  return next;
};

export const remapSelectedModsAfterToggle = (selectedMods: Set<string>, fileName: string, enable: boolean) => {
  if (!selectedMods.has(fileName)) {
    return selectedMods;
  }

  const next = new Set(selectedMods);
  next.delete(fileName);
  next.add(getToggledModFileName(fileName, enable));
  return next;
};

export const remapSelectedModsAfterBatchToggle = (selectedMods: Set<string>, fileNames: string[], enable: boolean) => {
  if (selectedMods.size === 0 || fileNames.length === 0) {
    return selectedMods;
  }

  const next = new Set(selectedMods);

  fileNames.forEach((fileName) => {
    if (!next.has(fileName)) {
      return;
    }

    next.delete(fileName);
    next.add(getToggledModFileName(fileName, enable));
  });

  return next;
};

export const pruneUnavailableModSelections = (mods: ModMeta[], selectedMods: Set<string>) => {
  if (selectedMods.size === 0) {
    return selectedMods;
  }

  const availableFileNames = new Set(mods.map((mod) => mod.fileName));
  const next = new Set<string>();

  selectedMods.forEach((fileName) => {
    if (availableFileNames.has(fileName)) {
      next.add(fileName);
    }
  });

  return next.size === selectedMods.size ? selectedMods : next;
};

export const areAllModFilesSelected = (mods: ModMeta[], selectedMods: Set<string>) => {
  return mods.length > 0 && selectedMods.size === mods.length;
};
