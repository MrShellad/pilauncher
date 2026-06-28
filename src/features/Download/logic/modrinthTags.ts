import type { FilterOption, TabType } from '../hooks/useResourceDownload';
import {
  getDownloadCategoryTranslationKey,
  prettifyDownloadTagLabel
} from './downloadTagLabels';
import { readSessionCache, writeSessionCache } from './sessionCache';

interface ModrinthCategoryTag {
  name?: string;
  project_type?: string;
}

const MODRINTH_API_BASE = 'https://api.modrinth.com/v2';

const dedupeByValue = (options: FilterOption[]) => {
  const merged = new Map<string, FilterOption>();
  options.forEach((option) => {
    const key = option.value || option.slug || '';
    if (!key) return;

    const previous = merged.get(key);
    merged.set(key, {
      ...previous,
      ...option,
      value: key,
      slug: option.slug || previous?.slug || key,
      translationKey: option.translationKey || previous?.translationKey,
      defaultLabel: option.defaultLabel || previous?.defaultLabel,
      labels: option.labels || previous?.labels
    });
  });

  return Array.from(merged.values());
};

const mergeConfiguredCategoryMetadata = (
  categories: FilterOption[],
  configuredOptions: FilterOption[]
) => {
  if (!configuredOptions.length) return categories;

  const configuredByKey = new Map<string, FilterOption>();
  configuredOptions.forEach((option) => {
    const keys = [option.value, option.slug].filter(Boolean) as string[];
    keys.forEach((key) => configuredByKey.set(key, option));
  });

  return categories.map((category) => {
    const configured = configuredByKey.get(category.value) || configuredByKey.get(category.slug || '');
    if (!configured) return category;

    return {
      ...category,
      translationKey: configured.translationKey || category.translationKey,
      defaultLabel: configured.defaultLabel || category.defaultLabel,
      labels: configured.labels || category.labels
    };
  });
};

const normalizeModrinthCategory = (category: ModrinthCategoryTag): FilterOption | null => {
  const name = String(category?.name || '').trim();
  if (!name) return null;

  return {
    label: name,
    value: name,
    slug: name,
    translationKey: getDownloadCategoryTranslationKey(name),
    defaultLabel: prettifyDownloadTagLabel(name)
  };
};

const modrinthFetch = async <T>(path: string) => {
  const response = await fetch(`${MODRINTH_API_BASE}${path}`, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Modrinth request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const getCachedModrinthCategories = async (
  projectType: TabType,
  configuredOptions: FilterOption[] = []
): Promise<FilterOption[]> => {
  const cacheKey = `modrinth_categories_${projectType}`;
  const cached = await readSessionCache<FilterOption[]>(cacheKey);
  if (cached?.length) {
    return mergeConfiguredCategoryMetadata(cached, configuredOptions);
  }

  const data = await modrinthFetch<ModrinthCategoryTag[]>('/tag/category');
  const categories = dedupeByValue(
    data
      .filter((category) => category?.project_type === projectType)
      .map(normalizeModrinthCategory)
      .filter((item): item is FilterOption => item !== null)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }))
  );

  await writeSessionCache(cacheKey, categories);
  return mergeConfiguredCategoryMetadata(categories, configuredOptions);
};

interface ModrinthGameVersionTag {
  version: string;
  version_type: 'release' | 'snapshot';
  date: string;
  major: boolean;
}

export const getCachedModrinthMcVersions = async (): Promise<FilterOption[]> => {
  const cacheKey = 'modrinth_mc_versions';
  const cached = await readSessionCache<FilterOption[]>(cacheKey);
  if (cached?.length) {
    return cached;
  }

  try {
    const data = await modrinthFetch<ModrinthGameVersionTag[]>('/tag/game_version');
    const versions = data
      .filter((v) => v.version_type === 'release')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((v) => ({ label: v.version, value: v.version }));
    
    if (versions.length > 0) {
      await writeSessionCache(cacheKey, versions);
      return versions;
    }
  } catch (error) {
    console.error('Failed to fetch game versions from Modrinth:', error);
  }

  return [];
};
