import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEvent } from '../../../hooks/useEvent';

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
import { getCachedModrinthCategories, getCachedModrinthMcVersions } from '../logic/modrinthTags';

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
  const [installedMods, setInstalledMods] = useState<ModMeta[]>(() => (
    instanceId ? modService.getManifestModsSnapshot(instanceId) ?? [] : []
  ));

  const [committedQuery, setCommittedQuery] = useState(() => (isCacheValid ? globalCache!.query : ''));
  const [localQuery, setLocalQuery] = useState(() => (isCacheValid ? globalCache!.query : ''));

  const setQuery = useCallback((newQuery: string, commit = false) => {
    setLocalQuery(newQuery);
    if (commit) {
      setCommittedQuery(newQuery);
    }
  }, []);
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
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  const isFirstMount = useRef(true);
  const isRestoringRef = useRef(false);
  const searchVersionRef = useRef(0);
  const resolvedInstanceMcVersion = resolveInstanceGameVersion(instanceConfig);
  const resolvedInstanceLoaderType = resolveInstanceLoaderType(instanceConfig);
  const effectiveMcVersion = lockInstanceEnvironment && resolvedInstanceMcVersion
    ? resolvedInstanceMcVersion
    : mcVersion;
  const effectiveLoaderType = activeTab === 'mod'
    ? (lockInstanceEnvironment && resolvedInstanceLoaderType ? resolvedInstanceLoaderType : loaderType)
    : '';

  const loadInstalledMods = useCallback(async (forceRefresh = false) => {
    if (!instanceId) {
      setInstalledMods([]);
      return;
    }

    try {
      const mods = await modService.getCachedModManifest(instanceId, forceRefresh);
      setInstalledMods(mods || []);
    } catch {
      setInstalledMods([]);
    }
  }, [instanceId]);

  const refreshInstalledMods = useCallback(async () => {
    await loadInstalledMods(true);
  }, [loadInstalledMods]);

  useEffect(() => {
    let cancelled = false;
    setInstalledMods(instanceId ? modService.getManifestModsSnapshot(instanceId) ?? [] : []);

    const loadInstalledManifest = async () => {
      if (!instanceId) return;
      try {
        const mods = await modService.getCachedModManifest(instanceId);
        if (!cancelled) setInstalledMods(mods || []);
      } catch {
        if (!cancelled) setInstalledMods([]);
      }
    };

    const initEnv = async () => {
      if (!instanceId) {
        setInstalledMods([]);
        setIsEnvLoaded(true);
        return;
      }

      if (isCacheValid) {
        setIsEnvLoaded(true);
        void loadInstalledManifest();
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
          void loadInstalledManifest();
        }
      }
    };

    void initEnv();

    return () => {
      cancelled = true;
    };
  }, [instanceId, isCacheValid]);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);
  const refreshAgainRef = useRef(false);
  const lastDoneKeyRef = useRef('');
  const lastDoneAtRef = useRef(0);

  const runRefresh = useCallback(async () => {
    if (isRefreshingRef.current) {
      refreshAgainRef.current = true;
      return;
    }

    isRefreshingRef.current = true;
    try {
      await refreshInstalledMods();
    } finally {
      isRefreshingRef.current = false;
      if (refreshAgainRef.current) {
        refreshAgainRef.current = false;
        scheduleRefresh();
      }
    }
  }, [refreshInstalledMods]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void runRefresh();
    }, RESOURCE_REFRESH_DELAY_MS);
  }, [runRefresh]);

  useEvent('resource-download-progress', (payload) => {
    if (!instanceId) return;
    if (!isCompletedResourceDownload(payload)) return;

    const doneKey = getResourceProgressKey(payload);
    const now = Date.now();
    if (doneKey === lastDoneKeyRef.current && now - lastDoneAtRef.current < RESOURCE_DONE_DEDUPE_MS) return;

    lastDoneKeyRef.current = doneKey;
    lastDoneAtRef.current = now;
    scheduleRefresh();
  });

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

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

  const executeSearch = useCallback(async (currentOffset: number, isLoadMore = false, queryOverride?: string) => {
    if (!isEnvLoaded) return;

    const currentSearchVersion = ++searchVersionRef.current;

    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setResults([]);
      setLoadMoreFailed(false);
    }

    const searchQuery = queryOverride !== undefined ? queryOverride : committedQuery;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = null;

      if (isLoadMore) {
        let success = false;
        let attempt = 0;
        const maxAttempts = 5;

        while (attempt < maxAttempts && !success) {
          if (currentSearchVersion !== searchVersionRef.current) return;

          try {
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('TIMEOUT')), 8000)
            );

            const fetchPromise = source === 'curseforge'
              ? searchCurseForge({
                  query: searchQuery,
                  category,
                  sort: sort as 'relevance' | 'downloads' | 'updated' | 'newest',
                  projectType: activeTab,
                  version: effectiveMcVersion || undefined,
                  loader: activeTab === 'mod' ? effectiveLoaderType || undefined : undefined,
                  offset: currentOffset,
                  limit: 20
                })
              : searchModrinth({
                  query: searchQuery,
                  category,
                  sort: sort as 'relevance' | 'downloads' | 'updated' | 'newest',
                  projectType: activeTab,
                  version: effectiveMcVersion || undefined,
                  loader: activeTab === 'mod' ? effectiveLoaderType || undefined : undefined,
                  offset: currentOffset,
                  limit: 20
                });

            data = await Promise.race([fetchPromise, timeoutPromise]);
            success = true;
          } catch (err) {
            attempt++;
            console.warn(`Load more attempt ${attempt} failed:`, err);
            if (attempt >= maxAttempts) {
              throw err;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      } else {
        if (currentSearchVersion !== searchVersionRef.current) return;

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), 8000)
        );

        const fetchPromise = source === 'curseforge'
          ? searchCurseForge({
              query: searchQuery,
              category,
              sort: sort as 'relevance' | 'downloads' | 'updated' | 'newest',
              projectType: activeTab,
              version: effectiveMcVersion || undefined,
              loader: activeTab === 'mod' ? effectiveLoaderType || undefined : undefined,
              offset: currentOffset,
              limit: 20
            })
          : searchModrinth({
              query: searchQuery,
              category,
              sort: sort as 'relevance' | 'downloads' | 'updated' | 'newest',
              projectType: activeTab,
              version: effectiveMcVersion || undefined,
              loader: activeTab === 'mod' ? effectiveLoaderType || undefined : undefined,
              offset: currentOffset,
              limit: 20
            });

        data = await Promise.race([fetchPromise, timeoutPromise]);
      }

      if (currentSearchVersion !== searchVersionRef.current) return;

      if (isLoadMore) setResults((prev) => [...prev, ...data.hits]);
      else setResults(data.hits);

      setHasMore(currentOffset + data.hits.length < data.total_hits);
    } catch (error) {
      if (currentSearchVersion !== searchVersionRef.current) return;
      console.error(error);
      if (!isLoadMore) {
        setResults([]);
        setHasMore(false);
      } else {
        setLoadMoreFailed(true);
      }
    } finally {
      if (currentSearchVersion === searchVersionRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [activeTab, category, effectiveLoaderType, effectiveMcVersion, isEnvLoaded, committedQuery, sort, source]);

  useEffect(() => {
    if (!isEnvLoaded) return;

    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (isCacheValid) return;
    }

    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }

    setOffset(0);
    setResults([]);
    setIsLoading(true);
    setHasMore(true);
    setLoadMoreFailed(false);

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
        query: committedQuery,
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
  }, [activeTab, category, hasMore, instanceConfig, instanceId, isEnvLoaded, loaderType, mcVersion, offset, committedQuery, results, sort, source]);

  const handleSearchClick = useCallback((customQuery?: string) => {
    const q = customQuery !== undefined ? customQuery : localQuery;
    setCommittedQuery(q);
    setOffset(0);
    void executeSearch(0, false, q);
  }, [localQuery, executeSearch]);

  const handleResetClick = () => {
    setLocalQuery('');
    setCommittedQuery('');
    setCategory('');
    setSort('relevance');
    setMcVersion('');
    setLoaderType('');

    setOffset(0);
    setResults([]);
    setTimeout(() => {
      void executeSearch(0, false, '');
    }, 50);
  };

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || isLoadingMore || results.length === 0 || loadMoreFailed) return;

    const nextOffset = offset + 20;
    setOffset(nextOffset);
    void executeSearch(nextOffset, true);
  }, [executeSearch, hasMore, isLoading, isLoadingMore, offset, results.length, loadMoreFailed]);

  const installedModIndex = useMemo(() => new InstalledModIndex(installedMods), [installedMods]);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setMcVersion('');
    setLoaderType('');
    setCategory('');
  }, []);

  const handleSourceChange = useCallback((newSource: DownloadSource) => {
    setSource(newSource);
    setCategory('');
  }, []);

  const restoreState = useCallback((
    newQuery: string,
    newCategory: string,
    newResults: ModrinthProject[],
    newOffset: number,
    newHasMore: boolean
  ) => {
    isRestoringRef.current = true;
    setLocalQuery(newQuery);
    setCommittedQuery(newQuery);
    setCategory(newCategory);
    setResults(newResults);
    setOffset(newOffset);
    setHasMore(newHasMore);
  }, []);

  const retryLoadMore = useCallback(() => {
    setLoadMoreFailed(false);
    void executeSearch(offset, true);
  }, [executeSearch, offset]);

  return {
    activeTab,
    setActiveTab: handleTabChange,
    query: localQuery,
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
    setSource: handleSourceChange,
    results,
    offset,
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
    loadMore,
    restoreState,
    loadMoreFailed,
    retryLoadMore
  };
};
