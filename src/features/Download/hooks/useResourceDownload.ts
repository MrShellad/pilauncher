import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import mcvData from '../../../assets/download/mcv.json';
import { searchModrinth, type ModrinthProject } from '../../InstanceDetail/logic/modrinthApi';
import { modService, InstalledModIndex, type ModMeta } from '../../InstanceDetail/logic/modService';
import {
  getBundledDownloadCategoryOptions,
  getSharedDownloadCategoryOptions
} from '../logic/downloadFilterConfig';
import {
  getCachedCurseForgeCategories,
  getCachedCurseForgeMinecraftVersions,
  hasCurseForgeApiKey,
  searchCurseForge,
  type CurseForgeCategoryOption
} from '../logic/curseforgeApi';
import { getCachedModrinthCategories } from '../logic/modrinthTags';

export type TabType = 'mod' | 'resourcepack' | 'shader' | 'modpack';
export type DownloadSource = 'modrinth' | 'curseforge';

export interface FilterOption {
  label: string;
  value: string;
  slug?: string;
  translationKey?: string;
  defaultLabel?: string;
  labels?: Record<string, string>;
}

export interface DownloadInstanceConfig {
  game_version?: string;
  gameVersion?: string;
  mcVersion?: string;
  loader_type?: string;
  loaderType?: string;
  loader?: {
    type?: string;
  };
  [key: string]: unknown;
}

