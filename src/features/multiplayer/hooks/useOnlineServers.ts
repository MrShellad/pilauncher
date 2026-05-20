import { useCallback, useEffect, useState, useRef } from 'react';
import type { AdSlot, OnlineServer } from '../types';
import { extractAds, extractServers, DEFAULT_AD_SLOTS } from '../utils';

const ONLINE_SERVERS_API_URL = import.meta.env.VITE_ONLINE_SERVERS_API_URL?.trim() || '';
const CACHE_KEY = 'pil_online_servers_cache';
const CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours

interface CachePayload {
  timestamp: number;
  lastUpdated: string;
  servers: any;
  ads: any;
}

export const useOnlineServers = () => {
  const [servers, setServers] = useState<OnlineServer[]>([]);
  const [adSlots, setAdSlots] = useState<AdSlot[]>(DEFAULT_AD_SLOTS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  
  const isInitialMount = useRef(true);

  const fetchServers = useCallback(async (options?: { force?: boolean, signal?: AbortSignal }) => {
    const { force = false, signal } = options || {};

    if (!ONLINE_SERVERS_API_URL) {
      setServers([]);
      setAdSlots(DEFAULT_AD_SLOTS);
      setError('未配置 VITE_ONLINE_SERVERS_API_URL，当前无法拉取在线服务器列表。');
      return;
    }

    // Attempt to load valid cache if not forcing refresh
    if (!force) {
      try {
        const cachedStr = localStorage.getItem(CACHE_KEY);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr) as CachePayload;
          if (Date.now() - cached.timestamp <= CACHE_TTL) {
            setServers(extractServers(cached.servers));
            setAdSlots(extractAds(cached.ads));
            setLastUpdated(cached.lastUpdated);
            return;
          }
        }
      } catch (err) {
        console.warn('解析本地服务器缓存失败:', err);
      }
    }

    setIsLoading(true);
    setError(null);
    // Notice: We DO NOT clear servers/adSlots here to prevent UI flicker for "Local Refresh"

    try {
      const response = await fetch(ONLINE_SERVERS_API_URL, {
        signal,
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json();
      const newServers = extractServers(payload);
      const newAds = extractAds(payload);
      const newDate = new Date().toISOString();

      setServers(newServers);
      setAdSlots(newAds);
      setLastUpdated(newDate);

      // Save to cache
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        lastUpdated: newDate,
        servers: payload,
        ads: payload
      }));
    } catch (fetchError) {
      if ((fetchError as Error).name === 'AbortError') return;

      console.error('在线服务器列表加载失败:', fetchError);

      // Implementation: Fallback to stale cache if available
      try {
        const cachedStr = localStorage.getItem(CACHE_KEY);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr) as CachePayload;
          setServers((prev) => prev.length > 0 ? prev : extractServers(cached.servers));
          setAdSlots((prev) => prev !== DEFAULT_AD_SLOTS ? prev : extractAds(cached.ads));
          setLastUpdated((prev) => prev || cached.lastUpdated);
          setError('网络连接失败，正在显示离线缓存数据。');
        } else {
          setError(`在线服务器接口请求失败：${String(fetchError)}`);
        }
      } catch (e) {
        setError(`在线服务器接口请求失败：${String(fetchError)}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Only perform automatic load on the first mount
    if (isInitialMount.current) {
      void fetchServers({ signal: controller.signal });
      isInitialMount.current = false;
    }
    return () => controller.abort();
  }, [fetchServers]);

  return {
    servers,
    adSlots,
    isLoading,
    error,
    lastUpdated,
    fetchServers,
  };
};
