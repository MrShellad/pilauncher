import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Download } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import type { DownloadTask } from '../../../../store/useDownloadStore';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { OreButton } from '../../../../ui/primitives/OreButton';
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
              className="flex shrink-0 items-center justify-between gap-[1rem] border-t-[0.125rem] border-[var(--ore-border-color)] bg-[var(--ore-modal-footer-bg)] px-[1rem] py-[0.75rem]"
              style={{ boxShadow: 'var(--ore-modal-footer-shadow)' }}
            >
              <div className="text-[0.75rem] font-minecraft leading-[1.4] text-[var(--ore-color-text-muted-default)]">
                <div>手柄菜单键也可以直接隐藏任务窗口</div>
                <div className="text-[var(--ore-color-text-secondary-default)]">隐藏后焦点会返回当前页面的可操作按钮</div>
              </div>

              <OreButton
                focusKey="btn-taskpanel-hide"
                variant="primary"
                size="auto"
                autoScroll={false}
                onClick={onClose}
                className="!h-[clamp(2.375rem,3vw,2.75rem)] !min-w-[8.75rem] !px-[1rem]"
              >
                <span className="flex items-center">
                  隐藏面板
                  <ChevronRight className="ml-[0.375rem] h-[1rem] w-[1rem]" />
                </span>
              </OreButton>
            </div>
          </FocusBoundary>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
