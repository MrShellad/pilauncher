import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import {
  getCachedCurseForgeCategories,
  getCachedModrinthCategories,
  type CurseForgeCategoryOption,
  type DownloadSource,
  type FilterOption,
  type TabType
} from '@/features/resource-catalog';
import type { VersionGroup } from '@/features/instances';
import {
  getBundledDownloadCategoryOptions,
  getSharedDownloadCategoryOptions
} from '../logic/downloadFilterConfig';

interface UseResourceDownloadMetadataOptions {
  activeTab: TabType;
  isEnvLoaded: boolean;
  source: DownloadSource;
}

const METADATA_LOAD_DELAY_MS = 180;

const toReleaseVersionOptions = (groups: VersionGroup[]): FilterOption[] => {
  const releases = groups
    .flatMap((group) => group.versions)
    .filter((version) => version.type === 'release')
    .sort((left, right) => right.release_time.localeCompare(left.release_time));

  return Array.from(new Map(releases.map((version) => [version.id, {
    label: version.id,
    value: version.id
  }])).values());
};

export const useResourceDownloadMetadata = ({
  activeTab,
  isEnvLoaded,
  source
}: UseResourceDownloadMetadataOptions) => {
  const [mcVersionOptions, setMcVersionOptions] = useState<FilterOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<FilterOption[]>(() => (
    getBundledDownloadCategoryOptions('mod')
  ));

  useEffect(() => {
    if (!isEnvLoaded) return;

    let cancelled = false;

    void invoke<VersionGroup[]>('get_minecraft_versions', { force: true })
      .then((groups) => {
        if (!cancelled) setMcVersionOptions(toReleaseVersionOptions(groups));
      })
      .catch((error) => {
        console.error('Failed to load official Minecraft versions:', error);
        if (!cancelled) setMcVersionOptions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isEnvLoaded]);

  useEffect(() => {
    if (!isEnvLoaded) return;

    let cancelled = false;

    const loadMetadata = async () => {
      const configuredModrinthCategories = await getSharedDownloadCategoryOptions(activeTab).catch((error) => {
        console.error('Failed to load Modrinth category config:', error);
        return getBundledDownloadCategoryOptions(activeTab);
      });

      if (source !== 'curseforge') {
        const modrinthCategories = await getCachedModrinthCategories(activeTab, configuredModrinthCategories).catch((error) => {
          console.error('Failed to load Modrinth categories:', error);
          return configuredModrinthCategories;
        });

        if (!cancelled) {
          setCategoryOptions(modrinthCategories.length > 0 ? modrinthCategories : configuredModrinthCategories);
        }
        return;
      }

      const categoryTask = activeTab === 'mod' || activeTab === 'resourcepack' || activeTab === 'shader'
        ? getCachedCurseForgeCategories(activeTab).catch((error) => {
            console.error('加载 CurseForge 分类失败:', error);
            return [] as CurseForgeCategoryOption[];
          })
        : Promise.resolve([] as CurseForgeCategoryOption[]);

      const categories = await categoryTask;
      if (cancelled) return;

      setCategoryOptions(categories);
    };

    const metadataTimer = setTimeout(() => {
      void loadMetadata();
    }, METADATA_LOAD_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(metadataTimer);
    };
  }, [activeTab, isEnvLoaded, source]);

  return { mcVersionOptions, categoryOptions };
};
