import { useCallback, useEffect, useMemo, useState } from 'react';
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
  tags?: string[];
  isFavorite?: boolean;
  createdAt: string;
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
      tags: item.tags,
      isFavorite: item.is_favorite,
      createdAt: item.created_at,
    };
  });

export type SortType = 'lastPlayed' | 'createdAt';

export const useInstances = () => {
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortType>('lastPlayed');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

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

  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    instances.forEach((inst) => {
      inst.tags?.forEach((tag) => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
  }, [instances]);

  const filteredInstances = useMemo(() => {
    let result = instances;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (inst) =>
          inst.name.toLowerCase().includes(lowerQuery) ||
          inst.version.toLowerCase().includes(lowerQuery) ||
          inst.loader.toLowerCase().includes(lowerQuery)
      );
    }

    if (selectedTags.length > 0) {
      result = result.filter((inst) => {
        const instTags = inst.tags || [];
        return selectedTags.some((tag) => instTags.includes(tag));
      });
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'createdAt') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        const parseLastPlayed = (val: string) => {
          if (!val || val === 'never' || val === 'Never played' || val === '') return 0;
          return new Date(val).getTime();
        };
        return parseLastPlayed(b.lastPlayed) - parseLastPlayed(a.lastPlayed);
      }
    });

    return result;
  }, [instances, searchQuery, sortBy, selectedTags]);

  return {
    instances,
    filteredInstances,
    availableTags,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    selectedTags,
    setSelectedTags,
    loadInstances,
    handleCreate,
    handleEdit,
    handleCardClick,
  };
};
