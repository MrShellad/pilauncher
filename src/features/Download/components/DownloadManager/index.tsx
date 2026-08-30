import React, { useCallback, useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { useDownloadStore } from '../../../../store/useDownloadStore';
import { useLauncherStore } from '../../../../store/useLauncherStore';
import { useSettingsStore } from '../../../../store/useSettingsStore';
import { useToastStore } from '../../../../store/useToastStore';
import { useInputAction } from '../../../../ui/focus/InputDriver';
import type { DownloadTaskStatus, DownloadTaskType } from '../../logic/downloadTask';
import { INITIAL_DOWNLOAD_FOCUS_KEY } from '../../../Settings/components/tabs/download/downloadSettings.constants';
import { FloatingButton } from './FloatingButton';
import { TaskPanel } from './TaskPanel';

const fallbackFocusKeysByTab: Record<string, string[]> = {
  home: ['play-button', 'instance-button', 'settings-button', 'btn-wardrobe', 'btn-profile', 'btn-login'],
  news: ['news-refresh-button', 'news-back-button'],
  instances: ['action-new', 'view-grid', 'view-list'],
  downloads: ['download-search-input', 'download-grid-item-0'],
  settings: [
    'settings-device-name',
    'settings-java-autodetect',
    INITIAL_DOWNLOAD_FOCUS_KEY,
    'btn-add-ms',
    'color-preset-0'
  ],
  'new-instance': ['card-custom', 'btn-back-menu'],
  'instance-detail': [
    'overview-btn-play',
    'basic-input-name',
    'java-entry-point',
    'save-btn-history',
    'mod-btn-history'
  ],
  'instance-mod-download': [
    'instance-mod-page-back',
    'inst-filter-search',
    'download-grid-item-0'
  ],
  wardrobe: ['wardrobe-back', 'wardrobe-upload-card', 'wardrobe-section-0']
};

const globalSafeFallbackKeys = [
  'inst-filter-search',
  'instance-mod-page-back',
  'download-grid-item-0',
  'download-search-input',
  'play-button'
];

interface DownloadProgressPayload {
  task_id?: string;
  instance_id?: string;
  instance_name?: string;
  file_name?: string;
  title?: string;
  version?: string;
  task_type?: string;
  stage?: string;
  current?: number;
  total?: number;
  message?: string;
  level?: string;
}

const isDownloadTaskType = (value: string | undefined): value is DownloadTaskType => (
  value === 'instance' || value === 'resource' || value === 'update'
);

const isTaskManagerFocusKey = (focusKey: string) =>
  focusKey === 'btn-floating-download' ||
  focusKey.startsWith('task-') ||
  focusKey.startsWith('btn-taskpanel') ||
  focusKey.startsWith('btn-log-') ||
  focusKey.startsWith('btn-pause-') ||
  focusKey.startsWith('btn-cancel-') ||
  focusKey.startsWith('btn-retry-') ||
  focusKey.startsWith('btn-complete-');

export const DownloadManager: React.FC = () => {
  const {
    tasks,
    isPopupOpen,
    setPopupOpen,
    autoOpenOnce,
    setAutoOpenOnce,
    addOrUpdateTask,
    removeTask,
    clearCompletedTasks
  } = useDownloadStore();
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const activeTab = useLauncherStore((state) => state.activeTab);
  const updateJavaSetting = useSettingsStore((state) => state.updateJavaSetting);
  const addToast = useToastStore((state) => state.addToast);

  const taskList = Object.values(tasks);
  const activeTasks = taskList.filter((task) => task.status === 'downloading');
  const activeTasksCount = activeTasks.length;
  const failedTasksCount = taskList.filter((task) => task.status === 'error').length;
  const hasTasks = taskList.length > 0;

  // Aggregate progress for floating button ring
  const aggregatedProgress = activeTasksCount > 0
    ? Math.round(activeTasks.reduce((sum, t) => sum + t.progress, 0) / activeTasksCount)
    : 0;

  const previousPopupOpenRef = useRef(isPopupOpen);
  const knownTaskIdsRef = useRef<Set<string>>(new Set());
  const taskToastInitializedRef = useRef(false);
  const lastPageFocusRef = useRef<string | null>(null);
  const taskStatusesRef = useRef<Record<string, DownloadTaskStatus>>({});
  const taskStatusInitializedRef = useRef(false);
  const shouldRestorePageFocusRef = useRef(false);
  const [newTaskPulseKey, setNewTaskPulseKey] = useState(0);
  const [taskAnnouncement, setTaskAnnouncement] = useState('');

  const resolveFallbackFocus = useCallback(() => {
    const orderedCandidates = [
      lastPageFocusRef.current,
      ...(fallbackFocusKeysByTab[activeTab] || []),
      ...globalSafeFallbackKeys
    ].filter((focusKey, index, array): focusKey is string => !!focusKey && array.indexOf(focusKey) === index);

    return orderedCandidates.find((focusKey) => doesFocusableExist(focusKey)) || null;
  }, [activeTab]);

  const rememberCurrentPageFocus = useCallback(() => {
    const currentFocusKey = getCurrentFocusKey();
    if (!currentFocusKey || currentFocusKey === 'SN:ROOT' || isTaskManagerFocusKey(currentFocusKey)) {
      return;
    }

    if (doesFocusableExist(currentFocusKey)) {
      lastPageFocusRef.current = currentFocusKey;
    }
  }, []);

  const openPanel = useCallback(() => {
    rememberCurrentPageFocus();
    shouldRestorePageFocusRef.current = false;
    setPopupOpen(true);
  }, [rememberCurrentPageFocus, setPopupOpen]);

  const closePanelAndRestoreFocus = useCallback(() => {
    shouldRestorePageFocusRef.current = true;
    setPopupOpen(false);
  }, [setPopupOpen]);

  useInputAction('VIEW', () => {
    if (!hasTasks) return;

    if (isPopupOpen) {
      closePanelAndRestoreFocus();
      return;
    }

    openPanel();
  });

  useEffect(() => {
    if (!hasTasks && isPopupOpen) {
      closePanelAndRestoreFocus();
    }
  }, [closePanelAndRestoreFocus, hasTasks, isPopupOpen]);

  useEffect(() => {
    const currentTaskIds = new Set(taskList.map((task) => task.id));
    const newTasks = taskList.filter((task) => !knownTaskIdsRef.current.has(task.id));

    if (!taskToastInitializedRef.current) {
      taskToastInitializedRef.current = true;
      knownTaskIdsRef.current = currentTaskIds;
      return;
    }

    if (newTasks.length > 0) {
      setNewTaskPulseKey((key) => key + 1);
      const toastMessage = newTasks.length === 1
        ? `已添加下载任务：\n${newTasks[0].title}`
        : `已添加 ${newTasks.length} 个下载任务`;
      addToast('success', toastMessage, 2400);
    }

    knownTaskIdsRef.current = currentTaskIds;
  }, [addToast, taskList]);

  useEffect(() => {
    const nextStatuses = Object.fromEntries(taskList.map((task) => [task.id, task.status]));

    if (!taskStatusInitializedRef.current) {
      taskStatusesRef.current = nextStatuses;
      taskStatusInitializedRef.current = true;
      return;
    }

    const latestTransition = [...taskList]
      .sort((a, b) => b.lastUpdate - a.lastUpdate)
      .find((task) => {
        const previousStatus = taskStatusesRef.current[task.id];
        return previousStatus !== task.status;
      });

    taskStatusesRef.current = nextStatuses;

    if (!latestTransition) return;

    const statusText: Partial<Record<DownloadTaskStatus, string>> = {
      completed: '下载完成',
      error: '下载失败',
      paused: '下载已暂停',
      downloading: '下载已继续',
    };
    const announcement = statusText[latestTransition.status];
    if (announcement) setTaskAnnouncement(`${latestTransition.title}：${announcement}`);
  }, [taskList]);

  useEffect(() => {
    const wasOpen = previousPopupOpenRef.current;
    previousPopupOpenRef.current = isPopupOpen;

    if (!wasOpen && isPopupOpen) {
      rememberCurrentPageFocus();
      return;
    }

    if (isPopupOpen || !wasOpen) {
      return;
    }

    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attemptRestoreFocus = (attempt = 0) => {
      const restoreTarget = resolveFallbackFocus();

      if (restoreTarget) {
        setFocus(restoreTarget);
        shouldRestorePageFocusRef.current = false;
        return;
      }

      if (attempt < 4) {
        retryTimer = setTimeout(() => attemptRestoreFocus(attempt + 1), 80);
        return;
      }

      if (hasTasks && doesFocusableExist('btn-floating-download')) {
        setFocus('btn-floating-download');
      }

      shouldRestorePageFocusRef.current = false;
    };

    const timer = setTimeout(() => attemptRestoreFocus(), 150);

    return () => {
      clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [hasTasks, isPopupOpen, rememberCurrentPageFocus, resolveFallbackFocus]);

  useEffect(() => {
    const unlistenInstance = listen<DownloadProgressPayload>('instance-deployment-progress', (event) => {
      const payload = event.payload;
      const id = payload.task_id || payload.instance_id;
      if (!id) return;

      addOrUpdateTask({
        id,
        taskType: 'instance',
        title: payload.instance_name || payload.instance_id || '实例',
        stage: payload.stage,
        current: payload.current,
        total: payload.total,
        message: payload.message ?? ''
      });
    });

    const unlistenInstanceSpeed = listen<DownloadProgressPayload>('instance-deployment-speed', (event) => {
      const payload = event.payload;
      const id = payload.task_id || payload.instance_id;
      if (!id) return;

      addOrUpdateTask({
        id,
        taskType: 'instance',
        title: payload.instance_name || payload.instance_id || '实例',
        stage: payload.stage,
        current: payload.current,
        total: payload.total,
        speedCurrent: payload.current,
        message: payload.message ?? ''
      });
    });

    const unlistenDownloadLog = listen<DownloadProgressPayload>('download-task-log', (event) => {
      const payload = event.payload;
      const id = payload.task_id || payload.instance_id;
      if (!id) return;

      const existing = useDownloadStore.getState().tasks[id];
      const levelPrefix = payload.level ? `[${payload.level}] ` : '';

      addOrUpdateTask({
        id,
        taskType: isDownloadTaskType(payload.task_type) ? payload.task_type : existing?.taskType || 'instance',
        title: payload.title || existing?.title || payload.instance_id || id,
        stage: payload.stage || existing?.stage,
        current: existing?.current ?? 0,
        total: existing?.total ?? 0,
        message: `${levelPrefix}${payload.message ?? ''}`
      });
    });

    const unlistenResource = listen<DownloadProgressPayload>('resource-download-progress', (event) => {
      const payload = event.payload;
      const id = payload.task_id || payload.file_name;
      if (!id || !payload.file_name) return;

      addOrUpdateTask({
        id,
        taskType: 'resource',
        title: payload.file_name,
        stage: payload.stage || 'DOWNLOADING_MOD',
        current: payload.current,
        total: payload.total,
        speedCurrent: payload.current,
        message: payload.message ?? ''
      });
    });

    const unlistenLauncherUpdate = listen<DownloadProgressPayload>('launcher-update-progress', (event) => {
      const payload = event.payload;
      addOrUpdateTask({
        id: payload.task_id || 'launcher-update',
        taskType: 'update',
        title: payload.title || (payload.version ? `PiLauncher v${payload.version}` : 'PiLauncher Update'),
        stage: payload.stage || 'DOWNLOADING_UPDATE',
        current: payload.current,
        total: payload.total,
        speedCurrent: payload.current,
        message: payload.message ?? ''
      });
    });

    const unlistenJava = listen<string>('java-installed-auto-set', (event) => {
      updateJavaSetting('javaPath', event.payload);
    });

    return () => {
      unlistenInstance.then((fn) => fn());
      unlistenInstanceSpeed.then((fn) => fn());
      unlistenDownloadLog.then((fn) => fn());
      unlistenResource.then((fn) => fn());
      unlistenLauncherUpdate.then((fn) => fn());
      unlistenJava.then((fn) => fn());
    };
  }, [addOrUpdateTask, updateJavaSetting]);

  return (
    <div className="pointer-events-none fixed bottom-[clamp(1rem,2vw,1.5rem)] right-[clamp(1rem,2vw,1.5rem)] z-[999]">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {taskAnnouncement}
      </div>
      <div className="pointer-events-auto absolute bottom-0 right-0 flex origin-bottom-right flex-col items-end">
        <TaskPanel
          isOpen={isPopupOpen}
          onClose={closePanelAndRestoreFocus}
          taskList={taskList}
          setActiveTab={setActiveTab}
          removeTask={removeTask}
          clearCompletedTasks={clearCompletedTasks}
          autoOpenOnce={autoOpenOnce}
          onAutoOpenOnceChange={setAutoOpenOnce}
        />
      </div>

      <div className="pointer-events-auto absolute bottom-0 right-0 flex items-end justify-end">
        <FloatingButton
          isOpen={isPopupOpen}
          onClick={openPanel}
          activeCount={activeTasksCount}
          hasTasks={hasTasks}
          progress={aggregatedProgress}
          failedCount={failedTasksCount}
          pulseKey={newTaskPulseKey}
        />
      </div>
    </div>
  );
};
