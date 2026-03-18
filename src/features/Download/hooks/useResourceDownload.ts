import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

import mcvData from '../../../assets/download/mcv.json';
import { searchModrinth, type ModrinthProject } from '../../InstanceDetail/logic/modrinthApi';
import { modService, type ModMeta } from '../../InstanceDetail/logic/modService';
import {
  getCachedCurseForgeCategories,
  getCachedCurseForgeMinecraftVersions,
  hasCurseForgeApiKey,
  searchCurseForge,
  type CurseForgeCategoryOption
} from '../logic/curseforgeApi';

export type TabType = 'mod' | 'resourcepack' | 'shader' | 'modpack';
export type DownloadSource = 'modrinth' | 'curseforge';

export interface FilterOption {
  label: string;
  value: string;
  slug?: string;
}

export interface DownloadInstanceConfig {
  game_version?: string;
  gameVersion?: string;
  loader_type?: string;
  loaderType?: string;
  [key: string]: unknown;
}

interface DownloadCache {
  instanceId: string;
  instanceConfig: DownloadInstanceConfig | null;
  activeTab: TabType;
  query: string;
  mcVersion: string;
  loaderType: string;
  category: string;
  sort: string;
  source: DownloadSource;
  results: ModrinthProject[];
  offset: number;
  hasMore: boolean;
}

const FALLBACK_MC_VERSIONS: string[] = Array.isArray(mcvData)
  ? mcvData
  : (mcvData as { versions?: string[] }).versions || [];

let globalCache: DownloadCache | null = null;

const MODRINTH_CATEGORY_OPTIONS: Record<TabType, FilterOption[]> = {
  mod: [
    { label: 'technology', value: 'technology', slug: 'technology' },
    { label: 'magic', value: 'magic', slug: 'magic' },
    { label: 'optimization', value: 'optimization', slug: 'optimization' },
    { label: 'utility', value: 'utility', slug: 'utility' },
    { label: 'decoration', value: 'decoration', slug: 'decoration' }
  ],
  resourcepack: [],
  shader: [],
  modpack: []
};

const getDefaultVersions = (): FilterOption[] => FALLBACK_MC_VERSIONS.map((version) => ({ label: version, value: version }));

