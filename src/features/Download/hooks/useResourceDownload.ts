// /src/features/Download/hooks/useResourceDownload.ts
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { searchModrinth, type ModrinthProject } from '../../InstanceDetail/logic/modrinthApi';
import { modService, type ModMeta } from '../../InstanceDetail/logic/modService';

export type TabType = 'mod' | 'resourcepack' | 'shader';

export const useResourceDownload = (instanceId?: string | null) => {
  const [activeTab, setActiveTab] = useState<TabType>('mod');
  
  // 核心环境状态
  const [instanceConfig, setInstanceConfig] = useState<any>(null);
  const [isEnvLoaded, setIsEnvLoaded] = useState(false); // ✅ 修复卡死Bug的核心开关
  const [installedMods, setInstalledMods] = useState<ModMeta[]>([]);
  
  // 筛选器状态
  const [query, setQuery] = useState('');
  const [mcVersion, setMcVersion] = useState('');
  const [loaderType, setLoaderType] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<'relevance' | 'downloads' | 'updated'>('relevance');
  const [source, setSource] = useState('modrinth');

  // 列表状态
  const [results, setResults] = useState<ModrinthProject[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 1. 安全初始化环境
  useEffect(() => {
    const initEnv = async () => {
      if (!instanceId) {
        setIsEnvLoaded(true); // 如果没有实例ID，直接放行，不锁死页面
        return;
      }
      try {
        const config = await invoke<any>('get_instance_detail', { id: instanceId });
        const safeConfig = config || {};
        setInstanceConfig(safeConfig);
        
        const gameVer = safeConfig.game_version || safeConfig.gameVersion || '';
        const loader = safeConfig.loader_type || safeConfig.loaderType || '';
        setMcVersion(gameVer);
        setLoaderType((loader || '').toLowerCase() === 'vanilla' ? '' : loader);

        const mods = await modService.getMods(instanceId);
        setInstalledMods(mods || []);
      } catch (err) {
        console.error('获取环境失败:', err);
      } finally {
        setIsEnvLoaded(true); // ✅ 无论成功与否，必定放行
      }
    };
    initEnv();
  }, [instanceId]);

  // 2. 核心搜索逻辑
  const executeSearch = useCallback(async (currentOffset: number, isLoadMore = false) => {
    if (!isEnvLoaded) return;
    if (isLoadMore) setIsLoadingMore(true);
    else setIsLoading(true);

    try {
      const data = await searchModrinth({
        query, category, sort, projectType: activeTab,
        version: mcVersion || undefined, 
        loader: loaderType || undefined,
        offset: currentOffset, 
        limit: 20
      });

      if (isLoadMore) setResults(prev => [...prev, ...data.hits]);
      else setResults(data.hits);
      
      setHasMore(currentOffset + data.hits.length < data.total_hits);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsLoading(false); 
      setIsLoadingMore(false); 
    }
  }, [query, category, sort, activeTab, mcVersion, loaderType, source, isEnvLoaded]);

  // 当选项卡切换，或环境刚加载完成时，自动触发首页搜索
  useEffect(() => {
    if (isEnvLoaded) {
      setOffset(0);
      executeSearch(0, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isEnvLoaded]);

  // 动作分发
  const handleSearchClick = () => { setOffset(0); executeSearch(0, false); };
  
  const handleResetClick = () => {
    setQuery(''); setCategory(''); setSort('relevance'); setSource('modrinth');
    if (instanceConfig) {
      const gameVer = instanceConfig.game_version || instanceConfig.gameVersion || '';
      const loader = instanceConfig.loader_type || instanceConfig.loaderType || '';
      setMcVersion(gameVer);
      setLoaderType((loader || '').toLowerCase() === 'vanilla' ? '' : loader);
    } else {
      setMcVersion(''); setLoaderType('');
    }
    setOffset(0);
    setResults([]);
    setTimeout(() => executeSearch(0, false), 50);
  };

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading && !isLoadingMore && results.length > 0) {
      setOffset(prev => prev + 20);
    }
  }, [hasMore, isLoading, isLoadingMore, results.length]);

  useEffect(() => {
    if (offset > 0) executeSearch(offset, true);
  }, [offset, executeSearch]);

  return {
    activeTab, setActiveTab,
    query, setQuery, mcVersion, setMcVersion, loaderType, setLoaderType,
    category, setCategory, sort, setSort, source, setSource,
    results, hasMore, isLoading, isLoadingMore,
    instanceConfig, isEnvLoaded, installedMods,
    handleSearchClick, handleResetClick, loadMore
  };
};