// src/features/Download/components/DownloadManager/TaskPanel.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { Download } from 'lucide-react';
import { TaskItem } from './TaskItem';
import type { DownloadTask } from '../../../../store/useDownloadStore';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { OreMotionTokens } from '../../../../style/tokens/motion';

export const TaskPanel = ({ isOpen, onClose, taskList, setActiveTab, removeTask }: any) => {
  const activeTasksCount = taskList.filter((t: DownloadTask) => t.status === 'downloading').length;
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={OreMotionTokens.downloadPanelContainer}
          initial="hidden"
          animate="visible"
          exit="exit"
          onAnimationComplete={() => setFocus('btn-taskpanel-header')}
          className="mb-5 w-[clamp(360px,50vw,640px)] bg-[#141415] border-2 border-[#2A2A2C] shadow-2xl rounded-md overflow-hidden flex flex-col z-[1000]"
        >
          <FocusBoundary id="download-task-panel" trapFocus={isOpen} onEscape={onClose} className="flex flex-col h-full overflow-hidden outline-none">
            <div className="bg-[#1E1E1F] px-4 py-3 border-b-2 border-ore-gray-border flex justify-between items-center shrink-0">
              <h3 className="font-minecraft text-white text-base flex items-center">
                <Download size={18} className="mr-2 text-ore-green" /> 
                任务管理 ({activeTasksCount} 进行中)
              </h3>
              
              <FocusItem focusKey="btn-taskpanel-header">
                {({ ref, focused }) => (
                  <div
                    ref={ref as any}
                    className={`text-[11px] leading-snug text-ore-text-muted text-right max-w-[200px] select-none ${
                      focused ? 'ring-2 ring-white rounded-sm px-1 py-0.5 bg-white/10' : ''
                    }`}
                  >
                    <div>手柄菜单键：打开/关闭任务面板</div>
                    <div className="opacity-80">隐藏后焦点会回到当前页面</div>
                  </div>
                )}
              </FocusItem>
            </div>

            <motion.div className="max-h-[75vh] overflow-y-auto overflow-x-hidden custom-scrollbar p-4 space-y-4">
              {taskList.map((task: DownloadTask) => (
                <motion.div key={task.id} variants={OreMotionTokens.downloadPanelItem}>
                  <TaskItem task={task} setActiveTab={setActiveTab} removeTask={removeTask} />
                </motion.div>
              ))}
            </motion.div>
          </FocusBoundary>
        </motion.div>
      )}
    </AnimatePresence>
  );
};