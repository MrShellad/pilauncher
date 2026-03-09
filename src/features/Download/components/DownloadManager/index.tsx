// src/features/Download/components/DownloadManager/index.tsx
import React, { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useDownloadStore } from '../../../../store/useDownloadStore';
import { useLauncherStore } from '../../../../store/useLauncherStore'; 
import { useInputAction } from '../../../../ui/focus/InputDriver'; 
import { useSettingsStore } from '../../../../store/useSettingsStore';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { TaskPanel } from './TaskPanel';
import { FloatingButton } from './FloatingButton';

export const DownloadManager: React.FC = () => {
  const { tasks, isPopupOpen, setPopupOpen, addOrUpdateTask, removeTask } = useDownloadStore();
  const setActiveTab = useLauncherStore(state => state.setActiveTab); 
  const updateJavaSetting = useSettingsStore(state => state.updateJavaSetting);
  
  const taskList = Object.values(tasks);
  const activeTasksCount = taskList.filter(t => t.status === 'downloading').length;
  
  const hasTasks = taskList.length > 0;

  useInputAction('MENU', () => {
    if (hasTasks) {
      setPopupOpen(!isPopupOpen);
    }
  });

  useEffect(() => {
    if (!hasTasks && isPopupOpen) {
      setPopupOpen(false);
    }
  }, [hasTasks, isPopupOpen, setPopupOpen]);

  useEffect(() => {
    // ✅ 修复处：使用跨环境的类型推导代替 NodeJS.Timeout
    let timer: ReturnType<typeof setTimeout>; 
    
    if (!isPopupOpen) {
      timer = setTimeout(() => {
        if (hasTasks) {
          setFocus('btn-floating-download');
        } else {
          setFocus('inst-filter-search'); 
          setTimeout(() => setFocus('download-search-input'), 50); 
        }
      }, 150);
    }
    return () => clearTimeout(timer); 
  }, [isPopupOpen, hasTasks]);
  
  useEffect(() => {
    const unlistenInstance = listen('instance-download-progress', (event: any) => {
      const payload = event.payload;
      addOrUpdateTask({
        id: payload.task_id || payload.instance_id,
        taskType: 'instance',
        title: payload.instance_name || '实例',
        stage: payload.stage, 
        current: payload.current,
        total: payload.total,
        message: payload.message,
      });
    });

    const unlistenResource = listen('resource-download-progress', (event: any) => {
      const payload = event.payload;
      addOrUpdateTask({
        id: payload.task_id || payload.file_name,
        taskType: 'resource',
        title: payload.file_name,
        stage: payload.stage || 'DOWNLOADING_MOD', 
        current: payload.current,
        total: payload.total,
        message: payload.message,
      });
    });

    const unlistenJava = listen('java-installed-auto-set', (event: any) => {
      updateJavaSetting('javaPath', event.payload);
    });

    return () => { 
      unlistenInstance.then(f => f()); 
      unlistenResource.then(f => f()); 
      unlistenJava.then(f => f()); 
    };
  }, [addOrUpdateTask, updateJavaSetting]); 

  return (
    <div className="fixed bottom-6 right-6 z-[999] flex flex-col items-end pointer-events-none">
      <div className="pointer-events-auto flex flex-col items-end">
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
          hasTasks={hasTasks} 
        />
      </div>
    </div>
  );
};