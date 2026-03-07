// /src/features/Download/components/DownloadManager/index.tsx
import React, { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useDownloadStore } from '../../../../store/useDownloadStore';
import { useLauncherStore } from '../../../../store/useLauncherStore'; 
import { useInputAction } from '../../../../ui/focus/InputDriver'; // ✅ 引入超级驱动

// ✅ 1. 引入全局设置 Store，用于修改全局 Java 路径
import { useSettingsStore } from '../../../../store/useSettingsStore';

import { TaskPanel } from './TaskPanel';
import { FloatingButton } from './FloatingButton';

export const DownloadManager: React.FC = () => {
  const { tasks, isPopupOpen, setPopupOpen, addOrUpdateTask, removeTask } = useDownloadStore();
  const setActiveTab = useLauncherStore(state => state.setActiveTab); 
  
  // ✅ 2. 提取全局设置的更新方法
  const updateJavaSetting = useSettingsStore(state => state.updateJavaSetting);
  
  const taskList = Object.values(tasks);
  const activeTasksCount = taskList.filter(t => t.status === 'downloading').length;

  // 监听手柄的 MENU 键 (选项键) 来回切换面板状态
  useInputAction('MENU', () => {
    if (taskList.length > 0) {
      setPopupOpen(!isPopupOpen);
    }
  });
  
  useEffect(() => {
    const unlistenInstance = listen('instance-deployment-progress', (event: any) => {
      const payload = event.payload;
      addOrUpdateTask({
        id: payload.instance_id,
        taskType: 'instance',
        title: payload.instance_name || payload.instance_id,
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

    // ✅ 3. 核心新增监听：捕捉 Java 安装完毕事件，悄无声息地将它设为默认环境！
    const unlistenJava = listen('java-installed-auto-set', (event: any) => {
      console.log("检测到新安装的 Java，已自动设为全局默认环境:", event.payload);
      // 将后端传来的 java.exe 绝对路径直接写入 Zustand 设置
      updateJavaSetting('javaPath', event.payload);
    });

    return () => { 
      unlistenInstance.then(f => f()); 
      unlistenResource.then(f => f()); 
      unlistenJava.then(f => f()); // ✅ 别忘了清除新加的监听
    };
  }, [addOrUpdateTask, updateJavaSetting]); // ✅ 补全依赖

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