import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, CheckCircle, Box, Trash2, List, Terminal, FileDown } from 'lucide-react';
import type { DownloadTask } from '../../../../store/useDownloadStore';

export const TaskItem = ({ task, setActiveTab, removeTask }: { task: DownloadTask, setActiveTab: any, removeTask: any }) => {
  const [showLogs, setShowLogs] = useState(false);
  const isDone = task.status === 'completed';
  const isResource = task.taskType === 'resource';

  const latestLogs = task.logs.slice(-3);

  const renderLogLine = (log: string, index: number) => {
    const timeMatch = log.match(/^(\[.*?\])\s(.*)$/);
    const time = timeMatch ? timeMatch[1] : '';
    const message = timeMatch ? timeMatch[2] : log;
    const highlightRegex = /(\d+\/\d+|\d+%|[\w.-]+\.(?:jar|json|zip)|完成|失败|成功)/g;
    const msgParts = message.split(highlightRegex);

    return (
      <div key={index} className="truncate flex">
        <span className="text-ore-gray-border/70 mr-2 shrink-0">{time}</span>
        <span className="text-gray-400">
          {msgParts.map((part, i) => {
            if (highlightRegex.test(part)) {
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
          {/* 根据任务类型显示不同图标 */}
          {isResource ? (
             <FileDown size={16} className={isDone ? 'text-blue-400' : 'text-ore-text-muted'} />
          ) : (
             <Box size={16} className={isDone ? 'text-ore-green' : 'text-ore-text-muted'} />
          )}
          <span className="font-minecraft text-white text-sm truncate max-w-[200px]">{task.title}</span>
        </div>
        <div className="text-xs font-minecraft text-ore-text-muted">{task.progress}%</div>
      </div>

      <div className="text-[10px] text-ore-text-muted mb-2 flex justify-between">
        <span>{task.stepText}</span>
        <span className="font-mono">{task.speed}</span>
      </div>

      <div className="w-full h-1.5 bg-[#18181B] overflow-hidden mb-3 rounded-sm">
        <motion.div 
          className={`h-full ${isDone ? (isResource ? 'bg-blue-400' : 'bg-ore-green') : 'bg-white'}`}
          initial={{ width: 0 }} animate={{ width: `${task.progress}%` }} transition={{ ease: "linear", duration: 0.5 }}
        />
      </div>

      {/* 迷你控制台 */}
      <div className="bg-[#141415] border border-[#2A2A2C] rounded-sm p-1.5 mb-2 h-14 overflow-hidden flex flex-col justify-end text-[10px] font-mono leading-relaxed relative">
        <Terminal size={12} className="absolute top-1.5 right-1.5 text-ore-gray-border/30" />
        {latestLogs.map((log, i) => renderLogLine(log, i))}
      </div>

      {/* 操作按钮栏 */}
      <div className="flex justify-between items-center mt-1">
        <button onClick={() => setShowLogs(!showLogs)} className="text-xs text-ore-text-muted hover:text-white flex items-center transition-colors">
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
                // ✅ 如果是实例部署完毕，跳转实例页；如果是资源下载，直接关闭即可
                if (!isResource) setActiveTab('instances'); 
              }}
              className={`px-2 py-1 text-xs font-minecraft transition-colors flex items-center
                ${isResource ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white' : 'bg-ore-green/20 text-ore-green hover:bg-ore-green hover:text-[#1E1E1F]'}
              `}
            >
              <CheckCircle size={12} className="mr-1" /> {isResource ? '关闭' : '前往配置'}
            </button>
          )}
        </div>
      </div>

      {/* 完整日志区 */}
      <AnimatePresence>
        {showLogs && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="mt-3 bg-[#141415] p-2 h-36 overflow-y-auto custom-scrollbar text-[10px] font-mono leading-relaxed border border-[#2A2A2C] rounded-sm"
          >
            {task.logs.map((log, i) => renderLogLine(log, i))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};