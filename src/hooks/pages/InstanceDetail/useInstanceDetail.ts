import { useEffect, useState } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { ask, open } from '@tauri-apps/plugin-dialog';

export type DetailTab = 'overview' | 'basic' | 'java' | 'saves' | 'mods' | 'resourcepacks' | 'shaders' | 'export';

export interface InstanceDetailData {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  screenshots: string[];
  version?: string;
  loader?: string;
  playTime?: string;
  lastPlayed?: string;
}

interface RawInstanceDetail {
  name?: string;
  description?: string;
  cover_absolute_path?: string;
  game_version?: string;
  gameVersion?: string;
  mcVersion?: string;
  loader_type?: string;
  loaderType?: string;
  loader?: { type?: string };
  playTime?: string | number;
  play_time?: string | number;
  lastPlayed?: string;
  last_played?: string;
}

export const useInstanceDetail = (instanceId: string) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [data, setData] = useState<InstanceDetailData | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setIsInitializing(true);

        const [realData, screenshotsRaw] = await Promise.all([
          invoke<RawInstanceDetail>('get_instance_detail', { id: instanceId }),
          invoke<string[]>('get_instance_screenshots', { id: instanceId }).catch(() => [])
        ]);

        const coverUrl = realData.cover_absolute_path
          ? `${convertFileSrc(realData.cover_absolute_path)}?t=${Date.now()}`
          : '';

        const screenshots = screenshotsRaw.map((path) => `${convertFileSrc(path)}?t=${Date.now()}`);

        const playTime = typeof realData.playTime === 'string'
          ? realData.playTime
          : typeof realData.play_time === 'string'
            ? realData.play_time
            : typeof realData.playTime === 'number'
              ? `${realData.playTime} 小时`
              : typeof realData.play_time === 'number'
                ? `${realData.play_time} 小时`
                : '';

        setData({
          id: instanceId,
          name: realData.name || instanceId,
          description: realData.description || '这个实例还没有添加任何描述。',
          coverUrl,
          screenshots,
          version: realData.game_version || realData.gameVersion || realData.mcVersion || '',
          loader: realData.loader?.type || realData.loader_type || realData.loaderType || 'Vanilla',
          playTime,
          lastPlayed: realData.lastPlayed || realData.last_played || ''
        });
      } catch (error) {
        console.error('获取实例详情失败:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    fetchDetail();
  }, [instanceId]);

  useEffect(() => {
    if (!data || data.screenshots.length <= 1 || activeTab !== 'overview') return;

    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % data.screenshots.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [data, activeTab]);

  const handlePlay = () => console.log(`启动实例: ${data?.name}`);

  const handleOpenFolder = async () => {
    try {
      await invoke('open_instance_folder', { id: instanceId });
    } catch (error) {
      console.error('打开实例目录失败:', error);
    }
  };

  const handleUpdateName = async (newName: string) => {
    await invoke('rename_instance', { id: instanceId, newName });
    setData((prev) => (prev ? { ...prev, name: newName } : null));
  };

  const handleUpdateCover = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      title: '选择实例封面图'
    });

    if (selected && typeof selected === 'string') {
      const newAbsPath = await invoke<string>('change_instance_cover', { id: instanceId, imagePath: selected });
      const assetUrl = `${convertFileSrc(newAbsPath)}?t=${Date.now()}`;
      setData((prev) => (prev ? { ...prev, coverUrl: assetUrl } : null));
      return;
    }

    throw new Error('USER_CANCELED');
  };

  const handleVerifyFiles = async () => {
    console.log(`调用 Rust 校验并补全实例 ${instanceId} 的文件`);
  };

  const handleDeleteInstance = async (): Promise<boolean> => {
    const confirmed = await ask(
      '确定要彻底删除该实例吗？\n该操作不可逆转，所有存档和 MOD 将被永久清除。',
      {
        title: '危险操作确认',
        kind: 'warning'
      }
    );

    if (!confirmed) return false;

    await invoke('delete_instance', { id: instanceId });
    return true;
  };

  return {
    activeTab,
    setActiveTab,
    data,
    isInitializing,
    currentImageIndex,
    handlePlay,
    handleOpenFolder,
    handleUpdateName,
    handleUpdateCover,
    handleVerifyFiles,
    handleDeleteInstance
  };
};
