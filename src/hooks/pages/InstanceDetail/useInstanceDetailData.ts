import { useEffect, useState } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';

import { useLauncherStore } from '../../../store/useLauncherStore';
import { useToastStore } from '../../../store/useToastStore';
import type { InstanceDetailData, ServerBindingInfo } from './useInstanceDetail';

interface InstanceBindingState {
  serverBinding?: ServerBindingInfo;
  autoJoinServer: boolean;
}

interface RawInstanceDetail {
  name?: string;
  description?: string;
  cover_absolute_path?: string;
  game_version?: string;
  gameVersion?: string;
  mcVersion?: string;
  loader_type?: string;
  loader_version?: string;
  loaderType?: string;
  loader?: { type?: string; version?: string };
  playTime?: string | number;
  play_time?: string | number;
  lastPlayed?: string;
  last_played?: string;
  custom_buttons?: InstanceDetailData['customButtons'];
  server_binding?: ServerBindingInfo;
  auto_join_server?: boolean;
  tags?: string[];
}

export const useInstanceDetailData = (instanceId: string, activeTab: string) => {
  const { t } = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
  const setMainTab = useLauncherStore((state) => state.setActiveTab);

  const [data, setData] = useState<InstanceDetailData | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const [heroLogoUrl, setHeroLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const fetchDetail = async () => {
      try {
        setIsInitializing(true);

        const [realData, bindingState, screenshotsRaw] = await Promise.all([
          invoke<RawInstanceDetail>('get_instance_detail', { id: instanceId }),
          invoke<InstanceBindingState>('get_instance_server_binding', { id: instanceId }).catch(() => ({
            serverBinding: undefined,
            autoJoinServer: false,
          })),
          invoke<string[]>('get_instance_screenshots', { id: instanceId }).catch(() => []),
        ]);

        const coverUrl = realData.cover_absolute_path
          ? `${convertFileSrc(realData.cover_absolute_path)}?t=${Date.now()}`
          : '';
        const screenshots = screenshotsRaw.map((path) => `${convertFileSrc(path)}?t=${Date.now()}`);
        const playTimeRaw = realData.playTime ?? realData.play_time;
        const playTime = typeof playTimeRaw === 'number'
          ? playTimeRaw
          : typeof playTimeRaw === 'string'
            ? ((/小时|h/i.test(playTimeRaw) ? 3600 : 1) * (parseFloat(playTimeRaw) || 0))
            : 0;

        if (disposed) return;

        setData({
          id: instanceId,
          name: realData.name || instanceId,
          description: realData.description || '这个实例还没有描述。',
          coverUrl,
          screenshots,
          version: realData.game_version || realData.gameVersion || realData.mcVersion || '',
          loader: realData.loader?.type || realData.loader_type || realData.loaderType || 'Vanilla',
          loaderVersion: realData.loader?.version || realData.loader_version || '',
          playTime,
          lastPlayed: realData.lastPlayed || realData.last_played || '',
          customButtons: realData.custom_buttons || [],
          serverBinding: bindingState.serverBinding || undefined,
          autoJoinServer: bindingState.autoJoinServer,
          tags: realData.tags || [],
        });

        const heroAbs = await invoke<string | null>('get_instance_herologo', { id: instanceId }).catch(
          () => null
        );
        if (!disposed) {
          setHeroLogoUrl(heroAbs ? `${convertFileSrc(heroAbs)}?t=${Date.now()}` : null);
        }
      } catch (error) {
        if (disposed) return;
        console.error('Failed to load instance detail:', error);
        addToast('warning', t('home.selectedInstanceDeleted', 'Selected instance no longer exists.'));
        setMainTab('home');
      } finally {
        if (!disposed) setIsInitializing(false);
      }
    };

    setCurrentImageIndex(0);
    void fetchDetail();

    return () => {
      disposed = true;
    };
  }, [addToast, instanceId, setMainTab, t]);

  useEffect(() => {
    if (!data || data.screenshots.length <= 1 || activeTab !== 'overview') return;

    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % data.screenshots.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [activeTab, data]);

  return {
    data,
    setData,
    isInitializing,
    currentImageIndex,
    heroLogoUrl,
    setHeroLogoUrl,
  };
};
