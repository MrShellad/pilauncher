import { useCallback, useEffect, useState } from 'react';
import { useLauncherStore } from '../../../store/useLauncherStore';
import { useGameLaunch } from '../../../hooks/useGameLaunch';
import { serverBindingService } from '../logic/serverBindingService';
import type { OnlineServer, ServerBindableInstance } from '../types';
import {
  createServerBindingRecord,
  getErrorMessage,
  isModdedServer,
  matchesServerBinding,
  resolveBoundInstance,
} from '../serverBindingUtils';

interface UseServerBindModalParams {
  isOpen: boolean;
  onClose: () => void;
  server: OnlineServer | null;
}

export const useServerBindModal = ({ isOpen, onClose, server }: UseServerBindModalParams) => {
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const { launchGame, isLaunching } = useGameLaunch();

  const [instances, setInstances] = useState<ServerBindableInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [boundInstance, setBoundInstance] = useState<ServerBindableInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBinding, setIsBinding] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCheckingBinding, setIsCheckingBinding] = useState(false);

  const resetState = useCallback(() => {
    setInstances([]);
    setSelectedInstanceId('');
    setBoundInstance(null);
    setIsLoading(false);
    setIsCheckingBinding(false);
  }, []);

  const fetchCompatibleInstances = useCallback(
    async (currentServer: OnlineServer, isCancelled: () => boolean) => {
      try {
        setIsLoading(true);

        const data = await serverBindingService.getCompatibleInstances(currentServer.versions || []);
        if (isCancelled()) {
          return;
        }

        setInstances(data);
        setSelectedInstanceId(data[0]?.id || '');
      } catch (error) {
        console.error('获取兼容实例失败:', error);
        if (isCancelled()) {
          return;
        }

        setInstances([]);
        setSelectedInstanceId('');
      } finally {
        if (!isCancelled()) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  const initializeModal = useCallback(
    async (currentServer: OnlineServer, isCancelled: () => boolean) => {
      try {
        setIsCheckingBinding(true);
        setIsLoading(false);
        setBoundInstance(null);
        setInstances([]);
        setSelectedInstanceId('');

        const [bindingsResult, allInstancesResult] = await Promise.allSettled([
          serverBindingService.getServerBindings(),
          serverBindingService.getAllInstances(),
        ]);

        if (isCancelled()) {
          return;
        }

        if (bindingsResult.status === 'rejected') {
          console.warn('读取服务器绑定失败:', bindingsResult.reason);
        }
        if (allInstancesResult.status === 'rejected') {
          console.warn('读取实例列表失败:', allInstancesResult.reason);
        }

        const bindings = bindingsResult.status === 'fulfilled' ? bindingsResult.value : {};
        const allInstances = allInstancesResult.status === 'fulfilled' ? allInstancesResult.value : [];

        const matchedBindingEntry = Object.entries(bindings).find(([, binding]) =>
          matchesServerBinding(currentServer, binding)
        );

        if (matchedBindingEntry) {
          const [instanceId] = matchedBindingEntry;
          setBoundInstance(resolveBoundInstance(instanceId, allInstances));
          return;
        }

        await fetchCompatibleInstances(currentServer, isCancelled);
      } finally {
        if (!isCancelled()) {
          setIsCheckingBinding(false);
        }
      }
    },
    [fetchCompatibleInstances]
  );

  useEffect(() => {
    if (!isOpen || !server) {
      resetState();
      return;
    }

    let cancelled = false;
    const isCancelled = () => cancelled;

    void initializeModal(server, isCancelled);

    return () => {
      cancelled = true;
    };
  }, [initializeModal, isOpen, resetState, server]);

  const handleLaunchBoundInstance = useCallback(async () => {
    if (!boundInstance) {
      return;
    }

    onClose();
    await launchGame(boundInstance.id);
  }, [boundInstance, launchGame, onClose]);

  const handleBind = useCallback(async () => {
    if (!server || !selectedInstanceId) {
      return;
    }

    try {
      setIsBinding(true);

      await serverBindingService.bindServerToInstance(
        selectedInstanceId,
        createServerBindingRecord(server)
      );

      setBoundInstance(resolveBoundInstance(selectedInstanceId, instances));
    } catch (error) {
      console.error('绑定失败:', error);
      alert(`绑定失败: ${getErrorMessage(error)}`);
    } finally {
      setIsBinding(false);
    }
  }, [instances, selectedInstanceId, server]);

  const handleDownloadModpack = useCallback(async () => {
    if (!server || !server.modpackUrl) {
      return;
    }

    try {
      setIsDownloading(true);

      await serverBindingService.downloadAndImportModpack({
        url: server.modpackUrl,
        instanceName: server.name,
        serverBinding: createServerBindingRecord(server),
      });

      onClose();
      setActiveTab('downloads');
    } catch (error) {
      console.error('触发下载失败:', error);
      alert(`下载触发失败: ${getErrorMessage(error)}`);
    } finally {
      setIsDownloading(false);
    }
  }, [onClose, server, setActiveTab]);

  const handleCreateNew = useCallback(() => {
    if (!server) {
      return;
    }

    useLauncherStore.getState().setPendingServerBinding(server);
    onClose();
    setActiveTab('new-instance');
  }, [onClose, server, setActiveTab]);

  return {
    boundInstance,
    handleBind,
    handleCreateNew,
    handleDownloadModpack,
    handleLaunchBoundInstance,
    instances,
    isBinding,
    isCheckingBinding,
    isDownloading,
    isLaunching,
    isLoading,
    isModServer: server ? isModdedServer(server) : false,
    launchTargetName: boundInstance?.name || server?.name || '',
    selectedInstanceId,
    setSelectedInstanceId,
  };
};
