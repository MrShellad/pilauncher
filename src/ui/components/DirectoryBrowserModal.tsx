// src/ui/components/DirectoryBrowserModal.tsx
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, HardDrive, CornerLeftUp, Plus, Check, X, AlertCircle } from 'lucide-react';
import { OreButton } from '../primitives/OreButton';

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

  // 新建文件夹相关
  const [isCreating, setIsCreating] = useState(false);
  const [newDirName, setNewDirName] = useState('PiLauncher'); // ✅ 默认填充

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
      setCurrentPath(newPath); // ✅ 创建成功后，自动进入新目录！
    } catch (e: any) {
      setError(String(e));
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center font-minecraft"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
        className="w-[600px] h-[500px] bg-[#18181B] border-2 border-ore-gray-border shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-[#1E1E1F] p-4 border-b-2 border-ore-gray-border flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-center">
            <h3 className="text-white text-lg">选择存放目录</h3>
            <button onClick={onClose} className="text-ore-text-muted hover:text-white outline-none"><X size={20} /></button>
          </div>
          
          <div className="flex items-center gap-2">
            <OreButton onClick={handleGoUp} disabled={!currentPath} variant="secondary" size="auto" className="!h-8 !px-3">
              <CornerLeftUp size={16} />
            </OreButton>
            <div className="flex-1 bg-[#141415] border border-ore-gray-border text-ore-text-muted px-3 h-8 flex items-center text-sm truncate">
              {currentPath || '此电脑 / 根节点 (已屏蔽非纯英文目录)'}
            </div>
            {currentPath && (
              <OreButton onClick={() => setIsCreating(true)} variant="primary" size="auto" className="!h-8 !px-3">
                <Plus size={16} className="mr-1" /> 新建目录
              </OreButton>
            )}
          </div>
        </div>

        {/* List Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-[#141415] relative">
          {error && (
            <div className="mx-2 mb-2 bg-red-500/10 text-red-400 p-2 text-xs border border-red-500/50 flex items-center">
              <AlertCircle size={14} className="mr-2 shrink-0" /> {error}
            </div>
          )}

          {isCreating && (
            <div className="flex items-center gap-2 p-2 bg-ore-green/10 border border-ore-green/30 mb-2">
              <Folder size={20} className="text-ore-green shrink-0" />
              <input 
                autoFocus
                type="text" 
                value={newDirName}
                onChange={(e) => setNewDirName(e.target.value.replace(/[^\w\s-]/g, ''))} // 实时剔除特殊符号
                className="flex-1 bg-black/50 border border-ore-gray-border text-white px-2 py-1 outline-none focus:border-ore-green text-sm"
              />
              <button onClick={handleCreateDir} className="text-ore-green hover:brightness-125 p-1"><Check size={18} /></button>
              <button onClick={() => setIsCreating(false)} className="text-red-400 hover:brightness-125 p-1"><X size={18} /></button>
            </div>
          )}

          {loading ? (
            <div className="text-center text-ore-text-muted mt-10 text-sm animate-pulse">正在读取...</div>
          ) : (
            nodes.map((node) => (
              <div 
                key={node.path}
                onDoubleClick={() => setCurrentPath(node.path)}
                className="flex items-center p-2 hover:bg-white/5 cursor-pointer text-ore-text-muted hover:text-white transition-colors select-none group"
              >
                {node.is_drive ? <HardDrive size={20} className="mr-3" /> : <Folder size={20} className="mr-3" />}
                <span className="flex-1 truncate text-sm">{node.name}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); setCurrentPath(node.path); }}
                  className="opacity-0 group-hover:opacity-100 bg-ore-button/20 px-2 py-1 text-xs rounded-sm hover:bg-ore-button/40"
                >
                  进入
                </button>
              </div>
            ))
          )}
          {!loading && nodes.length === 0 && !isCreating && !error && (
            <div className="text-center text-ore-text-muted mt-10 text-sm">暂无合法的纯英文目录</div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#1E1E1F] p-4 border-t-2 border-ore-gray-border flex justify-end gap-3 shrink-0">
          <OreButton onClick={onClose} variant="ghost" size="md">取消</OreButton>
          <OreButton 
            onClick={() => onSelect(currentPath)} 
            disabled={!currentPath} 
            variant="primary" 
            size="md"
          >
            选择当前目录
          </OreButton>
        </div>
      </motion.div>
    </motion.div>
  );
};