import React, { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Inbox, X } from 'lucide-react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import type { DownloadTask } from '../../../../store/useDownloadStore';
import type { TabType } from '../../../../store/useLauncherStore';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { useInputAction } from '../../../../ui/focus/InputDriver';
import { useScreenDensity } from '../../../../hooks/ui/useScreenDensity';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreSegmentedControl } from '../../../../ui/primitives/OreSegmentedControl';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreTag } from '../../../../ui/primitives/OreTag';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { GamepadActionHint } from '../../../../ui/components/GamepadButtonIcon';
import { TaskItem } from './TaskItem';

interface TaskPanelProps {
  isOpen: boolean;
  onClose: () => void;
  taskList: DownloadTask[];
  setActiveTab: (tab: TabType) => void;
  removeTask: (id: string) => void;
  clearCompletedTasks: () => void;
  autoOpenOnce: boolean;
  onAutoOpenOnceChange: (enabled: boolean) => void;
}

type FilterTabId = 'all' | 'active' | 'error' | 'completed';

export const TaskPanel: React.FC<TaskPanelProps> = ({
  isOpen,
  onClose,
  taskList,
  setActiveTab,
  removeTask,
  clearCompletedTasks,
  autoOpenOnce,
  onAutoOpenOnceChange
}) => {
  const density = useScreenDensity();
  const isCompact = density === 'compact';

  const [filterTab, setFilterTab] = useState<FilterTabId>('all');
  const [logTaskId, setLogTaskId] = useState<string | null>(null);

  const activeTasksCount = taskList.filter((task) => task.status === 'downloading').length;
  const failedTasksCount = taskList.filter((task) => task.status === 'error').length;
  const completedTasksCount = taskList.filter((task) => task.status === 'completed').length;
  const pausedTasksCount = taskList.filter((task) => task.status === 'paused').length;

  const filteredTasks = useMemo(() => {
    return taskList
      .filter((task) => {
        if (filterTab === 'active') return task.status === 'downloading' || task.status === 'paused';
        if (filterTab === 'error') return task.status === 'error';
        if (filterTab === 'completed') return task.status === 'completed';
        return true;
      })
      .sort((a, b) => b.lastUpdate - a.lastUpdate || b.startedAt - a.startedAt);
  }, [taskList, filterTab]);

  const toggleTaskLog = useCallback((taskId: string) => {
    setLogTaskId((prev) => (prev === taskId ? null : taskId));
  }, []);

  // 手柄快捷键支持
  useInputAction('ACTION_Y', () => {
    if (!isOpen) return;
    const focusKey = getCurrentFocusKey();
    if (focusKey) {
      const match = focusKey.match(/^btn-(?:log|pause|cancel|retry|complete)-(.+)$/);
      if (match && match[1]) {
        toggleTaskLog(match[1]);
      }
    }
  });

  useInputAction('CANCEL', () => {
    if (!isOpen) return;
    if (logTaskId) {
      setLogTaskId(null);
    } else {
      onClose();
    }
  });

  const filterTabs = [
    { id: 'all', label: `全部 (${taskList.length})` },
    { id: 'active', label: `进行中 (${activeTasksCount + pausedTasksCount})` },
    { id: 'error', label: `需处理 (${failedTasksCount})` },
    { id: 'completed', label: `已完成 (${completedTasksCount})` }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="download-task-panel-title"
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onAnimationComplete={() => {
            const firstTask = filteredTasks[0];
            if (firstTask && doesFocusableExist(`btn-log-${firstTask.id}`)) {
              setFocus(`btn-log-${firstTask.id}`);
            } else if (doesFocusableExist('btn-taskpanel-hide')) {
              setFocus('btn-taskpanel-hide');
            }
          }}
          className={`z-[1000] flex flex-col overflow-hidden bg-[var(--ore-modal-bg)] border-[3px] border-[#1E1E1F] font-minecraft select-none ${
            isCompact
              ? 'fixed bottom-0 left-0 right-0 h-[min(44rem,calc(100dvh-1rem))] w-full rounded-none'
              : 'mb-4 w-[clamp(26rem,54vw,48rem)] h-[min(46rem,calc(100vh-100px))] shadow-[var(--ore-modal-shadow)]'
          }`}
        >
          <FocusBoundary
            id="download-task-panel-boundary"
            trapFocus={isOpen}
            onEscape={logTaskId ? () => setLogTaskId(null) : onClose}
            defaultFocusKey="btn-taskpanel-hide"
            className="flex flex-1 min-h-0 h-full flex-col overflow-hidden outline-none"
          >
            {/* 1. 顶部标题栏 */}
            <div
              className="flex shrink-0 items-center justify-between gap-3 border-b-[3px] border-[#1E1E1F] bg-[var(--ore-modal-header-bg)] px-4 py-3"
              style={{ boxShadow: 'var(--ore-modal-header-shadow)' }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Download className="h-5 w-5 shrink-0 text-[#6CC349]" />
                <h3
                  id="download-task-panel-title"
                  className="truncate font-minecraft text-base sm:text-lg font-bold text-white ore-text-shadow"
                >
                  下载任务管理
                </h3>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {activeTasksCount > 0 && (
                  <OreTag variant="success" size="sm" weight="bold">
                    {activeTasksCount} 进行中
                  </OreTag>
                )}
                {failedTasksCount > 0 && (
                  <OreTag variant="error" size="sm" weight="bold">
                    {failedTasksCount} 需处理
                  </OreTag>
                )}
                <OreButton
                  focusKey="btn-taskpanel-close-x"
                  variant="secondary"
                  size="sm"
                  onClick={onClose}
                  className="!h-8 !w-8 !p-0"
                >
                  <X size={16} />
                </OreButton>
              </div>
            </div>

            {/* 2. 居中状态过滤器 */}
            <div
              className="flex shrink-0 items-center justify-center border-b-[2px] border-[#1E1E1F] bg-[#313233] px-4 py-2"
              style={{ boxShadow: 'inset 0 2px 0 rgba(255, 255, 255, 0.08)' }}
            >
              <OreSegmentedControl
                tabs={filterTabs}
                activeTab={filterTab}
                onChange={(val) => setFilterTab(val as FilterTabId)}
                style={{
                  '--seg-height': '2.25rem',
                  '--seg-min-width': '0px',
                  '--seg-px': '1rem',
                  '--seg-font-size': '0.8125rem'
                } as any}
              />
            </div>

            {/* 3. 任务列表主视口 (下沉式矿槽，可自由平滑滚动) */}
            <OreOverlayScrollArea
              role="region"
              aria-label="下载任务列表"
              className="flex-1 min-h-0 h-full bg-[#222324]"
              viewportClassName="shadow-[inset_0_10px_20px_-10px_rgba(0,0,0,0.55)]"
              contentClassName="p-3.5 space-y-3"
              contentSafePaddingRight={8}
            >
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    isLogOpen={logTaskId === task.id}
                    setActiveTab={setActiveTab}
                    removeTask={removeTask}
                    onToggleLog={toggleTaskLog}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-[#8C8D90]">
                  <Inbox size={32} className="opacity-50 mb-2" />
                  <p className="text-xs font-bold">暂无相关下载任务</p>
                </div>
              )}
            </OreOverlayScrollArea>

            {/* 4. 底部操作与手柄提示栏 */}
            <div
              className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t-[3px] border-[#1E1E1F] bg-[var(--ore-modal-footer-bg)] px-4 py-3"
              style={{ boxShadow: 'var(--ore-modal-footer-shadow)' }}
            >
              {/* 左侧：只弹一次开关 + 手柄快捷键提示 */}
              <div className="flex items-center gap-3">
                <OreSwitch
                  focusKey="btn-taskpanel-auto-open-once"
                  checked={autoOpenOnce}
                  onChange={onAutoOpenOnceChange}
                  label="只弹一次"
                />

                {/* 手柄快捷键提示 */}
                <div className="hidden sm:flex items-center gap-2.5 text-xs text-[#D0D1D4] pl-2 border-l border-[#1E1E1F]">
                  <GamepadActionHint button="Y" label="日志切换" size="sm" />
                  <GamepadActionHint button="B" label="关闭" size="sm" />
                </div>
              </div>

              {/* 右侧：动作按钮 (标准 size="sm") */}
              <div className="flex items-center gap-2">
                {completedTasksCount > 0 && (
                  <OreButton
                    focusKey="btn-taskpanel-clear-completed"
                    variant="danger"
                    size="sm"
                    onClick={clearCompletedTasks}
                  >
                    <span>清除已完成 ({completedTasksCount})</span>
                  </OreButton>
                )}

                <OreButton
                  focusKey="btn-taskpanel-hide"
                  variant="secondary"
                  size="sm"
                  onClick={onClose}
                >
                  <span>隐藏面板</span>
                </OreButton>
              </div>
            </div>
          </FocusBoundary>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TaskPanel;