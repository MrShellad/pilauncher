// src/ui/components/DirectoryBrowserModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, HardDrive, CornerLeftUp, Plus, Check, X, AlertCircle, Gamepad2, MousePointer2 } from 'lucide-react';
import { OreButton } from '../primitives/OreButton';

import { FocusBoundary } from '../focus/FocusBoundary';
import { FocusItem } from '../focus/FocusItem';
// ✅ 引入 setFocus 用于处理极端空状态下的焦点兜底
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

interface DirNode {
  name: string;
  path: string;
  is_drive: boolean;
}

interface DirectoryBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}

export const DirectoryBrowserModal: React.FC<DirectoryBrowserModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [nodes, setNodes] = useState<DirNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [newDirName, setNewDirName] = useState('PiLauncher'); 

  const listContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadDirectory(currentPath);
  }, [isOpen, currentPath]);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      if (!path) {
        const drives = await invoke<DirNode[]>('get_drives');
        setNodes(drives);
      } else {
        const dirs = await invoke<DirNode[]>('list_valid_dirs', { path });
        setNodes(dirs);
      }
      if(listContainerRef.current) listContainerRef.current.scrollTop = 0;
    } catch (e: any) {
      setError(String(e));
      setNodes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGoUp = async () => {
    if (!currentPath) return;
    try {
      const parent = await invoke<string | null>('get_parent_dir', { path: currentPath });
      setCurrentPath(parent || '');
    } catch (e) {}
  };

  const handleCreateDir = async () => {
    if (!newDirName.trim()) return;
    try {
      const newPath = await invoke<string>('create_valid_dir', { parent: currentPath, name: newDirName.trim() });
      setIsCreating(false);
      setNewDirName('PiLauncher');
      setCurrentPath(newPath); 
    } catch (e: any) {
      setError(String(e));
    }
  };

  // ✅ 焦点兜底安全机制：如果这个文件夹是空的，没有任何列表项可以获得焦点，
  // 强制把焦点丢给底部的“取消”按钮，防止手柄死机卡死。
  useEffect(() => {
    if (isOpen && !loading && nodes.length === 0 && !isCreating) {
      setTimeout(() => setFocus('dir-btn-cancel'), 100);
    }
  }, [isOpen, loading, nodes.length, isCreating]);

  if (!isOpen) return null;

  const getDirFocusKey = (path: string) => `dir-item-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center font-minecraft"
    >
      <FocusBoundary id="directory-browser-boundary" trapFocus={isOpen} onEscape={onClose} className="relative z-10 outline-none">
        <motion.div 
          initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
          className="w-[700px] h-[560px] bg-[#18181B] border-2 border-[#1E1E1F] shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-[#1E1E1F] p-5 border-b-2 border-[#1E1E1F] flex flex-col gap-4 shrink-0">
            {/* ✅ 移除了顶部的关闭 X 按钮，让界面更纯净，逼迫用户通过手柄 B键/ESC 或底部取消退出 */}
            <h3 className="text-white text-xl">选择存放目录</h3>
            
            <div className="flex items-center gap-3">
              <OreButton onClick={handleGoUp} disabled={!currentPath} variant="secondary" size="auto" focusKey="dir-btn-up" className="!h-10">
                <CornerLeftUp size={18} />
              </OreButton>
              <div className="flex-1 bg-[#141415] border border-[#2A2A2C] text-ore-text-muted px-3 h-10 flex items-center text-sm truncate">
                {currentPath || '此电脑 / 根节点 (已屏蔽非纯英文目录)'}
              </div>
              {currentPath && (
                <OreButton onClick={() => setIsCreating(true)} variant="primary" size="auto" focusKey="dir-btn-new" className="!h-10">
                  <Plus size={18} className="mr-1" /> 新建目录
                </OreButton>
              )}
            </div>
          </div>

          {/* List Body */}
          <div ref={listContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-[#141415] relative">
            {error && (
              <div className="mx-2 mb-3 bg-red-500/10 text-red-400 p-3 text-sm border border-red-500/50 flex items-center">
                <AlertCircle size={16} className="mr-2 shrink-0" /> {error}
              </div>
            )}

            {isCreating && (
              <div className="flex items-center gap-3 p-3 bg-ore-green/10 border border-ore-green/30 mb-3">
                <Folder size={24} className="text-ore-green shrink-0" />
                <input 
                  autoFocus
                  type="text" 
                  value={newDirName}
                  onChange={(e) => setNewDirName(e.target.value.replace(/[^\w\s-]/g, ''))} 
                  className="flex-1 bg-black/50 border border-[#2A2A2C] text-white px-3 py-1.5 outline-none focus:border-ore-green text-base"
                />
                <FocusItem focusKey="dir-btn-confirm-new" onEnter={handleCreateDir}>
                  {({ ref, focused }) => (
                    <button ref={ref as any} onClick={handleCreateDir} className={`p-1 rounded-sm outline-none transition-all ${focused ? 'bg-ore-green text-black scale-110' : 'text-ore-green hover:brightness-125'}`}><Check size={20} /></button>
                  )}
                </FocusItem>
                <FocusItem focusKey="dir-btn-cancel-new" onEnter={() => setIsCreating(false)}>
                  {({ ref, focused }) => (
                    <button ref={ref as any} onClick={() => setIsCreating(false)} className={`p-1 rounded-sm outline-none transition-all ${focused ? 'bg-red-400 text-black scale-110' : 'text-red-400 hover:brightness-125'}`}><X size={20} /></button>
                  )}
                </FocusItem>
              </div>
            )}

            {loading ? (
              <div className="text-center text-ore-text-muted mt-10 text-base animate-pulse">正在读取...</div>
            ) : (
              <div className="space-y-1">
                {nodes.map((node, index) => (
                  <FocusItem 
                    key={node.path}
                    focusKey={getDirFocusKey(node.path)}
                    onEnter={() => setCurrentPath(node.path)}
                    // ✅ 核心修复：移除了 currentPath !== '' 的阻断条件！
                    // 现在即使是刚打开模态框（加载所有磁盘的根目录阶段），第一个磁盘也会立刻拿到焦点，手柄就能开始导航了。
                    defaultFocused={index === 0 && !isCreating}
                  >
                    {({ ref, focused }) => (
                      <div 
                        ref={ref as any}
                        onClick={() => { (ref.current as any)?.focus(); }}
                        onDoubleClick={() => setCurrentPath(node.path)} 
                        className={`
                          flex items-center p-3 rounded-sm transition-all select-none cursor-pointer outline-none group border-2
                          ${focused 
                            ? 'bg-ore-green/15 border-ore-green shadow-lg scale-[1.01] z-10 text-white' 
                            : 'bg-transparent border-transparent text-ore-text-muted hover:bg-white/5 hover:text-white'
                          }
                        `}
                      >
                        {node.is_drive ? <HardDrive size={28} className={`mr-4 shrink-0 transition-colors ${focused ? 'text-ore-green' : 'group-hover:text-white'}`} /> : <Folder size={28} className={`mr-4 shrink-0 transition-colors ${focused ? 'text-ore-green' : 'group-hover:text-white'}`} />}
                        <span className="flex-1 truncate text-lg font-minecraft">{node.name}</span>
                        
                        <AnimatePresence>
                          {focused && (
                            <motion.div initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 5 }} className="flex items-center gap-2 text-xs text-ore-green/80 pl-2">
                              <span className="intent-gamepad:flex hidden items-center gap-1.5"><Gamepad2 size={14}/> 按 <X size={16} className='p-0.5 rounded-full bg-white/10 text-white'/> 进入</span>
                              <span className="intent-mouse:flex hidden items-center gap-1.5"><MousePointer2 size={14}/> 双击进入</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </FocusItem>
                ))}
              </div>
            )}
            
            {!loading && nodes.length === 0 && !isCreating && !error && (
              <div className="text-center text-ore-text-muted mt-16 text-base flex flex-col items-center gap-3 opacity-60">
                <Folder size={40} className="opacity-40" />
                暂无合法的纯英文目录
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-[#1E1E1F] p-4 border-t-2 border-[#1E1E1F] flex justify-end gap-4 shrink-0">
            <OreButton onClick={onClose} variant="ghost" size="lg" focusKey="dir-btn-cancel">取消</OreButton>
            <OreButton 
              onClick={() => onSelect(currentPath)} 
              disabled={!currentPath} 
              variant="primary" 
              size="lg"
              focusKey="dir-btn-select"
            >
              选择当前目录
            </OreButton>
          </div>
        </motion.div>
      </FocusBoundary>
    </motion.div>
  );
};