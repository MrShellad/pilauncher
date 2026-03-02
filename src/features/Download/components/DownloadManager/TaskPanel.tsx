import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { TaskItem } from './TaskItem';
import type { DownloadTask } from '../../../../store/useDownloadStore';

export const TaskPanel = ({ isOpen, onClose, taskList, setActiveTab, removeTask }: any) => {
  const activeTasksCount = taskList.filter((t: DownloadTask) => t.status === 'downloading').length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } }}
          className="mb-4 w-[400px] bg-[#18181B] border-2 border-ore-gray-border shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="bg-[#1E1E1F] p-3 border-b-2 border-ore-gray-border flex justify-between items-center">
            <h3 className="font-minecraft text-white text-sm flex items-center">
              <Download size={16} className="mr-2 text-ore-green" /> 
              任务管理 ({activeTasksCount} 进行中)
            </h3>
            <button onClick={onClose} className="text-ore-text-muted hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="max-h-[65vh] overflow-y-auto custom-scrollbar p-3 space-y-4">
            {taskList.map((task: DownloadTask) => (
              <TaskItem key={task.id} task={task} setActiveTab={setActiveTab} removeTask={removeTask} />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};