interface UseResourceDownloadOptions {
  lockInstanceEnvironment?: boolean;
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

const INITIAL_INSTALLED_SCAN_DELAY_MS = 120;
const METADATA_LOAD_DELAY_MS = 180;
const INITIAL_SEARCH_DELAY_MS = 40;
const RESOURCE_REFRESH_DELAY_MS = 700;
const RESOURCE_DONE_DEDUPE_MS = 2000;

interface ResourceDownloadProgressPayload {
  task_id?: string;
  file_name?: string;
  stage?: string;
  current?: number;
  total?: number;
}

const getDefaultVersions = (): FilterOption[] => FALLBACK_MC_VERSIONS.map((version) => ({ label: version, value: version }));

export const resolveInstanceGameVersion = (config: DownloadInstanceConfig | null | undefined) =>
  String(config?.game_version || config?.gameVersion || config?.mcVersion || '');

export const resolveInstanceLoaderType = (config: DownloadInstanceConfig | null | undefined) => {
  const raw = String(config?.loader_type || config?.loaderType || config?.loader?.type || '').toLowerCase();
  return raw === 'vanilla' ? '' : raw;
};

const getResourceProgressKey = (payload: ResourceDownloadProgressPayload | null | undefined) =>
  String(payload?.task_id || payload?.file_name || '').trim();

const isCompletedResourceDownload = (payload: ResourceDownloadProgressPayload | null | undefined) => {
  const key = getResourceProgressKey(payload);
  if (!key || key === 'java_download') return false;

  return payload?.stage === 'DONE'
    || (
      typeof payload?.current === 'number'
      && typeof payload?.total === 'number'
      && payload.total > 0
      && payload.current >= payload.total
    );
};

export const useResourceDownload = (
  instanceId?: string | null,
  options: UseResourceDownloadOptions = {}
) => {
  const { lockInstanceEnvironment = false } = options;
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
  const [categoryOptions, setCategoryOptions] = useState<FilterOption[]>(() => getBundledDownloadCategoryOptions('mod'));

  const [isLoading, setIsLoading] = useState(!isCacheValid);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const isFirstMount = useRef(true);
  const resolvedInstanceMcVersion = resolveInstanceGameVersion(instanceConfig);
  const resolvedInstanceLoaderType = resolveInstanceLoaderType(instanceConfig);
  const effectiveMcVersion = lockInstanceEnvironment && resolvedInstanceMcVersion
    ? resolvedInstanceMcVersion
    : mcVersion;
  const effectiveLoaderType = activeTab === 'mod'
    ? (lockInstanceEnvironment && resolvedInstanceLoaderType ? resolvedInstanceLoaderType : loaderType)
    : '';

  const refreshInstalledMods = useCallback(async () => {
    if (!instanceId) {
      setInstalledMods([]);
      return;
    }

    try {
      const mods = await modService.getMods(instanceId);
      setInstalledMods(mods || []);
    } catch {
      setInstalledMods([]);
    }
  }, [instanceId]);

  useEffect(() => {
    let cancelled = false;
    let installedScanTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleInstalledScan = () => {
      if (!instanceId) return;

      installedScanTimer = setTimeout(async () => {
        try {
          const mods = await modService.getMods(instanceId);
          if (!cancelled) setInstalledMods(mods || []);
        } catch {
          if (!cancelled) setInstalledMods([]);
        }
      }, INITIAL_INSTALLED_SCAN_DELAY_MS);
    };

    const initEnv = async () => {
      if (!instanceId) {
        setInstalledMods([]);
        setIsEnvLoaded(true);
        return;
      }

      if (isCacheValid) {
        setIsEnvLoaded(true);
        scheduleInstalledScan();
        return;
      }

      try {
        const config = await invoke<DownloadInstanceConfig>('get_instance_detail', { id: instanceId });
        if (cancelled) return;

        const safeConfig = config || {};
        setInstanceConfig(safeConfig);

        setMcVersion(resolveInstanceGameVersion(safeConfig));
        setLoaderType(resolveInstanceLoaderType(safeConfig));
      } catch (error) {
        console.error('获取实例环境失败:', error);
      } finally {
        if (!cancelled) {
          setIsEnvLoaded(true);
          scheduleInstalledScan();
        }
      }
    };

    void initEnv();

    return () => {
      cancelled = true;
      if (installedScanTimer) clearTimeout(installedScanTimer);
    };
  }, [instanceId, isCacheValid]);

  useEffect(() => {
    if (!instanceId) return;

    let disposed = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let isRefreshing = false;
    let refreshAgain = false;
    let lastDoneKey = '';
    let lastDoneAt = 0;

    const runRefresh = async () => {
      if (disposed) return;

      if (isRefreshing) {
        refreshAgain = true;
        return;
      }

      isRefreshing = true;
      try {
        await refreshInstalledMods();
      } finally {
        isRefreshing = false;
        if (refreshAgain && !disposed) {
          refreshAgain = false;
          scheduleRefresh();
        }
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void runRefresh();
      }, RESOURCE_REFRESH_DELAY_MS);
    };

    const unlistenPromise = listen<ResourceDownloadProgressPayload>('resource-download-progress', (event) => {
      const payload = event.payload;
      if (!isCompletedResourceDownload(payload)) return;

      const doneKey = getResourceProgressKey(payload);
      const now = Date.now();
      if (doneKey === lastDoneKey && now - lastDoneAt < RESOURCE_DONE_DEDUPE_MS) return;

      lastDoneKey = doneKey;
      lastDoneAt = now;
      scheduleRefresh();
    });

    return () => {
      disposed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [instanceId, refreshInstalledMods]);

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
          setMcVersionOptions(getDefaultVersions());
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

  useEffect(() => {
    if (!lockInstanceEnvironment || !instanceConfig) return;

    const nextMcVersion = resolveInstanceGameVersion(instanceConfig);
    const nextLoaderType = resolveInstanceLoaderType(instanceConfig);

    if (nextMcVersion && mcVersion !== nextMcVersion) {
      setMcVersion(nextMcVersion);
    }

    if (activeTab === 'mod' && loaderType !== nextLoaderType) {
      setLoaderType(nextLoaderType);
    }
  }, [activeTab, instanceConfig, loaderType, lockInstanceEnvironment, mcVersion]);

  useEffect(() => {
    if (!category) return;
    const validValues = new Set(categoryOptions.map((item) => item.value));
    if (!validValues.has(category)) setCategory('');
  }, [category, categoryOptions]);

  useEffect(() => {
    if (!mcVersion || lockInstanceEnvironment) return;
    const validValues = new Set(mcVersionOptions.map((item) => item.value));
    if (!validValues.has(mcVersion) && source === 'curseforge') setMcVersion('');
  }, [lockInstanceEnvironment, mcVersion, mcVersionOptions, source]);

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
            version: effectiveMcVersion || undefined,
            loader: activeTab === 'mod' ? effectiveLoaderType || undefined : undefined,
            offset: currentOffset,
            limit: 20
          })
        : await searchModrinth({
            query,
            category,
            sort: sort as 'relevance' | 'downloads' | 'updated' | 'newest',
            projectType: activeTab,
            version: effectiveMcVersion || undefined,
            loader: activeTab === 'mod' ? effectiveLoaderType || undefined : undefined,
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
  }, [activeTab, category, effectiveLoaderType, effectiveMcVersion, isEnvLoaded, query, sort, source]);

  useEffect(() => {
    if (!isEnvLoaded) return;

    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (isCacheValid) return;
    }

    setOffset(0);
    const searchTimer = setTimeout(() => {
      void executeSearch(0, false);
    }, INITIAL_SEARCH_DELAY_MS);

    return () => clearTimeout(searchTimer);
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
      setMcVersion(resolveInstanceGameVersion(instanceConfig));
      setLoaderType(resolveInstanceLoaderType(instanceConfig));
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

  const installedModIndex = useMemo(() => new InstalledModIndex(installedMods), [installedMods]);

  return {
    activeTab,
    setActiveTab,
    query,
    setQuery,
    mcVersion,
    setMcVersion,
    loaderType,
    setLoaderType,
    resolvedMcVersion: effectiveMcVersion,
    resolvedLoaderType: effectiveLoaderType,
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
    installedModIndex,
    refreshInstalledMods,
    mcVersionOptions,
    categoryOptions,
    isCurseForgeAvailable: hasCurseForgeApiKey(),
    handleSearchClick,
    handleResetClick,
    loadMore
  };
};
