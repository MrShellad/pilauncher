// /src/features/Download/components/DownloadManager/TaskItem.tsx
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, CheckCircle, Box, Trash2, List, Terminal, FileDown, AlertTriangle } from 'lucide-react';
import { useDownloadStore, type DownloadTask } from '../../../../store/useDownloadStore';
import { OreButton } from '../../../../ui/primitives/OreButton'; // ✅ 引入 OreUI 标准按钮

export const TaskItem = ({ task, setActiveTab, removeTask }: { task: DownloadTask, setActiveTab: any, removeTask: any }) => {
  const [showLogs, setShowLogs] = useState(false);
  
  const isDone = task.status === 'completed';
  const isError = task.status === 'error'; 
  const isResource = task.taskType === 'resource';

  const latestLogs = task.logs.slice(-3);

  // ✅ 增强标题响应式长度
  const titleLength = task.title.length;
  let titleSizeClass = "text-[clamp(12px,1.2vw,16px)]";
  if (titleLength > 30) titleSizeClass = "text-[clamp(10px,1vw,12px)] leading-tight";
  else if (titleLength > 20) titleSizeClass = "text-[clamp(11px,1.1vw,14px)]";

  const renderLogLine = (log: string, index: number) => {
    const timeMatch = log.match(/^(\[.*?\])\s(.*)$/);
    const time = timeMatch ? timeMatch[1] : '';
    const message = timeMatch ? timeMatch[2] : log;
    const highlightRegex = /(\d+\/\d+|\d+%|[\w.-]+\.(?:jar|json|zip)|完成|失败|成功|异常中断)/g;
    const msgParts = message.split(highlightRegex);

    return (
      <div key={index} className="truncate flex items-center mb-0.5">
        {/* ✅ 修复时间戳可读性：使用深色微透背景块包裹时间戳 */}
        <span className="text-[#A0A0A0] bg-black/40 px-1 rounded-sm mr-2 shrink-0 border border-white/5">{time}</span>
        <span className="text-gray-300">
          {msgParts.map((part, i) => {
            if (highlightRegex.test(part)) {
              const color = part.includes('失败') || part.includes('异常中断') ? 'text-red-400' : 'text-ore-green';
              return <span key={i} className={`${color} font-bold`}>{part}</span>;
            }
            return <span key={i}>{part}</span>;
          })}
        </span>
      </div>
    );
  };

  return (
    <div className={`bg-[#1E1E1F] border p-3 flex flex-col group relative transition-colors ${isError ? 'border-red-500/50' : 'border-ore-gray-border'}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2 flex-1 min-w-0 pr-4">
          {isError ? (
            <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          ) : isResource ? (
             <FileDown size={16} className={`flex-shrink-0 ${isDone ? 'text-blue-400' : 'text-ore-text-muted'}`} />
          ) : (
             <Box size={16} className={`flex-shrink-0 ${isDone ? 'text-ore-green' : 'text-ore-text-muted'}`} />
          )}
          {/* ✅ 应用计算出的动态字体 */}
          <span className={`font-minecraft truncate ${isError ? 'text-red-400' : 'text-white'} ${titleSizeClass}`}>
            {task.title}
          </span>
        </div>
        <div className={`text-xs font-minecraft flex-shrink-0 ${isError ? 'text-red-500' : 'text-ore-text-muted'}`}>
          {isError ? 'FAILED' : `${task.progress}%`}
        </div>
      </div>

      <div className="text-[10px] text-ore-text-muted mb-2 flex justify-between">
        <span className={isError ? 'text-red-400/80' : ''}>{task.stepText}</span>
        <span className="font-mono">{task.speed}</span>
      </div>

      <div className="w-full h-1.5 bg-[#18181B] overflow-hidden mb-3 rounded-sm">
        <motion.div 
          className={`h-full ${isError ? 'bg-red-500' : (isDone ? (isResource ? 'bg-blue-400' : 'bg-ore-green') : 'bg-white')}`}
          initial={{ width: 0 }} animate={{ width: `${task.progress}%` }} transition={{ ease: "linear", duration: 0.5 }}
        />
      </div>

      <div className="bg-[#141415] border border-[#2A2A2C] rounded-sm p-1.5 mb-2 h-[60px] overflow-hidden flex flex-col justify-end text-[10px] font-mono leading-relaxed relative">
        <Terminal size={12} className="absolute top-1.5 right-1.5 text-ore-gray-border/30" />
        {latestLogs.map((log, i) => renderLogLine(log, i))}
      </div>

      <div className="flex justify-between items-center mt-2">
        {/* ✅ 日志展开按钮接入焦点 */}
        <div className="origin-left">
          <OreButton 
            focusKey={`btn-log-${task.id}`} 
            variant="ghost" 
            size="auto"
            autoScroll={false}
            onClick={() => setShowLogs(!showLogs)} 
            className="!h-10 !px-3 !min-w-0"
          >
            <div className="flex items-center text-sm text-ore-text-muted hover:text-white transition-colors">
              <List size={14} className="mr-1" /> 全部日志 {showLogs ? <ChevronUp size={12} className="ml-1" /> : <ChevronDown size={12} className="ml-1" />}
            </div>
          </OreButton>
        </div>
        
        <div className="flex space-x-2 origin-right">
          {!isDone && !isError ? (
            <OreButton 
              focusKey={`btn-cancel-${task.id}`} 
              variant="danger" 
              size="auto"
              autoScroll={false}
              onClick={() => {
                invoke('cancel_instance_deployment', { instanceId: task.id }).catch(console.error);
                useDownloadStore.getState().cancelTask(task.id);
              }}
              className="!h-10 !px-4 !min-w-0 text-white"
            >
              <Trash2 size={16} />
            </OreButton>
          ) : (
            <OreButton 
              focusKey={`btn-complete-${task.id}`} 
              variant={isError ? "danger" : "primary"}
              size="auto"
              autoScroll={false}
              onClick={() => { 
                removeTask(task.id); 
                if (!isResource && isDone) setActiveTab('instances'); 
              }}
              className="!h-10 !px-4 !min-w-0 text-sm"
              style={isResource ? { backgroundColor: '#3b82f6', borderColor: '#2563eb' } : {}} // 资源下载显示蓝色完成
            >
              <div className="flex items-center">
                {isError ? <Trash2 size={16} className="mr-1" /> : <CheckCircle size={16} className="mr-1" />} 
                {isError ? '清除异常任务' : (isResource ? '关闭' : '前往配置')}
              </div>
            </OreButton>
          )}
        </div>
      </div>

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