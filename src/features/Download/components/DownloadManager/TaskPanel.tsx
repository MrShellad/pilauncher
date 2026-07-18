import { AnimatePresence, motion } from 'motion/react';
import { Download } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import type { DownloadTask } from '../../../../store/useDownloadStore';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { useScreenDensity } from '../../../../hooks/ui/useScreenDensity';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { ControlHint } from '../../../../ui/components/ControlHint';
import { OreMotionTokens } from '../../../../style/tokens/motion';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { TaskItem } from './TaskItem';

export const TaskPanel = ({
  isOpen,
  onClose,
  taskList,
  setActiveTab,
  removeTask,
  clearCompletedTasks,
  autoOpenOnce,
  onAutoOpenOnceChange
}: any) => {
  const density = useScreenDensity();
  const isCompact = density === 'compact';

  const activeTasksCount = taskList.filter((task: DownloadTask) => task.status === 'downloading').length;
  const completedTasksCount = taskList.filter((task: DownloadTask) => task.status === 'completed').length;

  const sortedTaskList = [...taskList].sort((a, b) => {
    // 1. Ongoing tasks (downloading) first
    const aActive = a.status === 'downloading';
    const bActive = b.status === 'downloading';
    if (aActive !== bActive) {
      return aActive ? -1 : 1;
    }

    // 2. Paused tasks second
    const aPaused = a.status === 'paused';
    const bPaused = b.status === 'paused';
    if (aPaused !== bPaused) {
      return aPaused ? -1 : 1;
    }

    // 3. Newest tasks (by startedAt / lastUpdate) first
    const startedDiff = (b.startedAt || 0) - (a.startedAt || 0);
    if (startedDiff !== 0) {
      return startedDiff;
    }
    return (b.lastUpdate || 0) - (a.lastUpdate || 0);
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
          variants={isCompact ? compactVariants : OreMotionTokens.downloadPanelContainer}
          initial="hidden"
          animate="visible"
          exit="exit"
          onAnimationComplete={(definition) => {
            if (definition === 'visible') {
              setFocus('btn-taskpanel-hide');
            }
          }}
          className={`z-[1000] flex flex-col overflow-hidden bg-[var(--ore-modal-bg)] text-[var(--ore-modal-content-text)]
            ${isCompact 
              ? 'fixed bottom-0 left-0 right-0 mb-0 h-[70dvh] max-h-[70dvh] w-full border-t-[0.125rem] border-[var(--ore-border-color)] rounded-t-lg'
              : 'mb-[1.25rem] w-[clamp(22rem,85vw,40rem)] max-h-[calc(100vh-120px)] border-[0.125rem] border-[var(--ore-border-color)]'
            }`}
          style={{ boxShadow: 'var(--ore-modal-shadow)' }}
        >
          <FocusBoundary
            id="download-task-panel"
            trapFocus={isOpen}
            onEscape={onClose}
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
                  <h3 className="truncate font-minecraft text-[clamp(1rem,1.5vw,1.125rem)] text-[var(--ore-modal-header-text)] ore-text-shadow">
                    下载任务管理
                  </h3>
                </div>

                <div className="flex shrink-0 items-center gap-[0.5rem] text-[clamp(0.75rem,1vw,0.8125rem)] font-minecraft uppercase tracking-[0.12em] text-[var(--ore-color-text-secondary-default)]">
                  <span
                    className="inline-flex items-center border-[0.125rem] border-[var(--ore-border-color)] bg-[var(--ore-color-background-success-default)] px-[0.5rem] py-[0.1875rem] text-[var(--ore-color-text-onLight-default)]"
                    style={{ boxShadow: 'var(--ore-shadow-success-default)' }}
                  >
                    {activeTasksCount} 进行中
                  </span>
                  <span>{taskList.length} 个任务</span>
                </div>
              </div>
            </div>

            <OreOverlayScrollArea
              className="flex-1 min-h-0 bg-[var(--ore-downloadDetail-base)]"
              contentClassName="space-y-[clamp(0.75rem,1.5vw,1rem)] p-[clamp(0.75rem,1.5vw,1rem)]"
              style={{ boxShadow: 'var(--ore-downloadDetail-listShadow)' }}
            >
              {sortedTaskList.map((task: DownloadTask) => (
                <motion.div
                  key={task.id}
                  variants={OreMotionTokens.downloadPanelItem}
                  initial="hidden"
                  animate="visible"
                >
                  <TaskItem
                    task={task}
                    taskCount={taskList.length}
                    setActiveTab={setActiveTab}
                    removeTask={removeTask}
                  />
                </motion.div>
              ))}
            </OreOverlayScrollArea>

            <div
              className="flex shrink-0 items-center justify-between gap-[0.75rem] border-t-[0.125rem] border-[var(--ore-border-color)] bg-[var(--ore-modal-footer-bg)] px-[1rem] py-[0.625rem]"
              style={{ boxShadow: 'var(--ore-modal-footer-shadow)' }}
            >
              <div className="flex flex-wrap items-center gap-x-[0.875rem] gap-y-[0.5rem] text-[clamp(0.75rem,1vw,0.8125rem)] font-minecraft text-[var(--ore-color-text-muted-default)]">
                <div className="flex items-center gap-[0.25rem]">
                  <span className="inline-flex items-center justify-center drop-shadow-[0_1px_0_rgba(0,0,0,0.45)]" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" className="h-5 w-auto" fill="none">
                      <rect x="3" y="7" width="10" height="10" rx="1.5" stroke="#B1B2B5" strokeWidth="2" fill="#313233" />
                      <rect x="9" y="4" width="10" height="10" rx="1.5" stroke="#B1B2B5" strokeWidth="2" fill="#313233" />
                    </svg>
                  </span>
                  <span>隐藏</span>
                </div>
                <div className="flex items-center gap-[0.25rem]">
                  <ControlHint label="Y" variant="face" tone="yellow" className="scale-[0.75] origin-center" />
                  <span>日志</span>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-x-[0.875rem] gap-y-[0.5rem]">
                <OreSwitch
                  focusKey="btn-taskpanel-auto-open-once"
                  checked={autoOpenOnce}
                  onChange={onAutoOpenOnceChange}
                  label="只弹一次"
                />
                <OreButton
                  focusKey="btn-taskpanel-clear-completed"
                  variant="secondary"
                  size="auto"
                  disabled={completedTasksCount === 0}
                  onClick={clearCompletedTasks}
                  className="!h-[clamp(2.25rem,3vw,2.5rem)] !min-w-[7rem] !px-[0.75rem] text-[clamp(0.8125rem,1vw,0.875rem)]"
                >
                  清除已完成{completedTasksCount > 0 ? ` (${completedTasksCount})` : ''}
                </OreButton>
              </div>

              <OreButton
                focusKey="btn-taskpanel-hide"
                variant="primary"
                size="auto"
                onClick={onClose}
                className="!h-[clamp(2.25rem,3vw,2.5rem)] !min-w-[6rem] !px-[0.75rem] text-[clamp(0.8125rem,1vw,0.875rem)]"
              >
                <span className="flex items-center gap-[0.25rem]">
                  隐藏面板
                </span>
              </OreButton>
            </div>
          </FocusBoundary>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
