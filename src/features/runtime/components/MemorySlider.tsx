// src/features/runtime/components/MemorySlider.tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreSlider } from '../../../ui/primitives/OreSlider';
import { Zap, Loader2 } from 'lucide-react';
import { OreMotionTokens } from '../../../style/tokens/motion';

export const MemorySlider: React.FC<{ maxMemory: number; onChange: (maxMem: number) => void; disabled?: boolean }> = ({ maxMemory, onChange, disabled }) => {
  // 本地状态维护系统内存信息
  const [stats, setStats] = useState({ total: 0, available: 0, recommended: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemory = async () => {
      try {
        // ✅ 调用 Rust 获取系统真实物理内存 (MB)
        const res = await invoke<{total: number, available: number}>('get_system_memory');
        // 智能推荐逻辑：不超过 8GB，不超可用内存，占总内存的一半
        const recommended = Math.min(Math.floor(res.total / 2), res.available, 8192);
        
        setStats({ total: res.total, available: res.available, recommended });
      } catch (err) {
        console.error("读取内存失败:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMemory();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center text-ore-text-muted font-minecraft space-x-2">
        <Loader2 size={16} className="animate-spin" />
        <span>正在读取系统物理内存...</span>
      </div>
    );
  }

  const { total, available, recommended } = stats;
  const isRed = maxMemory > available;
  const isYellow = !isRed && maxMemory > total * 0.7;
  
  const statusColor = disabled ? 'text-gray-500' : isRed ? 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]' : isYellow ? 'text-yellow-500' : 'text-ore-green';
  const fillColor = disabled ? 'bg-gray-600' : isRed ? 'bg-red-500' : isYellow ? 'bg-yellow-500' : 'bg-ore-green';
  const thumbColor = isRed ? 'bg-red-500' : isYellow ? 'bg-yellow-500' : 'bg-ore-green';

  return (
    <div className="flex flex-col w-full lg:w-[400px] xl:w-[460px] flex-shrink-0">
      {/* 顶部数据看板 */}
      <div className="flex justify-between items-center bg-[#141415] p-3 border-2 border-[#1E1E1F] rounded-sm shadow-inner mb-4">
        <div className="flex flex-col">
          <span className="text-xs text-ore-text-muted font-minecraft mb-1">分配上限</span>
          <span className={`text-3xl font-minecraft transition-colors ${statusColor}`}>
            {(maxMemory / 1024).toFixed(1)} <span className="text-sm">GB</span>
          </span>
        </div>
        <div className="flex flex-col items-end text-xs text-ore-text-muted font-minecraft space-y-1">
          <span>系统总计: {(total / 1024).toFixed(1)} GB</span>
          <span>当前可用: <span className="text-white">{(available / 1024).toFixed(1)} GB</span></span>
          <span>建议分配: <span className="text-ore-green">{(recommended / 1024).toFixed(1)} GB</span></span>
        </div>
      </div>
      
      {/* 滑动条与快捷按钮 */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 mt-1">
          <OreSlider value={maxMemory} min={1024} max={total} step={512} onChange={onChange} disabled={disabled} fillColorClass={fillColor} thumbColorClass={thumbColor} />
        </div>
        <OreButton size="sm" variant="secondary" onClick={() => onChange(recommended)} disabled={disabled || maxMemory === recommended}>
          <Zap size={15} className="mr-1.5" /> 自动推荐
        </OreButton>
      </div>

      {/* 警告折叠面板 */}
      <AnimatePresence mode="wait">
        {!disabled && isRed ? (
          <motion.div key="red-warning" initial={OreMotionTokens.collapseInitial} animate={OreMotionTokens.collapseAnimate} exit={OreMotionTokens.collapseExit} className="text-xs text-red-400 font-minecraft bg-[#2a1717] p-3 border-l-2 border-red-500 leading-relaxed shadow-sm break-words whitespace-normal">
            警告：分配的内存已超过系统当前空闲可用内存！游戏或系统极大概率会发生严重卡顿甚至崩溃。
          </motion.div>
        ) : !disabled && isYellow ? (
          <motion.div key="yellow-warning" initial={OreMotionTokens.collapseInitial} animate={OreMotionTokens.collapseAnimate} exit={OreMotionTokens.collapseExit} className="text-xs text-yellow-400 font-minecraft bg-yellow-500/10 p-3 border-l-2 border-yellow-500 leading-relaxed shadow-sm break-words whitespace-normal">
            提示：分配的内存过高，可能会导致在后台运行的浏览器、聊天软件被系统强行关闭。
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};