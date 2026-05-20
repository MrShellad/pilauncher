import { invoke } from '@tauri-apps/api/core';

import bundledConfig from '../../../assets/config/download_filter_categories.json';
import type { FilterOption, TabType } from '../hooks/useResourceDownload';

interface RawFilterOption {
  label?: string;
  value?: string;
  slug?: string;
  translationKey?: string;
  defaultLabel?: string;
  labels?: Record<string, string>;
}

interface DownloadFilterConfigPayload {
  version?: number;
  categories?: Partial<Record<TabType, RawFilterOption[]>>;
}

interface NormalizedDownloadFilterConfig {
  version?: number;
  categories: Record<TabType, FilterOption[]>;
}

const FALLBACK_CONFIG: DownloadFilterConfigPayload = bundledConfig;
let sharedConfigPromise: Promise<NormalizedDownloadFilterConfig> | null = null;

const sanitizeFilterOption = (option: RawFilterOption): FilterOption | null => {
  const value = String(option?.value || '').trim();
  if (!value) return null;

  return {
    value,
    label: String(option?.label || value),
    slug: String(option?.slug || value),
    translationKey: option?.translationKey ? String(option.translationKey) : undefined,
    defaultLabel: option?.defaultLabel ? String(option.defaultLabel) : undefined,
    labels: option?.labels && typeof option.labels === 'object'
      ? Object.fromEntries(
          Object.entries(option.labels)
            .filter(([key, label]) => key && typeof label === 'string' && label.trim().length > 0)
            .map(([key, label]) => [key, label.trim()])
        )
      : undefined
  };
};

const normalizeCategoryList = (options: RawFilterOption[] | undefined): FilterOption[] =>
  Array.isArray(options)
    ? options.map(sanitizeFilterOption).filter((item): item is FilterOption => item !== null)
    : [];

const normalizeConfig = (payload: DownloadFilterConfigPayload | null | undefined): NormalizedDownloadFilterConfig => {
  const categories = payload?.categories || {};
  const fallbackCategories = FALLBACK_CONFIG.categories || {};

  return {
    version: typeof payload?.version === 'number' ? payload.version : FALLBACK_CONFIG.version,
    categories: {
      mod: normalizeCategoryList(categories.mod || fallbackCategories.mod),
      resourcepack: normalizeCategoryList(categories.resourcepack || fallbackCategories.resourcepack),
      shader: normalizeCategoryList(categories.shader || fallbackCategories.shader),
      modpack: normalizeCategoryList(categories.modpack || fallbackCategories.modpack)
    }
  };
};

export const getBundledDownloadCategoryOptions = (tab: TabType): FilterOption[] =>
  normalizeConfig(FALLBACK_CONFIG).categories?.[tab] || [];

export const getSharedDownloadCategoryOptions = async (tab: TabType): Promise<FilterOption[]> => {
  if (!sharedConfigPromise) {
    sharedConfigPromise = invoke<DownloadFilterConfigPayload>('read_shared_download_filter_config')
      .then((payload) => normalizeConfig(payload))
      .catch((error) => {
        console.error('Failed to load shared_mods download filter config:', error);
        return normalizeConfig(FALLBACK_CONFIG);
      });
  }

  const config = await sharedConfigPromise;
  return config.categories?.[tab] || [];
};
