import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  hasCurseForgeApiKey,
  searchCurseForge,
  searchModrinth,
  type DownloadSource,
  type ModrinthProject,
  type TabType
} from '@/features/resource-catalog';
import { InstalledModIndex } from '@/features/instance-resources';
import {
  resolveInstanceGameVersion,
  resolveInstanceLoaderType,
  useResourceDownloadEnvironment,
  type DownloadInstanceConfig
} from './useResourceDownloadEnvironment';
import { useResourceDownloadMetadata } from './useResourceDownloadMetadata';
export type { DownloadSource, FilterOption, TabType } from '@/features/resource-catalog';
export type { DownloadInstanceConfig } from './useResourceDownloadEnvironment';
export { resolveInstanceGameVersion, resolveInstanceLoaderType } from './useResourceDownloadEnvironment';

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

let globalCache: DownloadCache | null = null;

const INITIAL_SEARCH_DELAY_MS = 40;

export const useResourceDownload = (
  instanceId?: string | null,
  options: UseResourceDownloadOptions = {}
) => {
  const { lockInstanceEnvironment = false } = options;
  const isCacheValid = Boolean(instanceId && globalCache?.instanceId === instanceId);

  const [activeTab, setActiveTab] = useState<TabType>(() => (isCacheValid ? globalCache!.activeTab : 'mod'));

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

  const [isLoading, setIsLoading] = useState(!isCacheValid);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  const {
    instanceConfig,
    isEnvLoaded,
    installedMods,
    refreshInstalledMods
  } = useResourceDownloadEnvironment({
    instanceId,
    isCacheValid,
    cachedInstanceConfig: isCacheValid ? globalCache!.instanceConfig : null,
    setMcVersion,
    setLoaderType
  });
  const { mcVersionOptions, categoryOptions } = useResourceDownloadMetadata({
    activeTab,
    isEnvLoaded,
    source
  });

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

  useEffect(() => {
    if (!lockInstanceEnvironment || !instanceConfig) return;

    const nextMcVersion = resolveInstanceGameVersion(instanceConfig);
    const nextLoaderType = resolveInstanceLoaderType(instanceConfig);

    if (nextMcVersion && mcVersion !== nextMcVersion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMcVersion(nextMcVersion);
    }

    if (activeTab === 'mod' && loaderType !== nextLoaderType) {
      setLoaderType(nextLoaderType);
    }
  }, [activeTab, instanceConfig, loaderType, lockInstanceEnvironment, mcVersion]);

  useEffect(() => {
    if (!category) return;
    const validValues = new Set(categoryOptions.map((item) => item.value));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!validValues.has(category)) setCategory('');
  }, [category, categoryOptions]);

  useEffect(() => {
    if (!mcVersion || lockInstanceEnvironment) return;
    const validValues = new Set(mcVersionOptions.map((item) => item.value));
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
