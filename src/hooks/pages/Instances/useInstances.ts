import { useCallback, useEffect, useState } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';

import { useLauncherStore } from '../../../store/useLauncherStore';

import defaultImg1 from '../../../assets/instances/default-1.jpg';
import defaultImg2 from '../../../assets/instances/default-2.jpg';
import defaultImg3 from '../../../assets/instances/default-3.png';

const DEFAULT_IMAGES = [defaultImg1, defaultImg2, defaultImg3];

export interface InstanceItem {
  id: string;
  name: string;
  version: string;
  loader: string;
  playTime: number;
  lastPlayed: string;
  coverUrl: string;
}

const formatInstances = (data: any[]): InstanceItem[] =>
  data.map((item) => {
    let finalCoverUrl = '';

    if (item.cover_path) {
      finalCoverUrl = convertFileSrc(item.cover_path);
    } else {
      const hash = item.id
        .split('')
        .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
      finalCoverUrl = DEFAULT_IMAGES[hash % DEFAULT_IMAGES.length];
    }

    return {
      id: item.id,
      name: item.name,
      version: item.version,
      loader: item.loader,
      playTime: item.play_time,
      lastPlayed: item.last_played,
      coverUrl: finalCoverUrl,
    };
  });

export const useInstances = () => {
  const [instances, setInstances] = useState<InstanceItem[]>([]);

  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const setSelectedInstanceId = useLauncherStore((state) => state.setSelectedInstanceId);

  const loadInstances = useCallback(async () => {
    try {
      const data = await invoke<any[]>('get_all_instances');
      setInstances(formatInstances(data));
    } catch (error) {
      console.error('加载实例列表失败:', error);
    }
  }, []);

  useEffect(() => {
    void loadInstances();
  }, [loadInstances]);

  const handleCreate = () => {
    setActiveTab('new-instance');
  };

  const handleEdit = (id: string) => {
    setSelectedInstanceId(id);
    setActiveTab('instance-detail');
  };

  const handleCardClick = (id: string) => {
    setSelectedInstanceId(id);
    setActiveTab('instance-detail');
  };

  return {
    instances,
    loadInstances,
    handleCreate,
    handleEdit,
    handleCardClick,
  };
};
