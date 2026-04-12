import { AnimatePresence, motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import type { DownloadTask } from '../../../../store/useDownloadStore';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { ControlHint } from '../../../../ui/components/ControlHint';
import { OreMotionTokens } from '../../../../style/tokens/motion';
import { TaskItem } from './TaskItem';

export const TaskPanel = ({ isOpen, onClose, taskList, setActiveTab, removeTask }: any) => {
  const activeTasksCount = taskList.filter((task: DownloadTask) => task.status === 'downloading').length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={OreMotionTokens.downloadPanelContainer}
          initial="hidden"
          animate="visible"
          exit="exit"
          onAnimationComplete={() => setFocus('btn-taskpanel-hide')}
          className="z-[1000] mb-[1.25rem] flex w-[clamp(22rem,50vw,40rem)] flex-col overflow-hidden border-[0.125rem] border-[var(--ore-border-color)] bg-[var(--ore-modal-bg)] text-[var(--ore-modal-content-text)]"
          style={{ boxShadow: 'var(--ore-modal-shadow)' }}
        >
          <FocusBoundary
            id="download-task-panel"
            trapFocus={isOpen}
            onEscape={onClose}
            defaultFocusKey="btn-taskpanel-hide"
            className="flex h-full flex-col overflow-hidden outline-none"
          >
            <div
              className="shrink-0 border-b-[0.125rem] border-[var(--ore-border-color)] bg-[var(--ore-modal-header-bg)] px-[1rem] py-[0.75rem]"
              style={{ boxShadow: 'var(--ore-modal-header-shadow)' }}
            >
              <div className="flex min-w-0 items-center gap-[0.5rem]">
                <Download className="h-[1.125rem] w-[1.125rem] shrink-0 text-[var(--ore-btn-primary-bg)]" />
                <h3 className="truncate font-minecraft text-[clamp(0.9375rem,1.25vw,1.0625rem)] text-[var(--ore-modal-header-text)] ore-text-shadow">
                  下载任务管理
                </h3>
              </div>

              <div className="mt-[0.5rem] flex flex-wrap items-center gap-[0.5rem] text-[0.75rem] font-minecraft uppercase tracking-[0.12em] text-[var(--ore-color-text-secondary-default)]">
                <span
                  className="inline-flex items-center border-[0.125rem] border-[var(--ore-border-color)] bg-[var(--ore-color-background-success-default)] px-[0.5rem] py-[0.1875rem] text-[var(--ore-color-text-onLight-default)]"
                  style={{ boxShadow: 'var(--ore-shadow-success-default)' }}
                >
                  {activeTasksCount} 进行中
                </span>
                <span>{taskList.length} 个任务</span>
              </div>
            </div>

            <motion.div
              className="custom-scrollbar max-h-[75vh] space-y-[1rem] overflow-y-auto overflow-x-hidden bg-[var(--ore-downloadDetail-base)] p-[1rem]"
              style={{ boxShadow: 'var(--ore-downloadDetail-listShadow)' }}
            >
              {taskList.map((task: DownloadTask) => (
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
            </motion.div>

            <div
              className="flex shrink-0 items-center justify-between gap-[0.75rem] border-t-[0.125rem] border-[var(--ore-border-color)] bg-[var(--ore-modal-footer-bg)] px-[1rem] py-[0.625rem]"
              style={{ boxShadow: 'var(--ore-modal-footer-shadow)' }}
            >
              <div className="flex items-center gap-[0.75rem] text-[0.6875rem] font-minecraft text-[var(--ore-color-text-muted-default)]">
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

              <OreButton
                focusKey="btn-taskpanel-hide"
                variant="primary"
                size="auto"
                autoScroll={false}
                onClick={onClose}
                className="!h-[clamp(2rem,2.5vw,2.5rem)] !min-w-[6rem] !px-[0.75rem] text-[0.8125rem]"
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
