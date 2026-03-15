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
import { getCurrentFocusKey, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation';

const fallbackFocusKeysByTab: Record<string, string[]> = {
  home: ['play-button', 'instance-button', 'settings-button', 'btn-profile', 'btn-login'],
  instances: ['action-new', 'view-grid', 'view-list'],
  downloads: ['download-search-input', 'download-grid-item-0'],
  settings: [
    'settings-device-name',
    'settings-java-autodetect',
    'settings-download-source-vanilla',
    'btn-add-ms',
    'color-preset-0',
  ],
  'new-instance': ['card-custom', 'btn-back-menu'],
  'instance-detail': [
    'overview-btn-play',
    'basic-input-name',
    'java-entry-point',
    'save-btn-history',
    'mod-btn-history',
  ],
};

export const DownloadManager: React.FC = () => {
  const { tasks, isPopupOpen, setPopupOpen, addOrUpdateTask, removeTask } = useDownloadStore();
  const setActiveTab = useLauncherStore(state => state.setActiveTab); 
  const activeTab = useLauncherStore(state => state.activeTab); 
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
          const current = getCurrentFocusKey();
          if (!current || current === 'SN:ROOT' || current.startsWith('task-')) {
            const candidates = fallbackFocusKeysByTab[activeTab] || [];
            const target = candidates.find((focusKey) => doesFocusableExist(focusKey));
            if (target) setFocus(target);
          }
        }
      }, 150);
    }
    return () => clearTimeout(timer); 
  }, [isPopupOpen, hasTasks]);
  
  useEffect(() => {
    const unlistenInstance = listen('instance-deployment-progress', (event: any) => {
      const payload = event.payload;
      addOrUpdateTask({
        id: payload.task_id || payload.instance_id,
        taskType: 'instance',
        title: payload.instance_name || payload.instance_id || '实例',
        stage: payload.stage,
        current: payload.current,
        total: payload.total,
        message: payload.message ?? '',
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
        message: payload.message ?? '',
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
    <div className="fixed bottom-6 right-6 z-[999] pointer-events-none">
      {/* TaskPanel 使用绝对定位，不被下方气泡的出现/消失影响高度 */}
      <div className="absolute bottom-0 right-0 pointer-events-auto flex flex-col items-end origin-bottom-right">
        <TaskPanel 
          isOpen={isPopupOpen} 
          onClose={() => setPopupOpen(false)} 
          taskList={taskList} 
          setActiveTab={setActiveTab} 
          removeTask={removeTask} 
        />
      </div>

      {/* 气泡悬浮球同样使用绝对定位独立存在 */}
      <div className="absolute bottom-0 right-0 pointer-events-auto flex justify-end items-end">
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