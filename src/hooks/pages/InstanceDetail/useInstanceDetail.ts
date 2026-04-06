import { useEffect, useState } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { ask, open } from '@tauri-apps/plugin-dialog';
import { useLauncherStore } from '../../../store/useLauncherStore';
import { useDownloadStore } from '../../../store/useDownloadStore';

export type DetailTab =
  | 'overview'
  | 'basic'
  | 'java'
  | 'saves'
  | 'mods'
  | 'resourcepacks'
  | 'shaders'
  | 'export';

export interface CustomButton {
  url: string;
  label?: string;
  type: string;
}

export interface ServerBindingInfo {
  uuid: string;
  name: string;
  ip: string;
  port: number;
}

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
  customButtons?: CustomButton[];
  serverBinding?: ServerBindingInfo;
  autoJoinServer?: boolean;
}

export interface MissingRuntime {
  instance_id: string;
  mc_version: string;
  loader_type: string;
  loader_version: string;
}

export interface VerifyInstanceRuntimeResult {
  instance_id: string;
  needs_repair: boolean;
  issues: string[];
  repair: MissingRuntime | null;
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
  custom_buttons?: CustomButton[];
  server_binding?: ServerBindingInfo;
  auto_join_server?: boolean;
}

export const useInstanceDetail = (instanceId: string) => {
  const activeTab = useLauncherStore((state) => state.instanceDetailTab) as DetailTab;
  const setActiveTab = useLauncherStore((state) => state.setInstanceDetailTab);
  const setMainTab = useLauncherStore((state) => state.setActiveTab);

  const [data, setData] = useState<InstanceDetailData | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const [heroLogoUrl, setHeroLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setIsInitializing(true);

        const [realData, screenshotsRaw] = await Promise.all([
          invoke<RawInstanceDetail>('get_instance_detail', { id: instanceId }),
          invoke<string[]>('get_instance_screenshots', { id: instanceId }).catch(() => []),
        ]);

        const coverUrl = realData.cover_absolute_path
          ? `${convertFileSrc(realData.cover_absolute_path)}?t=${Date.now()}`
          : '';
        const screenshots = screenshotsRaw.map((path) => `${convertFileSrc(path)}?t=${Date.now()}`);

        const playTime =
          typeof realData.playTime === 'string'
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
          description: realData.description || '这个实例还没有描述。',
          coverUrl,
          screenshots,
          version: realData.game_version || realData.gameVersion || realData.mcVersion || '',
          loader: realData.loader?.type || realData.loader_type || realData.loaderType || 'Vanilla',
          playTime,
          lastPlayed: realData.lastPlayed || realData.last_played || '',
          customButtons: realData.custom_buttons || [],
          serverBinding: realData.server_binding || undefined,
          autoJoinServer: realData.auto_join_server ?? true,
        });

        const heroAbs = await invoke<string | null>('get_instance_herologo', { id: instanceId }).catch(
          () => null
        );
        setHeroLogoUrl(heroAbs ? `${convertFileSrc(heroAbs)}?t=${Date.now()}` : null);
      } catch (error) {
        console.error('获取实例详情失败:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    void fetchDetail();
  }, [instanceId]);

  useEffect(() => {
    if (!data || data.screenshots.length <= 1 || activeTab !== 'overview') return;

    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % data.screenshots.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [data, activeTab]);

  const handlePlay = () => {
    console.log(`启动实例: ${data?.name}`);
  };

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
      title: '选择实例封面图',
    });

    if (selected && typeof selected === 'string') {
      const newAbsPath = await invoke<string>('change_instance_cover', {
        id: instanceId,
        imagePath: selected,
      });
      const assetUrl = `${convertFileSrc(newAbsPath)}?t=${Date.now()}`;
      setData((prev) => (prev ? { ...prev, coverUrl: assetUrl } : null));
      return;
    }

    throw new Error('USER_CANCELED');
  };

  const handleUpdateHeroLogo = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }],
      title: '选择自定义 Hero Logo',
    });

    if (selected && typeof selected === 'string') {
      const newAbsPath = await invoke<string>('change_instance_herologo', {
        id: instanceId,
        imagePath: selected,
      });
      setHeroLogoUrl(`${convertFileSrc(newAbsPath)}?t=${Date.now()}`);
      return;
    }

    throw new Error('USER_CANCELED');
  };

  const handleUpdateCustomButtons = async (customButtons: CustomButton[]) => {
    await invoke('update_instance_custom_buttons', { id: instanceId, customButtons });
    setData((prev) => (prev ? { ...prev, customButtons } : null));
  };

  const handleUpdateServerBinding = async (serverBinding: ServerBindingInfo | null) => {
    await invoke('update_instance_server_binding', { id: instanceId, serverBinding });
    setData((prev) => (prev ? { ...prev, serverBinding: serverBinding || undefined } : null));
  };

  const handleUpdateAutoJoinServer = async (autoJoin: boolean) => {
    await invoke('update_instance_auto_join_server', { id: instanceId, autoJoin });
    setData((prev) => (prev ? { ...prev, autoJoinServer: autoJoin } : null));
  };

  const handleVerifyFiles = async (): Promise<VerifyInstanceRuntimeResult> => {
    return invoke<VerifyInstanceRuntimeResult>('verify_instance_runtime', { instanceId });
  };

  const handleRepairRuntime = async (repair: MissingRuntime): Promise<void> => {
    setMainTab('home');
    useDownloadStore.getState().setPopupOpen(true);
    await invoke('download_missing_runtimes', { missingList: [repair] });
  };

  const handleDeleteInstance = async (skipConfirm = false): Promise<boolean> => {
    if (!skipConfirm) {
      const confirmed = await ask(
        '确定要彻底删除该实例吗？\n该操作不可逆，所有存档和 MOD 都会被永久清除。',
        {
          title: '危险操作确认',
          kind: 'warning',
        }
      );

      if (!confirmed) return false;
    }

    await invoke('delete_instance', { id: instanceId });
    return true;
  };

  return {
    activeTab,
    setActiveTab,
    data,
    isInitializing,
    currentImageIndex,
    heroLogoUrl,
    handlePlay,
    handleOpenFolder,
    handleUpdateName,
    handleUpdateCover,
    handleUpdateHeroLogo,
    handleUpdateCustomButtons,
    handleUpdateServerBinding,
    handleUpdateAutoJoinServer,
    handleVerifyFiles,
    handleRepairRuntime,
    handleDeleteInstance,
  };
};
