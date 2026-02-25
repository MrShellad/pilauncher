// /src/features/Downloads/components/DownloadManager.tsx
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { listen } from '@tauri-apps/api/event';

import { useDownloadStore } from '../../../store/useDownloadStore';
import { useLauncherStore } from '../../../store/useLauncherStore'; 
import { 
  Download, X, Pause, Play, ChevronUp, ChevronDown, 
  CheckCircle, Box, Trash2, List, Terminal
} from 'lucide-react';

export const DownloadManager: React.FC = () => {
  const { tasks, isPopupOpen, setPopupOpen, addOrUpdateTask, pauseTask, removeTask } = useDownloadStore();
  const setActiveTab = useLauncherStore(state => state.setActiveTab); 
  
  const taskList = Object.values(tasks);
  const activeTasksCount = taskList.filter(t => t.status === 'downloading').length;
  
  useEffect(() => {
    const unlisten = listen('instance-deployment-progress', (event: any) => {
      const payload = event.payload;
      addOrUpdateTask({
        id: payload.instance_id,
        stage: payload.stage,
        current: payload.current,
        total: payload.total,
        message: payload.message,
      });
    });
    return () => { unlisten.then(f => f()); };
  }, [addOrUpdateTask]);

  if (taskList.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* --- 弹窗面板 --- */}
      <AnimatePresence>
        {isPopupOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } }}
            className="mb-4 w-[400px] bg-[#18181B] border-2 border-ore-gray-border shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#1E1E1F] p-3 border-b-2 border-ore-gray-border flex justify-between items-center">
              <h3 className="font-minecraft text-white text-sm flex items-center">
                <Download size={16} className="mr-2 text-ore-green" /> 
                任务管理 ({activeTasksCount} 进行中)
              </h3>
              <button onClick={() => setPopupOpen(false)} className="text-ore-text-muted hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Task List */}
            <div className="max-h-[65vh] overflow-y-auto no-scrollbar p-3 space-y-4">
              {taskList.map(task => (
                <TaskItem key={task.id} task={task} setActiveTab={setActiveTab} pauseTask={pauseTask} removeTask={removeTask} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 右下角悬浮气泡 --- */}
      <AnimatePresence>
        {!isPopupOpen && activeTasksCount > 0 && (
          <motion.button
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setPopupOpen(true)}
            className="relative w-14 h-14 bg-[#1E1E1F] border-2 border-ore-gray-border rounded-full flex items-center justify-center shadow-lg group hover:border-ore-green transition-colors"
          >
            <Download size={24} className="text-white" />
            <span className="absolute -top-1 -right-1 bg-ore-green text-[#1E1E1F] text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
              {activeTasksCount}
            </span>
            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="transparent" stroke="#333" strokeWidth="4" />
              <circle cx="50" cy="50" r="46" fill="transparent" stroke="#22C55E" strokeWidth="4" 
                strokeDasharray={`${(taskList[0]?.progress || 0) * 2.89} 289`} 
                className="transition-all duration-500" 
              />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- 单个任务卡片组件 ---
const TaskItem = ({ task, setActiveTab, pauseTask, removeTask }: any) => {
  const [showLogs, setShowLogs] = React.useState(false);
  const isDone = task.status === 'completed';

  // ✅ 截取最新的三条日志用于默认展示
  const latestLogs = task.logs.slice(-3);

  // ✅ 正则高亮渲染引擎
  const renderLogLine = (log: string, index: number) => {
    // 1. 剥离时间戳和信息体
    const timeMatch = log.match(/^(\[.*?\])\s(.*)$/);
    const time = timeMatch ? timeMatch[1] : '';
    const message = timeMatch ? timeMatch[2] : log;

    // 2. 正则捕获：进度分数(12/100)、百分比(50%)、带后缀的文件名、状态词
    const highlightRegex = /(\d+\/\d+|\d+%|[\w.-]+\.(?:jar|json|zip)|完成|失败|成功)/g;
    const msgParts = message.split(highlightRegex);

    return (
      <div key={index} className="truncate flex">
        <span className="text-ore-gray-border/70 mr-2 shrink-0">{time}</span>
        <span className="text-gray-400">
          {msgParts.map((part, i) => {
            if (highlightRegex.test(part)) {
              // 失败飘红，其他状态或数字飘绿
              const color = part.includes('失败') ? 'text-red-400' : 'text-ore-green';
              return <span key={i} className={`${color} font-bold`}>{part}</span>;
            }
            return <span key={i}>{part}</span>;
          })}
        </span>
      </div>
    );
  };

  return (
    <div className="bg-[#1E1E1F] border border-ore-gray-border p-3 flex flex-col group relative">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2">
          <Box size={16} className={isDone ? 'text-ore-green' : 'text-ore-text-muted'} />
          <span className="font-minecraft text-white text-sm truncate max-w-[200px]">{task.instanceName}</span>
        </div>
        <div className="text-xs font-minecraft text-ore-text-muted">{task.progress}%</div>
      </div>

      <div className="text-[10px] text-ore-text-muted mb-2 flex justify-between">
        <span>{task.stepText}</span>
        <span className="font-mono">{task.speed}</span>
      </div>

      <div className="w-full h-1.5 bg-[#18181B] overflow-hidden mb-3">
        <motion.div 
          className={`h-full ${isDone ? 'bg-ore-green' : 'bg-white'}`}
          initial={{ width: 0 }}
          animate={{ width: `${task.progress}%` }}
          transition={{ ease: "linear", duration: 0.5 }}
        />
      </div>

      {/* ✅ 默认悬浮显示：迷你控制台 (高度固定，自动挤出旧日志) */}
      <div className="bg-[#141415] border border-[#2A2A2C] rounded-sm p-1.5 mb-2 h-14 overflow-hidden flex flex-col justify-end text-[10px] font-mono leading-relaxed relative">
        <Terminal size={12} className="absolute top-1.5 right-1.5 text-ore-gray-border/30" />
        {latestLogs.map((log: string, i: number) => renderLogLine(log, i))}
      </div>

      {/* 操作按钮栏 */}
      <div className="flex justify-between items-center mt-1">
        <button 
          onClick={() => setShowLogs(!showLogs)} 
          className="text-xs text-ore-text-muted hover:text-white flex items-center transition-colors"
        >
          <List size={12} className="mr-1" /> 全部日志 {showLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        
        <div className="flex space-x-2">
          {!isDone ? (
            <button onClick={() => removeTask(task.id)} className="p-1.5 hover:bg-red-500/20 text-ore-text-muted hover:text-red-400 transition-colors rounded-sm" title="取消任务">
              <Trash2 size={14} />
            </button>
          ) : (
            <button 
              onClick={() => { 
                removeTask(task.id); 
                setActiveTab('instances'); 
              }}
              className="px-2 py-1 bg-ore-green/20 text-ore-green text-xs font-minecraft hover:bg-ore-green hover:text-[#1E1E1F] transition-colors flex items-center"
            >
              <CheckCircle size={12} className="mr-1" /> 前往配置
            </button>
          )}
        </div>
      </div>

      {/* 展开的完整日志流 */}
      <AnimatePresence>
        {showLogs && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="mt-3 bg-[#141415] p-2 h-36 overflow-y-auto no-scrollbar text-[10px] font-mono leading-relaxed border border-[#2A2A2C] rounded-sm"
          >
            {task.logs.map((log: string, i: number) => renderLogLine(log, i))}
            <div ref={(el) => el?.scrollIntoView()} /> 
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};