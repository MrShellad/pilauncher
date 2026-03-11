// src/features/Download/components/DownloadManager/TaskPanel.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
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
          onAnimationComplete={() => setFocus('btn-close-taskpanel')}
          className="mb-4 w-[clamp(320px,40vw,500px)] bg-[#141415] border-2 border-[#2A2A2C] shadow-2xl rounded-sm overflow-hidden flex flex-col"
        >
          <FocusBoundary id="download-task-panel" trapFocus={isOpen} onEscape={onClose} className="flex flex-col h-full overflow-hidden outline-none">
            <div className="bg-[#1E1E1F] p-3 border-b-2 border-ore-gray-border flex justify-between items-center shrink-0">
              <h3 className="font-minecraft text-white text-sm flex items-center">
                <Download size={16} className="mr-2 text-ore-green" /> 
                任务管理 ({activeTasksCount} 进行中)
              </h3>
              
              <FocusItem focusKey="btn-close-taskpanel" onEnter={onClose}>
                {({ ref, focused }) => (
                  <button 
                    ref={ref as any} 
                    onClick={onClose} 
                    className={`rounded-sm transition-colors outline-none p-1 ${focused ? 'bg-white/20 text-white ring-2 ring-white scale-110' : 'text-ore-text-muted hover:text-white'}`}
                  >
                    <X size={18} />
                  </button>
                )}
              </FocusItem>
            </div>

            <motion.div className="max-h-[65vh] overflow-y-auto overflow-x-hidden custom-scrollbar p-3 space-y-4">
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