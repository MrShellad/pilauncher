import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download } from 'lucide-react';
import { getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import type { DownloadTask } from '../../../../store/useDownloadStore';
import type { TabType } from '../../../../store/useLauncherStore';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { useInputAction } from '../../../../ui/focus/InputDriver';
import { useScreenDensity } from '../../../../hooks/ui/useScreenDensity';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreTag } from '../../../../ui/primitives/OreTag';
import { OreMotionTokens } from '../../../../style/tokens/motion';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { TaskItem } from './TaskItem';
import { TaskLogDrawer } from './TaskLogDrawer';

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

const TASK_GROUPS = [
  { id: 'active', label: '进行中', statuses: ['downloading'] },
  { id: 'failed', label: '需处理', statuses: ['error'] },
  { id: 'paused', label: '已暂停', statuses: ['paused'] },
  { id: 'completed', label: '已完成', statuses: ['completed'] },
] as const;

const isTaskActionFocusKey = (focusKey: string, taskId: string) => [
  `btn-log-${taskId}`,
  `btn-pause-${taskId}`,
  `btn-cancel-${taskId}`,
  `btn-retry-${taskId}`,
  `btn-complete-${taskId}`,
].includes(focusKey);

export const TaskPanel = ({
  isOpen,
  onClose,
  taskList,
  setActiveTab,
  removeTask,
  clearCompletedTasks,
  autoOpenOnce,
  onAutoOpenOnceChange
}: TaskPanelProps) => {
  const density = useScreenDensity();
  const isCompact = density === 'compact';

  const activeTasksCount = taskList.filter((task: DownloadTask) => task.status === 'downloading').length;
  const completedTasksCount = taskList.filter((task: DownloadTask) => task.status === 'completed').length;
  const [isCompletedExpanded, setCompletedExpanded] = useState(false);
  const [logTaskId, setLogTaskId] = useState<string | null>(null);

  const taskGroups = useMemo(() => TASK_GROUPS.map((group) => ({
    ...group,
    tasks: taskList
      .filter((task) => group.statuses.includes(task.status as never))
      .sort((a, b) => b.lastUpdate - a.lastUpdate || b.startedAt - a.startedAt),
  })), [taskList]);
  const selectedLogTask = taskList.find((task) => task.id === logTaskId) ?? null;

  const openTaskLog = useCallback((taskId: string) => {
    setLogTaskId(taskId);
    requestAnimationFrame(() => setFocus(`btn-log-close-${taskId}`));
  }, []);

  const closeTaskLog = useCallback(() => {
    const focusKey = selectedLogTask ? `btn-log-${selectedLogTask.id}` : null;
    setLogTaskId(null);
    if (focusKey) requestAnimationFrame(() => setFocus(focusKey));
  }, [selectedLogTask]);

  useInputAction('ACTION_Y', () => {
    if (selectedLogTask) return;
    const focusKey = getCurrentFocusKey();
    const task = taskList.find((candidate) => focusKey && isTaskActionFocusKey(focusKey, candidate.id));
    if (task) openTaskLog(task.id);
  });

  const compactVariants = {
    hidden: { y: '100%' },
    visible: { y: 0, transition: { type: 'spring' as const, damping: 25, stiffness: 250 } },
    exit: { y: '100%', transition: { ease: 'easeInOut' as const, duration: 0.2 } }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="download-task-panel-title"
          variants={isCompact ? compactVariants : OreMotionTokens.downloadPanelContainer}
          initial="hidden"
          animate="visible"
          exit="exit"
          onAnimationComplete={(definition) => {
            if (definition === 'visible') {
              const initialTask = taskGroups.find((group) => group.id !== 'completed' && group.tasks.length > 0)?.tasks[0];
              setFocus(initialTask ? `btn-log-${initialTask.id}` : 'btn-taskpanel-hide');
            }
          }}
          className={`z-[1000] flex flex-col overflow-hidden bg-[var(--ore-modal-bg)] text-[var(--ore-modal-content-text)]
            ${isCompact 
              ? 'fixed bottom-0 left-0 right-0 mb-0 h-[min(44rem,calc(100dvh-1rem))] w-full border-t-[0.125rem] border-[var(--ore-border-color)] rounded-t-[0.5rem]'
              : 'mb-[1.25rem] w-[clamp(22rem,48vw,44rem)] max-h-[calc(100vh-120px)] border-[0.125rem] border-[var(--ore-border-color)]'
            }`}
          style={{ boxShadow: 'var(--ore-modal-shadow)' }}
        >
          <FocusBoundary
            id="download-task-panel"
            trapFocus={isOpen}
            onEscape={selectedLogTask ? closeTaskLog : onClose}
            defaultFocusKey="btn-taskpanel-hide"
            className="flex flex-1 min-h-0 flex-col overflow-hidden outline-none"
          >
            <div
              className="shrink-0 border-b-[0.125rem] border-[var(--ore-border-color)] bg-[var(--ore-modal-header-bg)] px-[1rem] py-[0.75rem]"
              style={{ boxShadow: 'var(--ore-modal-header-shadow)' }}
            >
              <div className="flex items-center justify-between gap-[0.75rem]">
                <div className="flex min-w-0 items-center gap-[0.5rem]">
                  <Download className="h-[1.125rem] w-[1.125rem] shrink-0 text-[var(--ore-btn-primary-bg)]" />
                  <h3 id="download-task-panel-title" className="truncate font-minecraft text-[clamp(1rem,1.5vw,1.125rem)] text-[var(--ore-modal-header-text)] ore-text-shadow">
                    下载任务管理
                  </h3>
                </div>

                <div className="flex shrink-0 items-center gap-[0.5rem] text-[clamp(0.75rem,1vw,0.8125rem)] font-minecraft uppercase tracking-[0.12em] text-[var(--ore-color-text-secondary-default)]">
                  <OreTag variant="success" size="sm" weight="bold">
                    {activeTasksCount} 进行中
                  </OreTag>
                  <span>{taskList.length} 个任务</span>
                </div>
              </div>
            </div>

            <OreOverlayScrollArea
              role="region"
              aria-label="下载任务列表"
              aria-busy={activeTasksCount > 0}
              className="flex-1 min-h-0 bg-[var(--ore-downloadDetail-base)]"
              contentClassName="space-y-[clamp(0.75rem,1.5vw,1rem)] p-[clamp(0.75rem,1.5vw,1rem)]"
              style={{ boxShadow: 'var(--ore-downloadDetail-listShadow)' }}
            >
              {taskGroups.map((group) => {
                if (group.tasks.length === 0) return null;
                const isCompletedGroup = group.id === 'completed';
                const shouldShowTasks = !isCompletedGroup || isCompletedExpanded;

                return (
                  <section key={group.id} aria-labelledby={`download-task-group-${group.id}`} className="space-y-[0.5rem]">
                    <div className="flex items-center justify-between gap-[0.75rem] px-[0.125rem]">
                      <div className="flex items-center gap-[0.5rem]">
                        <h4 id={`download-task-group-${group.id}`} className="font-minecraft text-[0.75rem] uppercase tracking-[0.1em] text-[var(--ore-downloadDetail-mutedText)]">
                          {group.label}
                        </h4>
                        <span className={`font-mono text-[0.75rem] tabular-nums ${group.id === 'failed' ? 'text-red-400' : 'text-[var(--ore-downloadDetail-mutedText)]'}`}>
                          {group.tasks.length}
                        </span>
                      </div>
                      {isCompletedGroup && (
                        <OreButton
                          focusKey="btn-taskpanel-toggle-completed"
                          variant="ghost"
                          size="auto"
                          onClick={() => setCompletedExpanded((expanded) => !expanded)}
                          className="!h-[2rem] !min-w-0 !px-[0.5rem] text-[0.75rem]"
                        >
                          {isCompletedExpanded ? '收起' : '展开'}
                        </OreButton>
                      )}
                    </div>
                    {shouldShowTasks && (
                      <div role="list" className="space-y-[0.5rem]">
                        {group.tasks.map((task) => (
                          <motion.div
                            key={task.id}
                            role="listitem"
                            variants={OreMotionTokens.downloadPanelItem}
                            initial="hidden"
                            animate="visible"
                          >
                            <TaskItem
                              task={task}
                              taskCount={taskList.length}
                              setActiveTab={setActiveTab}
                              removeTask={removeTask}
                              onOpenLog={openTaskLog}
                            />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </OreOverlayScrollArea>

            {selectedLogTask && (
              <TaskLogDrawer key={selectedLogTask.id} task={selectedLogTask} onClose={closeTaskLog} />
            )}

            <div
              className="grid shrink-0 gap-[0.625rem] border-t-[0.125rem] border-[var(--ore-border-color)] bg-[var(--ore-modal-footer-bg)] px-[1rem] py-[0.625rem] sm:grid-cols-[minmax(0,1fr)_auto]"
              style={{ boxShadow: 'var(--ore-modal-footer-shadow)' }}
            >
              <div className="flex min-w-0 items-center">
                <OreSwitch
                  focusKey="btn-taskpanel-auto-open-once"
                  checked={autoOpenOnce}
                  onChange={onAutoOpenOnceChange}
                  label="只弹一次"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-[0.5rem]">
                <OreButton
                  focusKey="btn-taskpanel-clear-completed"
                  variant="secondary"
                  size="auto"
                  disabled={completedTasksCount === 0}
                  onClick={clearCompletedTasks}
                  className="!min-w-[8.5rem] text-[0.8125rem]"
                >
                  清除已完成{completedTasksCount > 0 ? ` (${completedTasksCount})` : ''}
                </OreButton>

                <OreButton
                  focusKey="btn-taskpanel-hide"
                  variant="primary"
                  size="auto"
                  onClick={onClose}
                  className="!min-w-[6.5rem] text-[0.8125rem]"
                >
                  隐藏面板
                </OreButton>
              </div>
            </div>
          </FocusBoundary>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
