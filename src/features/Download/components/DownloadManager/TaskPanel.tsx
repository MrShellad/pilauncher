// /src/features/Download/components/DownloadManager/TaskPanel.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { TaskItem } from './TaskItem';
import type { DownloadTask } from '../../../../store/useDownloadStore';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useEffect } from 'react';
import { focusManager } from '../../../../ui/focus/FocusManager';

export const TaskPanel = ({ isOpen, onClose, taskList, setActiveTab, removeTask }: any) => {
  const activeTasksCount = taskList.filter((t: DownloadTask) => t.status === 'downloading').length;

  // ✅ 面板打开时，强制将焦点移入面板内的关闭按钮上
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => focusManager.focus('btn-close-taskpanel'), 100);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } }}
          className="mb-4 w-[400px] bg-[#18181B] border-2 border-ore-gray-border shadow-2xl flex flex-col z-50 origin-bottom-right"
        >
          {/* ✅ trapFocus 焦点囚禁：开启时无法导航到外部。onEscape 绑定关闭 */}
          <FocusBoundary id="download-task-panel" trapFocus={isOpen} onEscape={onClose} className="flex flex-col h-full overflow-hidden">
            <div className="bg-[#1E1E1F] p-3 border-b-2 border-ore-gray-border flex justify-between items-center">
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

            <div className="max-h-[65vh] overflow-y-auto custom-scrollbar p-3 space-y-4">
              {taskList.map((task: DownloadTask) => (
                <TaskItem key={task.id} task={task} setActiveTab={setActiveTab} removeTask={removeTask} />
              ))}
            </div>
          </FocusBoundary>
        </motion.div>
      )}
    </AnimatePresence>
  );
};