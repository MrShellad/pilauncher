import { useState, useCallback, useRef } from 'react';
import type { SignalingServer } from '../types';
import { usePiHubSession } from './usePiHubSession';
import { measureWebSocketLatency } from '../utils';

export function useSignalingServers() {
  const session = usePiHubSession();
  const [servers, setServers] = useState<SignalingServer[]>([]);
  const [isLoadingServers, setIsLoadingServers] = useState(false);
  const fetchedRef = useRef(false);

  const fetchServers = useCallback(async () => {
    if (session.lifecycle !== 'ready' || fetchedRef.current) return;
    
    setIsLoadingServers(true);
    fetchedRef.current = true;
    
    try {
      const config = await session.getSignalingServers();
      const rawServers = config.servers || [];
      
      const measuredServers = await Promise.all(
        rawServers.map(async (server) => {
          const latency = await measureWebSocketLatency(server.url, 2500);
          return { ...server, measuredLatencyMs: latency };
        })
      );
      
      setServers(measuredServers);
    } catch (e: any) {
      console.warn('获取信令服务器失败:', e.message);
    } finally {
      setIsLoadingServers(false);
    }
  }, [session]);

  const resetFetchState = useCallback(() => {
    // Allows refetching if session restarts
    fetchedRef.current = false;
  }, []);

  return { servers, isLoadingServers, fetchServers, resetFetchState };
}
