// /src/features/Download/components/DownloadManager/index.tsx
import React, { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useDownloadStore } from '../../../../store/useDownloadStore';
import { useLauncherStore } from '../../../../store/useLauncherStore'; 
import { TaskPanel } from './TaskPanel';
import { FloatingButton } from './FloatingButton';

export const DownloadManager: React.FC = () => {
  const { tasks, isPopupOpen, setPopupOpen, addOrUpdateTask, removeTask } = useDownloadStore();
  const setActiveTab = useLauncherStore(state => state.setActiveTab); 
  
  const taskList = Object.values(tasks);
  const activeTasksCount = taskList.filter(t => t.status === 'downloading').length;
  
  useEffect(() => {
    // 1. 监听实例部署进度
    const unlistenInstance = listen('instance-deployment-progress', (event: any) => {
      const payload = event.payload;
      addOrUpdateTask({
        id: payload.instance_id,
        taskType: 'instance',
        title: payload.instance_name || payload.instance_id, // 以实例名为标题
        stage: payload.stage,
        current: payload.current,
        total: payload.total,
        message: payload.message,
      });
    });

    // 2. 监听模块/资源包下载进度 (兼容你的新功能！)
    const unlistenResource = listen('resource-download-progress', (event: any) => {
      const payload = event.payload;
      addOrUpdateTask({
        id: payload.task_id || payload.file_name, // 使用传入的任务ID，兜底使用文件名
        taskType: 'resource',
        title: payload.file_name, // 资源下载以文件名为标题
        stage: payload.stage || 'DOWNLOADING_MOD', 
        current: payload.current,
        total: payload.total,
        message: payload.message,
      });
    });

    return () => { 
      unlistenInstance.then(f => f()); 
      unlistenResource.then(f => f()); 
    };
  }, [addOrUpdateTask]);

  if (taskList.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <TaskPanel 
        isOpen={isPopupOpen} 
        onClose={() => setPopupOpen(false)} 
        taskList={taskList} 
        setActiveTab={setActiveTab} 
        removeTask={removeTask} 
      />
      <FloatingButton 
        isOpen={isPopupOpen} 
        onClick={() => setPopupOpen(true)} 
        activeCount={activeTasksCount} 
        progress={taskList[0]?.progress || 0} 
      />
    </div>
  );
};