export const useResourceDownload = (instanceId?: string | null) => {
  const isCacheValid = Boolean(instanceId && globalCache?.instanceId === instanceId);

  const [activeTab, setActiveTab] = useState<TabType>(() => (isCacheValid ? globalCache!.activeTab : 'mod'));
  const [instanceConfig, setInstanceConfig] = useState<DownloadInstanceConfig | null>(() => (isCacheValid ? globalCache!.instanceConfig : null));
  const [isEnvLoaded, setIsEnvLoaded] = useState(() => isCacheValid);
  const [installedMods, setInstalledMods] = useState<ModMeta[]>([]);

  const [query, setQuery] = useState(() => (isCacheValid ? globalCache!.query : ''));
  const [mcVersion, setMcVersion] = useState(() => (isCacheValid ? globalCache!.mcVersion : ''));
  const [loaderType, setLoaderType] = useState(() => (isCacheValid ? globalCache!.loaderType : ''));
  const [category, setCategory] = useState(() => (isCacheValid ? globalCache!.category : ''));
  const [sort, setSort] = useState(() => (isCacheValid ? globalCache!.sort : 'relevance'));
  const [source, setSource] = useState<DownloadSource>(() => (isCacheValid ? globalCache!.source : 'modrinth'));

  const [results, setResults] = useState<ModrinthProject[]>(() => (isCacheValid ? globalCache!.results : []));
  const [offset, setOffset] = useState(() => (isCacheValid ? globalCache!.offset : 0));
  const [hasMore, setHasMore] = useState(() => (isCacheValid ? globalCache!.hasMore : true));

  const [mcVersionOptions, setMcVersionOptions] = useState<FilterOption[]>(getDefaultVersions);
  const [categoryOptions, setCategoryOptions] = useState<FilterOption[]>(MODRINTH_CATEGORY_OPTIONS.mod);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const isFirstMount = useRef(true);

  useEffect(() => {
    const initEnv = async () => {
      if (!instanceId) {
        setIsEnvLoaded(true);
        return;
      }

      try {
        const mods = await modService.getMods(instanceId);
        setInstalledMods(mods || []);
      } catch {
        setInstalledMods([]);
      }

      if (isCacheValid) return;

      try {
        const config = await invoke<DownloadInstanceConfig>('get_instance_detail', { id: instanceId });
        const safeConfig = config || {};
        setInstanceConfig(safeConfig);

        const gameVer = String(safeConfig.game_version || safeConfig.gameVersion || '');
        const loader = String(safeConfig.loader_type || safeConfig.loaderType || '');
        setMcVersion(gameVer);
        setLoaderType(loader.toLowerCase() === 'vanilla' ? '' : loader.toLowerCase());
      } catch (error) {
        console.error('获取实例环境失败:', error);
      } finally {
        setIsEnvLoaded(true);
      }
    };

    void initEnv();
  }, [instanceId, isCacheValid]);

  useEffect(() => {
    let cancelled = false;

    const loadMetadata = async () => {
      const modrinthCategories = MODRINTH_CATEGORY_OPTIONS[activeTab] || [];

      if (source !== 'curseforge') {
        if (!cancelled) {
          setMcVersionOptions(getDefaultVersions());
          setCategoryOptions(modrinthCategories);
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

    void loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [activeTab, source]);

  useEffect(() => {
    if (!category) return;
    const validValues = new Set(categoryOptions.map((item) => item.value));
    if (!validValues.has(category)) setCategory('');
  }, [category, categoryOptions]);

  useEffect(() => {
    if (!mcVersion) return;
    const validValues = new Set(mcVersionOptions.map((item) => item.value));
    if (!validValues.has(mcVersion) && source === 'curseforge') setMcVersion('');
  }, [mcVersion, mcVersionOptions, source]);

  const executeSearch = useCallback(async (currentOffset: number, isLoadMore = false) => {
    if (!isEnvLoaded) return;

    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setResults([]);
    }

    try {
      const data = source === 'curseforge'
        ? await searchCurseForge({
            query,
            category,
            sort: sort as 'relevance' | 'downloads' | 'updated' | 'newest',
            projectType: activeTab,
            version: mcVersion || undefined,
            loader: activeTab === 'mod' ? loaderType || undefined : undefined,
            offset: currentOffset,
            limit: 20
          })
        : await searchModrinth({
            query,
            category,
            sort: sort as 'relevance' | 'downloads' | 'updated' | 'newest',
            projectType: activeTab,
            version: mcVersion || undefined,
            loader: activeTab === 'mod' ? loaderType || undefined : undefined,
            offset: currentOffset,
            limit: 20
          });

      if (isLoadMore) setResults((prev) => [...prev, ...data.hits]);
      else setResults(data.hits);

      setHasMore(currentOffset + data.hits.length < data.total_hits);
    } catch (error) {
      console.error(error);
      if (!isLoadMore) setResults([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeTab, category, isEnvLoaded, loaderType, mcVersion, query, sort, source]);

  useEffect(() => {
    if (!isEnvLoaded) return;

    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (isCacheValid) return;
    }

    setOffset(0);
    void executeSearch(0, false);
  }, [activeTab, executeSearch, isCacheValid, isEnvLoaded, source]);

  useEffect(() => {
    if (instanceId && isEnvLoaded) {
      globalCache = {
        instanceId,
        instanceConfig,
        activeTab,
        query,
        mcVersion,
        loaderType,
        category,
        sort,
        source,
        results,
        offset,
        hasMore
      };
    }
  }, [activeTab, category, hasMore, instanceConfig, instanceId, isEnvLoaded, loaderType, mcVersion, offset, query, results, sort, source]);

  const handleSearchClick = () => {
    setOffset(0);
    void executeSearch(0, false);
  };

  const handleResetClick = () => {
    setQuery('');
    setCategory('');
    setSort('relevance');

    if (instanceConfig) {
      const gameVer = instanceConfig.game_version || instanceConfig.gameVersion || '';
      const loader = instanceConfig.loader_type || instanceConfig.loaderType || '';
      setMcVersion(gameVer);
      setLoaderType((loader || '').toLowerCase() === 'vanilla' ? '' : (loader || '').toLowerCase());
    } else {
      setMcVersion('');
      setLoaderType('');
    }

    setOffset(0);
    setResults([]);
    setTimeout(() => {
      void executeSearch(0, false);
    }, 50);
  };

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || isLoadingMore || results.length === 0) return;

    const nextOffset = offset + 20;
    setOffset(nextOffset);
    void executeSearch(nextOffset, true);
  }, [executeSearch, hasMore, isLoading, isLoadingMore, offset, results.length]);

  return {
    activeTab,
    setActiveTab,
    query,
    setQuery,
    mcVersion,
    setMcVersion,
    loaderType,
    setLoaderType,
    category,
    setCategory,
    sort,
    setSort,
    source,
    setSource,
    results,
    hasMore,
    isLoading,
    isLoadingMore,
    instanceConfig,
    isEnvLoaded,
    installedMods,
    mcVersionOptions,
    categoryOptions,
    isCurseForgeAvailable: hasCurseForgeApiKey(),
    handleSearchClick,
    handleResetClick,
    loadMore
  };
};
