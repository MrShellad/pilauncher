// /src/features/Download/hooks/useResourceDownload.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { searchModrinth, type ModrinthProject } from '../../InstanceDetail/logic/modrinthApi';
import { modService, type ModMeta } from '../../InstanceDetail/logic/modService';

export type TabType = 'mod' | 'resourcepack' | 'shader';

// ================= 定义缓存结构 =================
interface DownloadCache {
  instanceId: string;
  instanceConfig: any;
  activeTab: TabType;
  query: string;
  mcVersion: string;
  loaderType: string;
  category: string;
  sort: string;
  source: string;
  results: ModrinthProject[];
  offset: number;
  hasMore: boolean;
}

// ✅ 声明模块级内存缓存：随页面跳转保留，软件关闭即刻销毁
let globalCache: DownloadCache | null = null;

export const useResourceDownload = (instanceId?: string | null) => {
  // 1. 判断当前实例 ID 是否命中了我们刚才存下的缓存
  const isCacheValid = Boolean(instanceId && globalCache?.instanceId === instanceId);

  // 2. 将所有状态的初始值设置为：如果缓存有效则读取缓存，否则恢复默认值
  const [activeTab, setActiveTab] = useState<TabType>(() => isCacheValid ? globalCache!.activeTab : 'mod');
  const [instanceConfig, setInstanceConfig] = useState<any>(() => isCacheValid ? globalCache!.instanceConfig : null);
  const [isEnvLoaded, setIsEnvLoaded] = useState(() => isCacheValid);
  const [installedMods, setInstalledMods] = useState<ModMeta[]>([]);
  
  const [query, setQuery] = useState(() => isCacheValid ? globalCache!.query : '');
  const [mcVersion, setMcVersion] = useState(() => isCacheValid ? globalCache!.mcVersion : '');
  const [loaderType, setLoaderType] = useState(() => isCacheValid ? globalCache!.loaderType : '');
  const [category, setCategory] = useState(() => isCacheValid ? globalCache!.category : '');
  const [sort, setSort] = useState<any>(() => isCacheValid ? globalCache!.sort : 'relevance');
  const [source, setSource] = useState(() => isCacheValid ? globalCache!.source : 'modrinth');

  const [results, setResults] = useState<ModrinthProject[]>(() => isCacheValid ? globalCache!.results : []);
  const [offset, setOffset] = useState(() => isCacheValid ? globalCache!.offset : 0);
  const [hasMore, setHasMore] = useState(() => isCacheValid ? globalCache!.hasMore : true);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 使用 Ref 记录是否为第一次渲染，用于拦截初始化时的无效拉取
  const isFirstMount = useRef(true);

  // 3. 初始化环境
  useEffect(() => {
    const initEnv = async () => {
      if (!instanceId) {
        setIsEnvLoaded(true);
        return;
      }

      // ⚠️ 极其关键：无论是否命中缓存，【已安装的本地Mod列表】必须每次都去底层拉取一次最新的！
      // 否则用户如果在外边删除了某个 Mod 切回来，会显示错误的“已安装”状态。
      try {
        const mods = await modService.getMods(instanceId);
        setInstalledMods(mods || []);
      } catch (err) {
        setInstalledMods([]);
      }

      // 如果命中了缓存，就不需要再去 Rust 后端请求 instanceConfig 了
      if (isCacheValid) return; 

      try {
        const config = await invoke<any>('get_instance_detail', { id: instanceId });
        const safeConfig = config || {};
        setInstanceConfig(safeConfig);
        
        const gameVer = safeConfig.game_version || safeConfig.gameVersion || '';
        const loader = safeConfig.loader_type || safeConfig.loaderType || '';
        setMcVersion(gameVer);
        setLoaderType((loader || '').toLowerCase() === 'vanilla' ? '' : loader);
      } catch (err) {
        console.error('获取环境失败:', err);
      } finally {
        setIsEnvLoaded(true);
      }
    };
    initEnv();
  }, [instanceId, isCacheValid]);

  // 4. 核心搜索逻辑
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

  // 5. Tab 切换自动搜索拦截器
  useEffect(() => {
    if (isEnvLoaded) {
      // 检查是不是组件刚挂载
      if (isFirstMount.current) {
        isFirstMount.current = false;
        // ✅ 核心拦截：如果是带着缓存进来的第一次挂载，绝对静默！不发请求覆盖数据。
        if (isCacheValid) return; 
      }
      
      // 如果不是初次挂载（用户手动切了 Tab），或者是没缓存的全新挂载，则触发搜索
      setOffset(0);
      executeSearch(0, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isEnvLoaded]); // 注意：只依赖 activeTab，保证切换时刷新

  // 6. 实时同步快照到全局缓存
  useEffect(() => {
    if (instanceId && isEnvLoaded) {
      globalCache = {
        instanceId, instanceConfig, activeTab, query, mcVersion,
        loaderType, category, sort, source, results, offset, hasMore
      };
    }
  }, [instanceId, instanceConfig, activeTab, query, mcVersion, loaderType, category, sort, source, results, offset, hasMore, isEnvLoaded]);

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

  // ✅ 懒加载：直接计算 nextOffset 并发起请求，剔除了可能导致缓存状态错乱的监听器
  const loadMore = useCallback(() => {
    if (hasMore && !isLoading && !isLoadingMore && results.length > 0) {
      const nextOffset = offset + 20;
      setOffset(nextOffset);
      executeSearch(nextOffset, true);
    }
  }, [hasMore, isLoading, isLoadingMore, results.length, offset, executeSearch]);

  return {
    activeTab, setActiveTab,
    query, setQuery, mcVersion, setMcVersion, loaderType, setLoaderType,
    category, setCategory, sort, setSort, source, setSource,
    results, hasMore, isLoading, isLoadingMore,
    instanceConfig, isEnvLoaded, installedMods,
    handleSearchClick, handleResetClick, loadMore
  };
};