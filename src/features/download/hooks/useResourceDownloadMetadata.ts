import { useEffect, useState } from 'react';

import mcvData from '../../../assets/download/mcv.json';
import {
  getCachedCurseForgeCategories,
  getCachedCurseForgeMinecraftVersions,
  getCachedModrinthCategories,
  getCachedModrinthMcVersions,
  hasCurseForgeApiKey,
  type CurseForgeCategoryOption,
  type DownloadSource,
  type FilterOption,
  type TabType
} from '@/features/resource-catalog';
import {
  getBundledDownloadCategoryOptions,
  getSharedDownloadCategoryOptions
} from '../logic/downloadFilterConfig';

interface UseResourceDownloadMetadataOptions {
  activeTab: TabType;
  isEnvLoaded: boolean;
  source: DownloadSource;
}

const FALLBACK_MC_VERSIONS: string[] = Array.isArray(mcvData)
  ? mcvData
  : (mcvData as { versions?: string[] }).versions || [];

const METADATA_LOAD_DELAY_MS = 180;

const getDefaultVersions = (): FilterOption[] => FALLBACK_MC_VERSIONS.map((version) => ({
  label: version,
  value: version
}));

export const useResourceDownloadMetadata = ({
  activeTab,
  isEnvLoaded,
  source
}: UseResourceDownloadMetadataOptions) => {
  const [mcVersionOptions, setMcVersionOptions] = useState<FilterOption[]>(getDefaultVersions);
  const [categoryOptions, setCategoryOptions] = useState<FilterOption[]>(() => (
    getBundledDownloadCategoryOptions('mod')
  ));

  useEffect(() => {
    if (!isEnvLoaded) return;

    let cancelled = false;

    const loadMetadata = async () => {
      const configuredModrinthCategories = await getSharedDownloadCategoryOptions(activeTab).catch((error) => {
        console.error('Failed to load Modrinth category config:', error);
        return getBundledDownloadCategoryOptions(activeTab);
      });

      if (source !== 'curseforge') {
        const categoriesTask = getCachedModrinthCategories(activeTab, configuredModrinthCategories).catch((error) => {
          console.error('Failed to load Modrinth categories:', error);
          return configuredModrinthCategories;
        });
        const versionsTask = getCachedModrinthMcVersions().catch((error) => {
          console.error('Failed to load Modrinth game versions:', error);
          return getDefaultVersions();
        });

        const [modrinthCategories, modrinthMcVersions] = await Promise.all([categoriesTask, versionsTask]);

        if (!cancelled) {
          setMcVersionOptions(modrinthMcVersions.length > 0 ? modrinthMcVersions : getDefaultVersions());
          setCategoryOptions(modrinthCategories.length > 0 ? modrinthCategories : configuredModrinthCategories);
        }
        return;
      }

      const versionTask = hasCurseForgeApiKey()
        ? getCachedCurseForgeMinecraftVersions().catch((error) => {
            console.error('加载 CurseForge 版本列表失败:', error);
            return getDefaultVersions();
          })
        : Promise.resolve(getDefaultVersions());

      const categoryTask = activeTab === 'mod' || activeTab === 'resourcepack' || activeTab === 'shader'
        ? getCachedCurseForgeCategories(activeTab).catch((error) => {
            console.error('加载 CurseForge 分类失败:', error);
            return [] as CurseForgeCategoryOption[];
          })
        : Promise.resolve([] as CurseForgeCategoryOption[]);

      const [versions, categories] = await Promise.all([versionTask, categoryTask]);
      if (cancelled) return;

      setMcVersionOptions(versions.length > 0 ? versions : getDefaultVersions());
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
