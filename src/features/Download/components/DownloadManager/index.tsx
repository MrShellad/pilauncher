import React, { useCallback, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { useDownloadStore } from '../../../../store/useDownloadStore';
import { useLauncherStore } from '../../../../store/useLauncherStore';
import { useSettingsStore } from '../../../../store/useSettingsStore';
import { useInputAction } from '../../../../ui/focus/InputDriver';
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

const isTaskManagerFocusKey = (focusKey: string) =>
  focusKey === 'btn-floating-download' ||
  focusKey.startsWith('task-') ||
  focusKey.startsWith('btn-taskpanel');

export const DownloadManager: React.FC = () => {
  const { tasks, isPopupOpen, setPopupOpen, addOrUpdateTask, removeTask } = useDownloadStore();
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const activeTab = useLauncherStore((state) => state.activeTab);
  const updateJavaSetting = useSettingsStore((state) => state.updateJavaSetting);

  const taskList = Object.values(tasks);
  const activeTasks = taskList.filter((task) => task.status === 'downloading');
  const activeTasksCount = activeTasks.length;
  const hasTasks = taskList.length > 0;

  // Aggregate progress for floating button ring
  const aggregatedProgress = activeTasksCount > 0
    ? Math.round(activeTasks.reduce((sum, t) => sum + t.progress, 0) / activeTasksCount)
    : taskList.length > 0
      ? Math.round(taskList.reduce((sum, t) => sum + t.progress, 0) / taskList.length)
      : 0;

  const previousPopupOpenRef = useRef(isPopupOpen);
  const lastPageFocusRef = useRef<string | null>(null);
  const shouldRestorePageFocusRef = useRef(false);

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
    const unlistenInstance = listen('instance-deployment-progress', (event: any) => {
      const payload = event.payload;
      addOrUpdateTask({
        id: payload.task_id || payload.instance_id,
        taskType: 'instance',
        title: payload.instance_name || payload.instance_id || '实例',
        stage: payload.stage,
        current: payload.current,
        total: payload.total,
        message: payload.message ?? ''
      });
    });

    const unlistenInstanceSpeed = listen('instance-deployment-speed', (event: any) => {
      const payload = event.payload;
      addOrUpdateTask({
        id: payload.task_id || payload.instance_id,
        taskType: 'instance',
        stage: payload.stage,
        speedCurrent: payload.current,
        message: payload.message ?? ''
      });
    });

    const unlistenDownloadLog = listen('download-task-log', (event: any) => {
      const payload = event.payload;
      const id = payload.task_id || payload.instance_id;
      const existing = useDownloadStore.getState().tasks[id];
      const levelPrefix = payload.level ? `[${payload.level}] ` : '';

      addOrUpdateTask({
        id,
        taskType: payload.task_type || existing?.taskType || 'instance',
        title: payload.title || existing?.title || payload.instance_id || id,
        stage: payload.stage || existing?.stage,
        current: existing?.current ?? 0,
        total: existing?.total ?? 0,
        message: `${levelPrefix}${payload.message ?? ''}`
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
        speedCurrent: payload.current,
        message: payload.message ?? ''
      });
    });

    const unlistenLauncherUpdate = listen('launcher-update-progress', (event: any) => {
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

    const unlistenJava = listen('java-installed-auto-set', (event: any) => {
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
      <div className="pointer-events-auto absolute bottom-0 right-0 flex origin-bottom-right flex-col items-end">
        <TaskPanel
          isOpen={isPopupOpen}
          onClose={closePanelAndRestoreFocus}
          taskList={taskList}
          setActiveTab={setActiveTab}
          removeTask={removeTask}
        />
      </div>

      <div className="pointer-events-auto absolute bottom-0 right-0 flex items-end justify-end">
        <FloatingButton
          isOpen={isPopupOpen}
          onClick={openPanel}
          activeCount={activeTasksCount}
          hasTasks={hasTasks}
          progress={aggregatedProgress}
        />
      </div>
    </div>
  );
};
