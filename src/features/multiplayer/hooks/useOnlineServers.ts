import { useCallback, useEffect, useState } from 'react';
import type { AdSlot, OnlineServer } from '../types';
import { extractAds, extractServers, DEFAULT_AD_SLOTS } from '../utils';

const ONLINE_SERVERS_API_URL = import.meta.env.VITE_ONLINE_SERVERS_API_URL?.trim() || '';

export const useOnlineServers = () => {
  const [servers, setServers] = useState<OnlineServer[]>([]);
  const [adSlots, setAdSlots] = useState<AdSlot[]>(DEFAULT_AD_SLOTS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchServers = useCallback(async (signal?: AbortSignal) => {
    if (!ONLINE_SERVERS_API_URL) {
      setServers([]);
      setAdSlots(DEFAULT_AD_SLOTS);
      setError('未配置 VITE_ONLINE_SERVERS_API_URL，当前无法拉取在线服务器列表。');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(ONLINE_SERVERS_API_URL, {
        signal,
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      setServers(extractServers(payload));
      setAdSlots(extractAds(payload));
      setLastUpdated(new Date().toISOString());
    } catch (fetchError) {
      if ((fetchError as Error).name === 'AbortError') {
        return;
      }

      console.error('在线服务器列表加载失败:', fetchError);
      setServers([]);
      setAdSlots(DEFAULT_AD_SLOTS);
      setError(`在线服务器接口请求失败：${String(fetchError)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchServers(controller.signal);
    return () => controller.abort();
  }, [fetchServers]);

  return {
    servers,
    adSlots,
    isLoading,
    error,
    lastUpdated,
    fetchServers,
    apiUrl: ONLINE_SERVERS_API_URL
  };
};
